node-siri
=========

`node-siri` is nodejs Siri Proxy.

## Installation

### NPM (Easy)

``` shell
npm install siri
```

### Git (Advanced)

``` shell
git clone https://github.com/zhangyuanwei/node-siri.git
```

## Getting Started

Installation script requires ports 80 and 443 to be open.

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
1. Edit your Settings on your iDevice
1. Point your DNS Server settings to your `dnsmasq` server.


#### Custom DNS Server (Advanced)

If you already have a DNS server on your netowrk, simply create a zone
file for `guzzoni.apple.com` to point to your `node-siri` server.

    $TTL 3600
    @       IN      SOA    ns.guzzoni.apple.com. dns.guzzoni.apple.com. (
                       1       ; serial#
                       3600    ; refresh, seconds
                       3600    ; retry, seconds
                       3600    ; expire, seconds
                       3600    ; minimum TTL, seconds
                       )
    ;
    @       IN      NS      ns.guzzoni.apple.com.
    guzzoni IN      A       ; Your Server IP
    ns      IN      A       ; Your DNS Server IP
    localhost       A       127.0.0.1

### Setup

1. Run `sudo node install.js` 
1. Browse to http://guzzoni.apple.com from your iDevice.
1. Install the certificate from the link provided on the webpage.
1. Reload the webpage.
1. If everything is green, end the `install.js` process.
1. Run `sudo node examples/en-US/hello.js
1. Activate Siri and say "Hello".

Siri should respond with "Siri Proxy says 'Hello!'"

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
