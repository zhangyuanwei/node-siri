node-siri
=========

* nodejs Siri代理.

1. 想办法将 guzzoni.apple.com DNS解析到运行代理的机器.
2. 运行 `sudo node install.js` ,install.js使用80和443端口，所以需要root权限.
3. 通过IOS设备访问 http://guzzoni.apple.com ，系统会自动检测配置.
4. 写自己的程序，尽情的调戏Siri吧。

* 示例

``` javascript
var fs = require("fs"),
	siri = require("./siri");

siri.createServer({
	key: fs.readFileSync('./server-key.pem'),
	cert: fs.readFileSync('./server-cert.pem')
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

* API
待完善
