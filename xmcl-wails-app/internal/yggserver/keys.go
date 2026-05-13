package yggserver

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/x509"
	"encoding/pem"
	"errors"
)

// keyPair holds the RSA pair the server uses to sign texture properties.
// We embed the same hardcoded pair the TS impl ships so authlib-injector
// users built against either Electron or Wails see consistent keys —
// the public key is exposed through the server metadata endpoint and
// vanilla launchers cache it.
type keyPair struct {
	priv      *rsa.PrivateKey
	PublicPEM string
}

func newKeyPair(privPEM, pubPEM string) (*keyPair, error) {
	block, _ := pem.Decode([]byte(privPEM))
	if block == nil {
		return nil, errors.New("yggserver: invalid private key PEM")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	priv, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("yggserver: private key is not RSA")
	}
	return &keyPair{priv: priv, PublicPEM: pubPEM}, nil
}

// SignSHA1 returns the PKCS#1 v1.5 RSA signature of `data` over SHA-1
// (the algorithm Mojang's protocol mandates for texture properties).
func (k *keyPair) SignSHA1(data []byte) ([]byte, error) {
	h := sha1.Sum(data)
	return rsa.SignPKCS1v15(rand.Reader, k.priv, crypto.SHA1, h[:])
}

// defaultKeys is the shared key pair (loaded once at package init).
var defaultKeys = mustKeyPair(privatePEM, publicPEM)

func mustKeyPair(priv, pub string) *keyPair {
	kp, err := newKeyPair(priv, pub)
	if err != nil {
		panic("yggserver: bad embedded key: " + err.Error())
	}
	return kp
}

// publicPEM mirrors xmcl-runtime/yggdrasilServer/pluginYggdrasilHandler.ts.
const publicPEM = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA0IkXN4USVBJvzrA3vi8y
ANUEUh9PMmPSWwFS5JccwlDZvw5ymMPuB8S69d6p4I8Ij6lkQkg8izTr3njJ4Z5k
elDH+zClzv/LuYnEvUzaA0aGwHoH4sDUeUm34bK44By/6/ZoImKfDJmjfN/0lEOQ
wZJL1vtDNAseSkZRPxUgBydhVqNBX9SYSfl2M5CBz8QHRe8hCI3QAMaFfqDu3uTJ
0lPJ1HZRCTXHAMgiB2ArdgtU7rx1emga/o8Dx3LU/lV+FuKM94xaRFSreMZWluz1
EjGcsC6je1Ah89aO0jYIHlOxzc1LB2uZaWryBaZ86uxL7EA7qyZG+mV6Y0sq7lSm
UOYQiPInkHfEYrj+VA2gLZPP7mlNv8Xlo5cDvEaQL5Z8vOoB4xi8cY8vXSmAOR5g
eNtkm0NXT5GbZgP1NkkgFhnE4NUrjO44TzjC5enI9wfe0pOZY0k4bHY6crQwL9Rc
tLSHz321FnYF85+yPZWU3DhsGnmfGV9rJJ2h/Fr3k85iD/0ohyWDneZECOsP2EKH
6+L5JEcnejfvQW5S2s0M50np86Pu5gZ+c1pWTWomv5LgwFvARDRu1uFICh1RiCsv
x6Ww85HYoQ8dJMiVIDMLe4+Zzext+08u2dM86/Mwpj/1yBzGTBw2t8y/2j8OWYi9
h57uqbTpmpcI8dftnJdl3osCAwEAAQ==
-----END PUBLIC KEY-----`

const privatePEM = `-----BEGIN PRIVATE KEY-----
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
kFD4vQNojkO8caKjNI1ojGzl9BpEFYuk
-----END PRIVATE KEY-----`
