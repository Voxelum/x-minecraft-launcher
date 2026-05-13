// hash.go — file content hashing helpers used by the manager.
//
//   - SHA1OfFile      — streaming sha1 (matches `crypto/sha1`).
//   - SHA256OfFile    — streaming sha256.
//   - Fingerprint     — CurseForge "Murmur2" implementation. The
//                       file content is normalised by stripping
//                       whitespace bytes (\t, \n, \r, space) before
//                       hashing, then MurmurHash2 is run with seed=1.
//                       Used for CurseForge fingerprint matching.
//
// All three accept a path so callers don't have to manage *os.File
// handles. The streaming variants buffer at 64 KiB.

package resource

import (
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"hash"
	"io"
	"os"
)

// SHA1OfFile streams the file at `path` through SHA1 and returns
// the lowercase-hex digest.
func SHA1OfFile(path string) (string, error) {
	return hashFile(path, sha1.New())
}

// SHA256OfFile streams the file at `path` through SHA256.
func SHA256OfFile(path string) (string, error) {
	return hashFile(path, sha256.New())
}

func hashFile(path string, h hash.Hash) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// Fingerprint computes CurseForge's Murmur2 fingerprint of the file
// at `path`. See `xmcl-runtime/resource/fingerprint.ts` for the
// reference implementation.
//
// The algorithm:
//
//  1. Read the entire file content.
//  2. Strip every whitespace byte: 0x09 (tab), 0x0A (LF),
//     0x0D (CR), 0x20 (space). The TS reference does this in-place
//     via a swap loop; we materialise a new buffer because it's
//     simpler and the savings are negligible.
//  3. Murmur2 32-bit (variant `m=0x5BD1E995`, `r=24`) with
//     seed = 1.
//
// Returns the fingerprint as an unsigned 32-bit integer (returned
// as int64 so it fits cleanly into JSON / SQLite without
// negative-number gymnastics).
func Fingerprint(path string) (int64, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	return fingerprintBytes(data), nil
}

// fingerprintBytes is split out so unit tests can hash an in-memory
// buffer without writing it to disk.
func fingerprintBytes(buf []byte) int64 {
	stripped := stripWhitespace(buf)
	return int64(murmur2(stripped, 1))
}

// stripWhitespace returns a buffer with every \t, \n, \r and space
// byte removed. Mirrors the TS reference's `normalizeBuffer`.
func stripWhitespace(in []byte) []byte {
	out := make([]byte, 0, len(in))
	for _, b := range in {
		switch b {
		case 0x09, 0x0A, 0x0D, 0x20:
			continue
		}
		out = append(out, b)
	}
	return out
}

// murmur2 implements MurmurHash2A_32 with the standard m/r magic
// numbers. Bit-for-bit match with the JavaScript implementation in
// `@xmcl/curseforge`'s `murmur2` function.
func murmur2(data []byte, seed uint32) uint32 {
	const m = uint32(0x5BD1E995)
	const r = 24
	length := uint32(len(data))
	h := seed ^ length
	i := 0
	for length >= 4 {
		k := uint32(data[i]) |
			uint32(data[i+1])<<8 |
			uint32(data[i+2])<<16 |
			uint32(data[i+3])<<24
		k *= m
		k ^= k >> r
		k *= m
		h *= m
		h ^= k
		i += 4
		length -= 4
	}
	switch length {
	case 3:
		h ^= uint32(data[i+2]) << 16
		fallthrough
	case 2:
		h ^= uint32(data[i+1]) << 8
		fallthrough
	case 1:
		h ^= uint32(data[i])
		h *= m
	}
	h ^= h >> 13
	h *= m
	h ^= h >> 15
	return h
}

// errSizeOverflow is reserved for callers that want to validate the
// file fits the 32-bit fingerprint algorithm bounds.
var errSizeOverflow = errors.New("resource: file too large for fingerprint")
