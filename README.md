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

The installation script requires ports 80 and 443 to be open, and should
run under a privileged account which can open those ports.

### DNS

You need a way to hijack DNS requests for `guzzoni.apple.com` and send
them to your server running `node-siri`. You only need to perform one
of the following DNS procedures.

#### Using dnsmasq (Easy)

[dnsmasq](http://www.thekelleys.org.uk/dnsmasq/doc.html) is a light-
weight, easy to configure DNS forwarder and DHCP server. It is
designed to provide DNS and, optionally, DHCP, to a small network.

Where `your.ip.add.ress` is the IP address of the server running
`node-siri`, do the following:

1. Install dnsmasq
1. Edit `/etc/dnsmasq.conf` in your favorite editor
1. Add the line: `address=/guzzoni.apple.com/your.ip.add.ress`
1. Start the dnsmasq daemon
1. Under Settings on your iDevice, edit your DNS Server to be
your `dnsmasq` server.

#### Custom DNS Server (Advanced)

If you already have a DNS server on your network, simply create a zone
file for `guzzoni.apple.com` to point to your `node-siri` server.

See the `contrib/` directory for a sample zone file.

### Setup

1. Run `sudo node install.js`
1. Browse to http://guzzoni.apple.com from your iDevice.
1. Install the certificate from the link provided on the webpage.
1. Reload the webpage.
1. If everything is green, end the `install.js` process.
1. Copy `config.json.sample` to `config.json` and edit appropriately.
1. Run `sudo node examples/en-US/hello.js`
1. Activate Siri and say "Hello".

Siri should respond with "*Siri Proxy says 'Hello!'*"

#### Configuration

Configuration can come either from the command line or your
`config.json` file.

While it is recommended to keep your configuration in the file, you may
wish you temporarily change some settings while testing.  To do so, add
the argument(s) on the command line.

    sudo node examples/hello.js --debug 1 --locale zh

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

* You should be running all the commands from the main `node-siri`
directory.
* Ensure your iDevice resolves `guzzoni.apple.com` as your `node-siri`
server.
* `DEPTH_ZERO_SELF_SIGNED_CERT` : Ensure your `node-siri` server is
resolving `guzzoni.apple.com` to the internet. It should not be pointing
to itself!
* `EACCES` : Start `node` in privledged mode, e.g. (`sudo node`)

### Reporting Issues

Submit an issue on github with a [pastebin](http://pastebin.com) (or
equivilant) of the output of the following commands:

    pwd
    ls -la
    cat config.json
    cat examples/proxy.js
    openssl x509 -in keys/server-cert.pem -noout -text
    nslookup guzzoni.apple.com
    node -v
    sudo node examples/proxy.js --debug 1
