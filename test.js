var fs = require("fs"),
    siri = require("./siri");

siri.createServer({
    key: fs.readFileSync('./server-key.pem'),
    cert: fs.readFileSync('./server-cert.pem')
}, function(command, device) {
    console.log(command);
    if (command == "你好") {
        device.say("3");
        setTimeout(function() {
            device.say("2");
            setTimeout(function() {
                device.say("1");
                setTimeout(function() {
                    device.end("Siri代理向你问好,哈哈哈!");
                }, 1000);
            }, 1000);
        }, 1000);
    } else if (command == "关机") {
        device.end("正在关机...");
        require('child_process').exec("sudo halt");
    } else {
        device.proxy();
    }
}).listen(443, function() {
    console.log("Proxy start.");
});
