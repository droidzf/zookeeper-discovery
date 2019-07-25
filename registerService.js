//zookeeper服务注册，在相应的服务里require('./registerService')
const log = require("./log");
const {createClient, ACL, CreateMode, State} = require('node-zookeeper-client');
const promisify = require('util').promisify;
const zkClient = createClient('192.168.3.13:2181,192.168.3.13:2182,192.168.3.13:2183', {
    sessionTimeout: 10,
    spinDelay: 10,
    retries: 0
});

zkClient.connect();

zkClient.once('connected', () => {
    log.info("zookeeper Connected");
    registerService();//服务注册
});

zkClient.on("expired", function () {
    log.error("zk session expired");
});

zkClient.on("disconnected", function () {
    log.error("disconnected from zk");
});

setTimeout(function () {
    /* am I still in the DISCONNECTED state? */
    if (zkClient.getState() !== State.SYNC_CONNECTED)
        log.error("client state: %s", zkClient.getState());
}, 5000);
// 让zkClient支持promise
const proto = Object.getPrototypeOf(zkClient);
Object.keys(proto).forEach(fnName => {
    const fn = proto[fnName];
    if (proto.hasOwnProperty(fnName) && typeof fn === 'function') {
        zkClient[`${fnName}Async`] = promisify(fn).bind(zkClient);
    }
});

// host和port应该和部署系统结合分配
// serviceName要求唯一
const {serviceName, host, port} = {serviceName: require('./package').name, host: "127.0.0.1", port: 4040};

async function registerService() {
    try {
        // 创建根节点，持久节点
        const rootNode = await zkClient.existsAsync('/services');
        if (rootNode == null) {
            await zkClient.createAsync('/services', null, ACL.OPEN_ACL_UNSAFE, CreateMode.PERSISTENT);
        }
        // 创建服务节点，持久节点
        const servicePath = `/services/${serviceName}`;
        const serviceNode = await zkClient.existsAsync(servicePath);
        if (serviceNode == null) {
            await zkClient.createAsync(servicePath, null, ACL.OPEN_ACL_UNSAFE, CreateMode.PERSISTENT);
        }
        // 创建地址节点，临时顺序节点，这样name就不需要我们去维护了，递增
        const addressPath = `${servicePath}/address-`;
        const serviceAddress = `${host}:${port}`;
        const addressNode = await zkClient.createAsync(addressPath, Buffer.from(serviceAddress), ACL.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL_SEQUENTIAL);
    } catch (error) {
        throw new Error(error);
    }
}
