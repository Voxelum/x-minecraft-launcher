package host

import (
	"errors"

	"github.com/zalando/go-keyring"
)

// SecretStorage abstracts the OS-native credential store.
// Mirrors `xmcl-runtime/app/SecretStorage.ts`.
type SecretStorage interface {
	Get(service, account string) (string, error)
	Put(service, account, value string) error
	Delete(service, account string) error
}

// ErrSecretNotFound is returned by Get when no secret is stored for the
// (service, account) tuple.
var ErrSecretNotFound = errors.New("secret not found")

// keyringStorage is the default SecretStorage backed by go-keyring,
// which uses Credential Manager on Windows, Keychain on macOS, and the
// Secret Service / kwallet on Linux.
type keyringStorage struct{}

// NewSecretStorage returns the default keyring-backed implementation.
func NewSecretStorage() SecretStorage {
	return &keyringStorage{}
}

func (k *keyringStorage) Get(service, account string) (string, error) {
	v, err := keyring.Get(service, account)
	if errors.Is(err, keyring.ErrNotFound) {
		return "", ErrSecretNotFound
	}
	return v, err
}

func (k *keyringStorage) Put(service, account, value string) error {
	return keyring.Set(service, account, value)
}

func (k *keyringStorage) Delete(service, account string) error {
	err := keyring.Delete(service, account)
	if errors.Is(err, keyring.ErrNotFound) {
		return nil // idempotent
	}
	return err
}
