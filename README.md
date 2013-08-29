node-siri
=========

`node-siri` is a light-weight Siri Proxy written in Node.JS that does
not require you to jailbreak your device.

## Installation

### NPM (Easy)

``` shell
npm install siri
```

### Git (Advanced)

``` shell
git clone https://github.com/zhangyuanwei/node-siri.git
npm update
```

## Getting Started

The installation script requires TCP/443 and optionally TCP/80 (for the
setup, this port can be changed) to be open and should run under a
privileged account which can open those ports.

Normal operation requires port TCP/443 to be open and optionally UDP/53
(if using dnsproxy) to be open, and should run under a privileged
account which can open those ports.

### Configuration

Configuration can come either from the command line or your
`config.json` file.

1. Copy `config.json.sample` to `config.json`.
1. Use a text editor to edit your defaults.

While it is recommended to keep your configuration in the file, you may
wish you temporarily change some settings while testing.  To do so, add
the argument(s) on the command line.

    sudo node examples/proxy.js --debug 1 --locale zh

### DNS

You need a way to hijack DNS requests for `guzzoni.apple.com` and send
them to your server running `node-siri`. You only need to perform one
of the following DNS procedures.

#### Using dnsproxy (Easy)

`node-siri` includes a dns proxy server to simplify things.

1. Set `dnsproxy` to `true` (or `1`) in `config.json`.
1. Configure your iDevice to use the `node-siri` server's IP address for
the first DNS Server.

#### Custom DNS Server (Advanced)

If you already have a DNS server on your network, simply create a zone
file for `guzzoni.apple.com` to point to your `node-siri` server.

See the `contrib/` directory for a sample zone file.

### Setup

1. Run `sudo node install.js`
1. Browse to http://guzzoni.apple.com from your iDevice (in Safari!)
1. Install the certificate from the link provided on the webpage.
1. Reload the webpage.
1. If everything is green, end the `install.js` process.
1. Run `sudo node examples/en-US/hello.js`
1. Activate Siri and say "Hello".

Siri should respond with "*Siri Proxy says 'Hello!'*"


## Example

``` javascript
var siri = require("siri");

siri.createServer(function(cmd, dev) {
    if (/Hello/.test(cmd)) {
        dev.end("Siri Proxy says 'Hello!'");
    } else {
        dev.proxy();
    }
}).start();
```

## API

A Siri conversation consists of one or more requests from the client and
_n_ or more responses from the Siri server.

A Siri Proxy conversation may call `.say()` or `.ask()` zero or more
times during the transaction, however, it must finish with an  `.end()`.

### SiriDevice.say(text[, speakable]):
Returns information to Siri.  This can be called multiple times during
the conversation.

### SiriDevice.ask(text[, speakable], callback):
Returns information to Siri and waits for an answer.  This can be
called multiple times during the conversation.

The answer is sent to the callback function of your choosing.

#### callback(answer)
Answers the callback function.

### SiriDevice.end([text[, speakable]]):
This dialog ends, and optionally returns any information.  This MUST be
called to finalize the transaction.

### SiriDevice.proxy():
The conversation is handed over to the Siri server for processing.

## Troubleshooting

* Ensure your iDevice resolves `guzzoni.apple.com` as your `node-siri`
server.
* `DEPTH_ZERO_SELF_SIGNED_CERT` : Ensure your `node-siri` server is
resolving `guzzoni.apple.com` to the internet. It should not be pointing
to itself!
* `EACCES` : Start `node` in privledged mode, e.g. (`sudo node`)

### Reporting Issues

Submit an issue on github with a [pastebin](http://pastebin.com) (or
equivilant) of the output of the following commands:

_You should be running these commands from the main `node-siri`
directory, where `siri.js` is located._

    pwd
    ls -la
    cat config.json
    cat examples/proxy.js
    openssl x509 -in keys/server-cert.pem -noout -text
    nslookup guzzoni.apple.com
    node -v
    grep "version" package.json
    sudo node examples/proxy.js --debug 1
