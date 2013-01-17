node-siri
=========

nodejs siri proxy.

    var fs = require("fs"),
    	siri = require("siri"),
    	tmp = 0;
    
    siri.createServer({
    	key: fs.readFileSync('./server.passless.key'),
    	cert: fs.readFileSync('./server.passless.crt')
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
    	} else {
    		device.proxy();
    	}
    }).listen(4433, function() {
    	console.log("Proxy start.");
    });
