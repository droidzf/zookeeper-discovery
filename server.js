const url = require("url");
const express = require('express');
const zookeeper = require('node-zookeeper-client');
const httpProxy = require('http-proxy');
const cluster = require('cluster');
const os = require('os');
const log = require("./log");
const loadbalance = require("loadbalance");
const CPUS = os.cpus().length;
const cache = require('./localstorage');
const constants = require('./constants');
const app = express();

if (cluster.isMaster) {
    for (let i = 0; i < CPUS; i++) {
        cluster.fork();
    }
}
else {
    //连接zookeeper
    let zk = zookeeper.createClient(constants.ZK_HOSTS);
    zk.connect();
    require('./discovery')(zk);
    //创建代理服务器对象并监听错误事件
    let proxy = httpProxy.createProxyServer();
    proxy.on('error', function (err, req, res) {
        res.writeHead(500, {"Content-Type": "text/plain"});
        res.write(err.message);
        res.end();
    });

    //启动web服务器
    app.use(express.static('public'));
    app.all('*', function (req, res) {
        if (req.method === "OPTIONS") {
            res.writeHead(200, {
                "Content-Type": "application/json;charset=utf-8",
                'Access-Control-Allow-Origin': '*',
                "Access-Control-Allow-Headers": "x-requested-with,content-type,access-token,service_name"
            });
            res.end();
            return
        }
        //获取服务名称
        let serviceName = req.get(constants.SERVICE_NAME);

        // log.info('ServiceName:%s', serviceName);
        if (!serviceName) {
            reserr(400, "Service-Name request header is not exist");
            return;
        }
        //获取服务路径
        let servicePath = constants.SERVICE_ROOT_PATH + "/" + serviceName;
        if (cache.getItem(servicePath)) {
            /*zk.exists(servicePath, function (event) {
                if (event.NODE_DELETED) {
                    cache.removeItem(servicePath);
                } else {
                    getnode()
                }
            }, function (error, stat) {
                if (stat) {
                    log.info("cache : " + servicePath + " : " + cache[servicePath]);
                    proxy.web(req, res, {
                        target: 'http://' + cache[serviceName] //目标地址
                    });
                } else {
                    getnode()
                }
            });*/
            log.info("cache : " + servicePath + " : " + cache[servicePath]);
            proxy.web(req, res, {
                target: 'http://' + cache[servicePath] //目标地址
            });
        } else {
            getnode()
        }

        //获取服务路径下的地址节点
        function getnode() {
            zk.getChildren(servicePath, function (error, addressNodes) {
                if (error) {
                    log.info(error.stack);
                    reserr(500, error.stack);
                    return;
                }
                let size = addressNodes.length;
                if (size === 0) {
                    log.info('address node is not exist');
                    reserr(404, 'address node is not exist');
                    return;
                }
                //负载策略生成地址容器
                let addressPath = servicePath + "/" + loadbalance.roundRobin(addressNodes).pick();
                //获取服务地址
                zk.getData(addressPath, function (err, serviceAddress) {
                    if (err) {
                        log.error(err.stack);
                        reserr(500, err.stack);
                        return;
                    }
                    // log.info('serviceAddress:%s', serviceAddress);
                    if (!serviceAddress) {
                        log.info('serviceAddress is not exist');
                        reserr(404, 'serviceAddress is not exist');
                        return;
                    }
                    cache.setItem(servicePath, serviceAddress);
                    let pathname = url.parse(req.url).pathname;
                    log.info(`worker:${cluster.worker.id} ${servicePath} : ${req.method} ${serviceAddress}${pathname}`);
                    //执行反向代理
                    proxy.web(req, res, {
                        target: 'http://' + serviceAddress //目标地址
                    });
                });

            });
        }

        function reserr(code, msg) {
            res.writeHead(code, {"Content-Type": "text/plain"});
            res.write(msg);
            res.end();
        }
    });

    app.listen(8080, function () {
        log.info('api-gateway server is running at %d', 8080);
    });
}