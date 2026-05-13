// Package gamesetting parses and emits Minecraft's `options.txt` file.
//
// It mirrors the surface of the TS package `@xmcl/gamesetting`: a map
// of typed values (`map[string]any`) where each value is decoded based
// on a small grammar:
//
//   - integers          → int64
//   - floats            → float64
//   - booleans          → bool
//   - JSON arrays       → []any (typically []string for resourcePacks)
//   - everything else   → string
//
// Round-trip safety with `stringify` (gh #1379) is preserved: parse
// honours JSON's escape rules for arrays so that a parsed value
// re-encoded via Stringify produces byte-identical output. The
// fallback unquoted-array parser keeps MultiMC-style files readable.
//
// See `packages/gamesetting/index.ts` for the canonical TS reference.
package gamesetting

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Frame is the dynamic-key map representation of options.txt. Each
// value is one of: int64, float64, bool, string, or []any (for
// arrays). Callers can type-assert at the use site or run the result
// through `Get`/`MustGet`.
type Frame map[string]any

// ============================================================
// Parse
// ============================================================

var (
	intRE   = regexp.MustCompile(`^\d+$`)
	floatRE = regexp.MustCompile(`^[-+]?[0-9]*\.[0-9]+$`)
	boolRE  = regexp.MustCompile(`^(true|false)$`)
)

// Parse decodes an options.txt string into a Frame. Unknown keys are
// preserved with string values; known typed values are coerced.
func Parse(input string) Frame {
	out := Frame{}
	for _, line := range strings.Split(input, "\n") {
		i := strings.IndexByte(line, ':')
		if i == -1 {
			continue
		}
		key := line[:i]
		if key == "" {
			continue
		}
		value := strings.TrimSpace(line[i+1:])
		out[key] = decodeValue(value)
	}
	return out
}

func decodeValue(value string) any {
	switch {
	case intRE.MatchString(value):
		n, err := strconv.ParseInt(value, 10, 64)
		if err == nil {
			return n
		}
	case floatRE.MatchString(value):
		f, err := strconv.ParseFloat(value, 64)
		if err == nil {
			return f
		}
	case boolRE.MatchString(value):
		return value == "true"
	case strings.HasPrefix(value, "[") && strings.HasSuffix(value, "]"):
		return decodeArray(value)
	}
	return value
}

// decodeArray honours vanilla Minecraft's JSON-encoded arrays first,
// falling back to the MultiMC-style unquoted `[a,b c]` format if JSON
// parsing fails.
func decodeArray(value string) any {
	var asJSON []any
	if err := json.Unmarshal([]byte(value), &asJSON); err == nil {
		return asJSON
	}
	raw := value[1 : len(value)-1]
	if raw == "" {
		return []any{}
	}
	out := []any{}
	var buf strings.Builder
	inQuote := false
	for _, c := range raw {
		switch {
		case c == '"':
			inQuote = !inQuote
		case c == ',' && !inQuote:
			out = append(out, buf.String())
			buf.Reset()
		default:
			buf.WriteRune(c)
		}
	}
	if buf.Len() > 0 {
		out = append(out, buf.String())
	}
	return out
}

// ============================================================
// Stringify
// ============================================================

// Stringify emits the canonical options.txt line-by-line representation.
// `original`, when non-empty, is parsed first and only keys that are
// present in BOTH the original and the new setting are written, keeping
// custom keys the launcher doesn't know about intact (mirrors the TS
// behaviour). `eol` defaults to "\n" when empty.
func Stringify(setting Frame, original, eol string) string {
	if eol == "" {
		eol = "\n"
	}
	model := Frame{}
	if original != "" {
		model = Parse(original)
		for key := range model {
			if v, ok := setting[key]; ok {
				model[key] = v
			}
		}
	} else {
		// Copy so we don't mutate the caller's map ordering iteration.
		for k, v := range setting {
			model[k] = v
		}
	}

	keys := make([]string, 0, len(model))
	for k := range model {
		if k == "" || k == "undefined" {
			continue
		}
		keys = append(keys, k)
	}
	// Stable ordering matters for golden-test parity. Map iteration in
	// Go is randomised, so we sort lexicographically — the TS reference
	// happens to preserve insertion order, but the renderer-side
	// consumer doesn't depend on order, only field presence.
	sortStrings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		val := model[key]
		if val == nil {
			continue
		}
		parts = append(parts, encodeKV(key, val))
	}
	return strings.Join(parts, eol)
}

func encodeKV(key string, val any) string {
	switch v := val.(type) {
	case string:
		return key + ":" + EncodeUnicodeEscapes(v)
	case []any:
		// Re-encode strings inside the slice with unicode escapes so the
		// stringify ↔ parse round-trip stays stable.
		out := make([]any, len(v))
		for i, item := range v {
			if s, ok := item.(string); ok {
				out[i] = EncodeUnicodeEscapes(s)
			} else {
				out[i] = item
			}
		}
		raw, err := json.Marshal(out)
		if err != nil {
			return key + ":[]"
		}
		return key + ":" + string(raw)
	case []string:
		out := make([]string, len(v))
		for i, item := range v {
			out[i] = EncodeUnicodeEscapes(item)
		}
		raw, err := json.Marshal(out)
		if err != nil {
			return key + ":[]"
		}
		return key + ":" + string(raw)
	default:
		raw, err := json.Marshal(val)
		if err != nil {
			return ""
		}
		return key + ":" + string(raw)
	}
}

// ============================================================
// Unicode escape helpers
// ============================================================

var unicodeEscapeRE = regexp.MustCompile(`\\u([0-9a-fA-F]{4})`)

// DecodeUnicodeEscapes turns `\uXXXX` sequences back into their runes.
// Mirrors the JS-side helper of the same name.
func DecodeUnicodeEscapes(s string) string {
	return unicodeEscapeRE.ReplaceAllStringFunc(s, func(match string) string {
		var n uint32
		fmt.Sscanf(match[2:], "%x", &n)
		return string(rune(n))
	})
}

// EncodeUnicodeEscapes turns every non-ASCII rune into a `\uXXXX`
// sequence. Used by Stringify so the on-disk format stays
// ASCII-only — Minecraft reads it back via JSON.parse.
func EncodeUnicodeEscapes(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r < 0x80 {
			b.WriteRune(r)
			continue
		}
		// `\uXXXX` for the BMP, surrogate pair for supplementary planes.
		if r <= 0xFFFF {
			fmt.Fprintf(&b, "\\u%04x", r)
			continue
		}
		// Emit a surrogate pair for runes outside the BMP, matching
		// JavaScript's String.fromCharCode semantics on which the TS
		// reference depends.
		v := uint32(r) - 0x10000
		hi := 0xD800 | (v >> 10)
		lo := 0xDC00 | (v & 0x3FF)
		fmt.Fprintf(&b, "\\u%04x\\u%04x", hi, lo)
	}
	return b.String()
}

// ============================================================
// Convenience accessors
// ============================================================

// String returns the value of key as a string. Falls back to the
// supplied default when the key is missing or holds a non-string.
func (f Frame) String(key, fallback string) string {
	if v, ok := f[key].(string); ok {
		return v
	}
	return fallback
}

// Int returns the value of key as an int64. Falls back to the supplied
// default when the key is missing or holds a non-integer.
func (f Frame) Int(key string, fallback int64) int64 {
	switch v := f[key].(type) {
	case int64:
		return v
	case float64:
		return int64(v)
	}
	return fallback
}

// Float returns the value of key as a float64. Falls back to the
// supplied default when the key is missing or holds a non-numeric.
func (f Frame) Float(key string, fallback float64) float64 {
	switch v := f[key].(type) {
	case float64:
		return v
	case int64:
		return float64(v)
	}
	return fallback
}

// Bool returns the value of key as a bool.
func (f Frame) Bool(key string, fallback bool) bool {
	if v, ok := f[key].(bool); ok {
		return v
	}
	return fallback
}

// Strings returns the value of key as a []string, coercing []any when
// every element is a string.
func (f Frame) Strings(key string) []string {
	switch v := f[key].(type) {
	case []string:
		return v
	case []any:
		out := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

// ============================================================
// Local sort (avoids pulling sort just for this)
// ============================================================

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		x, j := s[i], i
		for ; j > 0 && s[j-1] > x; j-- {
			s[j] = s[j-1]
		}
		s[j] = x
	}
}
