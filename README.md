node-siri
=========

nodejs Siri代理.

1. 想办法将 guzzoni.apple.com 解析到运行代理的机器
2. 安装证书
3. OK~

``` javascript
var fs = require("fs"),
	siri = require("./siri");

siri.createServer({
	key: fs.readFileSync('./server.passless.key'),
	cert: fs.readFileSync('./server.passless.crt')
}, function(command, device) {
	if (command == "你好") {
		device.end("Siri代理向你问好!");
	} else {
		device.proxy();
	}
}).listen(443, function() {
	console.log("Proxy start.");
});

```

支持回调
``` javascript
var fs = require("fs"),
	siri = require("./siri");

siri.createServer({
	key: fs.readFileSync('./server.passless.key'),
	cert: fs.readFileSync('./server.passless.crt')
}, function(command, device) {
	if (command == "洗衣服") {
		device.say("正在为你洗衣服");
		//为你洗衣服、脱水、晾衣服^_^...
		setTimeout(function() {
			device.end("衣服洗好了，主人.");
		}, 1000);
	} else {
		device.proxy();
	}
}).listen(443, function() {
	console.log("Proxy start.");
});
```
