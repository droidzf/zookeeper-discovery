const fs = require('fs');
const util = require('util');
const isDEBUG = true;
const filename = "log.log";
const writeStream = fs.createWriteStream(filename,{ 'flags': 'a' });

exports.writeFile = () => {
    exports.info('--------------------------------------------------');
    exports.info('From this point, output will be redirected to file');
    exports.info = buildlog("INFO");
    exports.debug = buildlog("DEBUG");
    exports.warn = buildlog("WARN");
    exports.error = buildlog("ERROR")
};

exports.info = (message, ...optionalParams) => {
    if (isDEBUG) {
        console.log(`${"\033"}[1;34m${Date()} [INFO]  : ${message}${"\033"}[0m`, optionalParams.length > 0 ? optionalParams : "")
    }
};

exports.debug = (message, ...optionalParams) => {
    if (isDEBUG) {
        console.log(`${"\033"}[1;32m${Date()} [DEBUG] : ${message}${"\033"}[0m`, optionalParams.length > 0 ? optionalParams : "")
    }
};

exports.warn = (message, ...optionalParams) => {
    if (isDEBUG) {
        console.log(`${"\033"}[1;33m${Date()} [WARN]  : ${message}${"\033"}[0m`, optionalParams.length > 0 ? optionalParams : "")
    }
};

exports.error = (message, ...optionalParams) => {
    if (isDEBUG) {
        console.log(`${"\033"}[1;31m${Date()} [ERROR] : ${message}${"\033"}[0m`, optionalParams.length > 0 ? optionalParams : "")
    }
};

function buildlog(level) {
    return function () {
        writeStream.write(`${Date()} [${level}] : `);
        writeStream.write(util.format.apply(null, arguments) + '\n');
    };
}