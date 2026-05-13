// Package offline ports the small offline-account helper from
// `packages/user/offline.ts` + `packages/user-offline-uuid/`. Used by
// the Dev / offline auth path inside UserService.
package offline

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"

	"github.com/google/uuid"
)

// GetOfflineUUID returns the deterministic UUID v3 derived from
// "OfflinePlayer:<username>" — matches the behaviour of the Notchian
// server's offline-mode player UUID generator.
//
// Mirrors `packages/user-offline-uuid/index.ts`.
func GetOfflineUUID(username string) string {
	hash := md5.Sum([]byte("OfflinePlayer:" + username))
	hash[6] = (hash[6] & 0x0f) | 0x30 // version 3
	hash[8] = (hash[8] & 0x3f) | 0x80 // IETF variant
	hex := hex.EncodeToString(hash[:])
	return fmt.Sprintf("%s-%s-%s-%s-%s", hex[0:8], hex[8:12], hex[12:16], hex[16:20], hex[20:32])
}

// NewToken returns a UUID v4 hex (no dashes) — used as the in-memory
// access / client token for offline accounts (matches the TS impl).
func NewToken() string {
	id := uuid.New()
	hex := make([]byte, 32)
	for i, b := range id {
		hex[i*2] = hexChar(b >> 4)
		hex[i*2+1] = hexChar(b & 0xf)
	}
	return string(hex)
}

func hexChar(b byte) byte {
	if b < 10 {
		return '0' + b
	}
	return 'a' + (b - 10)
}
