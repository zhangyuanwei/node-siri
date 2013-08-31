node-siri/contrib/
==================

## genca.sh

`genca.sh` is a shell script to re-generate the SSL certificates. It is
recommended you generate your own set of certificates rather than use
the default ones supplied.

**NOTE:** For `node-siri` to work properly, it is required that the
`Common Name:` is `guzzoni.apple.com`.  Anything else can be changed.

## guzzoni.apple.com.zone

`guzzoni.apple.com.zone` is a sample zone file for users who already
have a working DNS server in their environment.
