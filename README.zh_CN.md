node-siri
=========

 nodejs Siri代理.

## NPM方式

``` shell
npm install siri
siri #测试脚本需要使用80、443和53端口
```

## 开始使用

1. 运行 `sudo node install.js` ,Siri代理使用443(siri)和53(dns)端口,检测界面使用80端口(可选).
2. 更改IOS设备的DNS服务器为运行node-siri机器的IP.
3. 通过IOS设备访问 http://guzzoni.apple.com ，系统会自动检测配置.
4. 写自己的程序，尽情的调戏Siri吧。

## 编程示例

``` javascript
var siri = require("siri");

siri.createServer(function(cmd, dev) {
    if (/你好/.test(cmd)) {
        dev.end("Siri代理向你问好.");
    } else {
        dev.proxy();
    }
}).start();
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

