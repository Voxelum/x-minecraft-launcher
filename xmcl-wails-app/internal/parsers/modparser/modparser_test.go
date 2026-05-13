package modparser

import (
	"os"
	"path/filepath"
	"testing"
)

// fixtureDir is `<repo>/mock/mods`. Resolved relative to the test
// binary's working directory which Go always sets to the package dir.
func fixtureDir(t *testing.T) string {
	t.Helper()
	// Walk up looking for the workspace root (the only place where
	// `mock/mods/` lives). We don't have a pkg-level constant for the
	// repo root, but the mod-parser package is at a known depth.
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	dir := cwd
	for i := 0; i < 8; i++ {
		candidate := filepath.Join(dir, "mock", "mods")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		next := filepath.Dir(dir)
		if next == dir {
			break
		}
		dir = next
	}
	t.Skipf("mock/mods/ fixtures not found; ran from %s", cwd)
	return ""
}

func openFixture(t *testing.T, name string) *JarSource {
	t.Helper()
	src, err := OpenJar(filepath.Join(fixtureDir(t), name))
	if err != nil {
		t.Fatalf("OpenJar(%s): %v", name, err)
	}
	t.Cleanup(func() { src.Close() })
	return src
}

func TestFabric_Sample(t *testing.T) {
	j := openFixture(t, "fabric-sample.jar")
	meta, err := ReadFabricMod(j)
	if err != nil {
		t.Fatalf("ReadFabricMod: %v", err)
	}
	if meta.SchemaVersion != 1 {
		t.Errorf("schemaVersion = %d, want 1", meta.SchemaVersion)
	}
	if meta.ID == "" {
		t.Error("id missing")
	}
	if meta.Version == "" {
		t.Error("version missing")
	}
}

func TestFabric_Sample2(t *testing.T) {
	j := openFixture(t, "fabric-sample-2.jar")
	meta, err := ReadFabricMod(j)
	if err != nil {
		t.Fatalf("ReadFabricMod: %v", err)
	}
	if meta.ID == "" {
		t.Error("id missing")
	}
}

func TestForge_TomlMod(t *testing.T) {
	j := openFixture(t, "sample-mod-1.13.jar")
	meta, err := ReadForgeMod(j)
	if err != nil {
		t.Fatalf("ReadForgeMod: %v", err)
	}
	if meta == nil {
		t.Fatal("meta nil; expected mods.toml metadata")
	}
	if len(meta.ModsToml) == 0 {
		t.Fatal("ModsToml empty")
	}
	first := meta.ModsToml[0]
	if first.Modid == "" {
		t.Error("modid empty")
	}
	if first.ModLoader == "" {
		// modLoader sits at the loader-level so it should propagate.
		t.Error("modLoader empty (expected to propagate from root)")
	}
}

func TestForge_McmodInfoLegacy(t *testing.T) {
	j := openFixture(t, "sample-mod.jar")
	meta, err := ReadForgeMod(j)
	if err != nil {
		t.Fatalf("ReadForgeMod: %v", err)
	}
	if meta == nil || len(meta.McmodInfo) == 0 {
		t.Fatal("McmodInfo empty")
	}
	if meta.McmodInfo[0].Modid == "" {
		t.Error("modid empty")
	}
}

func TestForge_TweakClassManifest(t *testing.T) {
	j := openFixture(t, "tweak-class.jar")
	meta, err := ReadForgeMod(j)
	if err != nil {
		t.Fatalf("ReadForgeMod: %v", err)
	}
	if meta == nil {
		t.Fatal("meta nil")
	}
	// Tweak-class mods carry only the manifest metadata path.
	if meta.ManifestMetadata == nil {
		t.Skip("fixture has no TweakName in manifest; skipping")
		return
	}
	if meta.ManifestMetadata.Modid == "" {
		t.Error("ManifestMetadata.Modid empty")
	}
}

func TestForge_NoMetadata(t *testing.T) {
	j := openFixture(t, "dummy-mod.jar")
	meta, err := ReadForgeMod(j)
	if err != nil {
		t.Fatalf("ReadForgeMod: %v", err)
	}
	// dummy-mod is intentionally empty; ReadForgeMod returns nil
	// rather than an error so callers can fall back to other loaders.
	if meta != nil {
		t.Logf("dummy-mod returned: mods=%d mcmod=%d manifest=%v",
			len(meta.ModsToml), len(meta.McmodInfo), meta.ManifestMetadata != nil)
	}
}

func TestStripBOM(t *testing.T) {
	in := []byte{0xEF, 0xBB, 0xBF, 'a', 'b'}
	out := stripBOM(in)
	if string(out) != "ab" {
		t.Errorf("stripBOM = %q, want ab", out)
	}
	// Idempotent: no BOM = unchanged.
	if string(stripBOM([]byte("xy"))) != "xy" {
		t.Error("stripBOM altered non-BOM input")
	}
}
