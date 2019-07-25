"use strict";

const loadbalance = require('loadbalance');
const cache = require('./localstorage');
const constants = require('./constants');
let zkClient;

function connect(zk) {
    zkClient = zk;
    zkClient.once('connected', function () {
        getServices(constants.SERVICE_ROOT_PATH);
    });
}

/**
 * 获取服务列表
 */
function getServices(path) {
    zkClient.getChildren(
        path,
        function (event) {
            console.log('Got Services watcher event: %s', event);
            getServices(constants.SERVICE_ROOT_PATH);
        },
        function (error, children, stat) {
            if (error) {
                console.log(
                    'Failed to list children of %s due to: %s.',
                    path,
                    error
                );
                return;
            }

            // 遍历服务列表，获取服务节点信息
            children.forEach(function (item) {
                getService(path + '/' + item);
            })

        }
    );
}

/**
 * 获取服务节点地址信息（IP,Port）
 */
function getService(path) {
    zkClient.getChildren(
        path,
        function (event) {
            // console.log('Got Serivce watcher event: %s', event);
            cache.removeItem(path);
            getService(path);
        },
        function (error, children, stat) {
            if (error) {
                console.log(
                    'Failed to list children of %s due to: %s.',
                    path,
                    error
                );
                return;
            }
            if (children.length > 0) {
                let addressPath = path + "/" + loadbalance.roundRobin(children).pick();
                zkClient.getData(addressPath, function (err, serviceAddress) {
                    if (err) {
                        console.error(addressPath + ":" + err.stack);
                        return;
                    }
                    // console.log(path + " : " + serviceAddress);
                    cache.setItem(path, serviceAddress);
                });
            }else {
                zkClient.remove(path, function (error) {
                    if (error) {
                        console.log(error.stack);
                        return;
                    }
                    console.log('Node is deleted.');
                });
            }
        }
    );
}

module.exports = connect;