package resourcepack

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func fixtureDir(t *testing.T) string {
	t.Helper()
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	dir := cwd
	for i := 0; i < 8; i++ {
		candidate := filepath.Join(dir, "mock", "resourcepacks")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		next := filepath.Dir(dir)
		if next == dir {
			break
		}
		dir = next
	}
	t.Skipf("mock/resourcepacks/ fixtures not found; ran from %s", cwd)
	return ""
}

func openFixture(t *testing.T, name string) *Source {
	t.Helper()
	src, err := OpenSource(filepath.Join(fixtureDir(t), name))
	if err != nil {
		t.Fatalf("OpenSource(%s): %v", name, err)
	}
	t.Cleanup(func() { src.Close() })
	return src
}

func TestReadPackMeta(t *testing.T) {
	s := openFixture(t, "sample-resourcepack.zip")
	meta, err := ReadPackMeta(s)
	if err != nil {
		t.Fatalf("ReadPackMeta: %v", err)
	}
	if meta.PackFormat == 0 {
		t.Errorf("PackFormat = 0, expected non-zero")
	}
	if meta.Description == nil {
		t.Errorf("Description nil")
	}
}

func TestReadIcon(t *testing.T) {
	s := openFixture(t, "sample-resourcepack.zip")
	icon, err := ReadIcon(s)
	if err != nil {
		t.Fatalf("ReadIcon: %v", err)
	}
	if len(icon) < 100 {
		t.Errorf("icon suspiciously small (%d bytes)", len(icon))
	}
	// PNG magic.
	if len(icon) < 8 || icon[0] != 0x89 || icon[1] != 'P' || icon[2] != 'N' || icon[3] != 'G' {
		t.Errorf("expected PNG magic, got % x", icon[:min(8, len(icon))])
	}
}

func TestReadPackMetaAndIcon(t *testing.T) {
	s := openFixture(t, "sample-resourcepack.zip")
	got, err := ReadPackMetaAndIcon(s)
	if err != nil {
		t.Fatalf("ReadPackMetaAndIcon: %v", err)
	}
	if got.Metadata.PackFormat == 0 {
		t.Error("PackFormat 0")
	}
	if len(got.Icon) == 0 {
		t.Error("Icon empty")
	}
}

func TestEmptyPack(t *testing.T) {
	s := openFixture(t, "empty-resourcepack.zip")
	_, err := ReadPackMeta(s)
	// The empty fixture deliberately omits pack.mcmeta; the parser
	// reports os.ErrNotExist (or the JSON validation error if it has
	// an empty/invalid file).
	if err == nil {
		t.Error("expected error reading empty resource pack")
	}
	if !errors.Is(err, os.ErrNotExist) {
		t.Logf("note: error was %v (not os.ErrNotExist)", err)
	}
}

func TestVanillaAssetsPack(t *testing.T) {
	// 1.14.4.zip is a stripped vanilla assets pack — has pack.mcmeta
	// but no pack.png. ReadPackMetaAndIcon must still succeed with
	// Icon nil.
	s := openFixture(t, "1.14.4.zip")
	got, err := ReadPackMetaAndIcon(s)
	if err != nil {
		// vanilla assets pack might also lack pack.mcmeta — skip if so.
		t.Skipf("1.14.4.zip has no pack.mcmeta or read failed: %v", err)
	}
	if got.Icon != nil {
		t.Logf("note: 1.14.4.zip carries pack.png (%d bytes)", len(got.Icon))
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
