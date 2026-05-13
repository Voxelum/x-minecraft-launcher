package nbt

import (
	"reflect"
	"testing"
)

// fixture mirrors the TS reference's `TestType` field-for-field. The
// nested compounds and lists are spelled out as map literals + List
// wrappers so the round-trip test exercises every coder.
func fixture() map[string]any {
	return map[string]any{
		"name":      "ci010",
		"type":      "author",
		"byte":      int8(10),
		"short":     int16(10),
		"int":       int32(10),
		"long":      int64(132),
		"float":     float32(0.25),
		"double":    float64(0.00001),
		"longArray": []int64{8589934593},
		"byteArray": []int8{1, 1},
		"intArray":  []int32{12, 3, 4, 512},
		"nestedAnonymous": map[string]any{
			"name":  "indexyz",
			"type":  "author",
			"value": "ilauncher",
		},
		"nested": map[string]any{
			"hello": "s",
		},
		"compoundList": NewList(TagCompound, []any{
			map[string]any{"hello": "s"},
			map[string]any{"hello": "s"},
		}),
		"intList": NewList(TagInt, []any{int32(1), int32(23)}),
	}
}

func TestRoundTripUncompressed(t *testing.T) {
	src := fixture()
	buf, err := Write(src, None, "")
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	got, err := Read(buf, None)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if !reflect.DeepEqual(got, src) {
		t.Errorf("round-trip mismatch\n got: %#v\nwant: %#v", got, src)
	}
}

func TestRoundTripGzip(t *testing.T) {
	src := fixture()
	buf, err := Write(src, Gzip, "")
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	// gzip magic
	if len(buf) < 2 || buf[0] != 0x1f || buf[1] != 0x8b {
		t.Errorf("expected gzip magic, got % x", buf[:min(2, len(buf))])
	}
	got, err := Read(buf, Gzip)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if !reflect.DeepEqual(got, src) {
		t.Errorf("gzip round-trip mismatch")
	}
}

func TestRoundTripZlib(t *testing.T) {
	src := fixture()
	buf, err := Write(src, Zlib, "")
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	got, err := Read(buf, Zlib)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if !reflect.DeepEqual(got, src) {
		t.Errorf("zlib round-trip mismatch")
	}
}

func TestNamedRoot(t *testing.T) {
	src := map[string]any{"hello": "world"}
	buf, err := Write(src, None, "level")
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	name, got, err := ReadNamed(buf, None)
	if err != nil {
		t.Fatalf("ReadNamed: %v", err)
	}
	if name != "level" {
		t.Errorf("root name = %q, want %q", name, "level")
	}
	if !reflect.DeepEqual(got, src) {
		t.Errorf("payload = %v, want %v", got, src)
	}
}

func TestEmptyCompound(t *testing.T) {
	src := map[string]any{}
	buf, err := Write(src, None, "")
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	got, err := Read(buf, None)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("empty compound = %v", got)
	}
}

func TestEmptyList(t *testing.T) {
	// A list with no items still writes an element-type byte; reading
	// must give us back the same element type so subsequent writes know
	// what to emit.
	src := map[string]any{
		"empty": NewList(TagString, []any{}),
	}
	buf, err := Write(src, None, "")
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	got, err := Read(buf, None)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	l, ok := got["empty"].(*List)
	if !ok {
		t.Fatalf("empty = %T, want *List", got["empty"])
	}
	if l.ElementType != TagString {
		t.Errorf("ElementType = %d, want %d", l.ElementType, TagString)
	}
	if len(l.Items) != 0 {
		t.Errorf("Items = %v, want empty", l.Items)
	}
}

func TestStringWithMultiByteRunes(t *testing.T) {
	// `§` is U+00A7 (2 bytes in UTF-8) — covers the most common chat-
	// formatting code path. The fixture also exercises a CJK rune
	// (3 bytes) just to lock in BMP coverage.
	src := map[string]any{
		"section": "§4hello",
		"cjk":     "你好",
	}
	buf, err := Write(src, None, "")
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	got, err := Read(buf, None)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if got["section"] != src["section"] {
		t.Errorf("section = %q, want %q", got["section"], src["section"])
	}
	if got["cjk"] != src["cjk"] {
		t.Errorf("cjk = %q, want %q", got["cjk"], src["cjk"])
	}
}

func TestRejectNonCompoundRoot(t *testing.T) {
	// A bare TagByte at root should be rejected.
	bad := []byte{TagByte, 0, 0, 0x42}
	if _, err := Read(bad, None); err == nil {
		t.Errorf("expected error reading non-compound root")
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
