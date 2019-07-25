"use strict";

function define(name, value) {
    Object.defineProperty(exports, name, {
        value: value,
        enumerable: true
    });
}

define('ZK_HOSTS', '192.168.3.13:2181,192.168.3.13:2182,192.168.3.13:2183');
define('SERVICE_ROOT_PATH', '/services');
define('SERVICE_NAME', 'service_name');