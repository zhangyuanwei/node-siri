node-siri
=========

 nodejs Siri代理.

## NPM方式

``` shell
npm install node-siri
siri #测试脚本需要使用80和443端口
```

## 开始使用

1. 想办法将 guzzoni.apple.com DNS解析到运行代理的机器.
2. 运行 `sudo node test.js` ,Siri代理使用443端口,检测界面使用80端口*可选*.
3. 通过IOS设备访问 http://guzzoni.apple.com ，系统会自动检测配置.
4. 写自己的程序，尽情的调戏Siri吧。

## 编程示例

``` javascript
var fs = require("fs"),
	siri = require("siri");

siri.createServer(function(command, device) {
	if (command == "你好") {
		device.end("Siri代理向你问好!");
	} else {
		device.proxy();
	}
}).listen(443, function() {
	console.log("Proxy start.");
});

```

## API

#### SiriDevice.say(text[, speakable]):  
	返回信息，在本次对话结束前可以多次调用。

#### SiriDevice.ask(text[, speakable], callback):  
	询问方式，在本次对话结束前可以多次调用。  

##### callback(answer): 
	回答回调函数,answer为回复内容。

#### SiriDevice.end([text[, speakable]]):  
	结束本次对话，返回信息可选。

#### SiriDevice.proxy(): 
	将本次对话交由Siri服务器处理。

