#!/bin/bash
openssl genrsa -out server-key.pem 1024
openssl req -new -key server-key.pem -out server-csr.pem
openssl x509 -req -days 730 -in server-csr.pem -signkey server-key.pem -out server-cert.pem
