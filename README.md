node-siri
=========

nodejs Siri代理.

1. 想办法将 guzzoni.apple.com 解析到运行代理的机器
2. 运行 `node install.js`
3. 通过IOS设备访问 http://guzzoni.apple.com，如果能看到欢迎界面，就离成功不远了
4. 点击欢迎页上的链接安装证书
5. 运行测试程序 `node test.js`
6. 在Siri里说“你好”，代理会回复“Siri代理向你问好!”
7. 写自己的程序，尽情的调戏Siri吧。

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
