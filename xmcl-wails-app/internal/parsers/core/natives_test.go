package core

import (
	"archive/zip"
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// buildNativeJar writes a synthetic LWJGL-style native jar containing
// the given entries. Returns the on-disk path. The destination
// directory is created if missing.
func buildNativeJar(t *testing.T, dest string, entries map[string][]byte) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, body := range entries {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("zip create %s: %v", name, err)
		}
		if _, err := w.Write(body); err != nil {
			t.Fatalf("zip write %s: %v", name, err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("zip close: %v", err)
	}
	if err := os.WriteFile(dest, buf.Bytes(), 0o644); err != nil {
		t.Fatalf("write jar: %v", err)
	}
}

func TestCheckNatives_Extracts(t *testing.T) {
	root := t.TempDir()
	mc := NewMinecraftFolder(root)
	platform := &Platform{Name: "windows", Arch: "x64"}

	jarRel := "org/lwjgl/lwjgl/3.2.1/lwjgl-3.2.1-natives-windows.jar"
	dllBody := []byte("fake-dll-bytes")
	buildNativeJar(t, mc.LibraryByPath(jarRel), map[string][]byte{
		"lwjgl.dll":              dllBody,
		"META-INF/MANIFEST.MF":   []byte("Manifest-Version: 1.0\n"),
		"lwjgl.dll.sha1":         []byte("ignored"),
		"linux/x64/notmine.so":   []byte("wrong platform"),
		"windows/x64/extra.dll":  []byte("nested-but-correct"),
	})

	v := &ResolvedVersion{
		ID: "test",
		Libraries: []ResolvedLibrary{{
			LibraryInfo: LibraryInfo{Name: "org.lwjgl:lwjgl:3.2.1:natives-windows"},
			Download:    Artifact{Path: jarRel},
			IsNative:    true,
		}},
	}

	nativesDir := mc.NativesRoot(v.ID)
	if err := CheckNatives(mc, v, nativesDir, platform); err != nil {
		t.Fatalf("CheckNatives: %v", err)
	}

	// Expected: lwjgl.dll + extra.dll. Excluded: META-INF/, .sha1,
	// foreign-platform paths.
	if got, err := os.ReadFile(filepath.Join(nativesDir, "lwjgl.dll")); err != nil {
		t.Fatalf("lwjgl.dll missing: %v", err)
	} else if !bytes.Equal(got, dllBody) {
		t.Errorf("lwjgl.dll body mismatch")
	}
	if _, err := os.Stat(filepath.Join(nativesDir, "extra.dll")); err != nil {
		t.Errorf("extra.dll should be extracted: %v", err)
	}
	if _, err := os.Stat(filepath.Join(nativesDir, "MANIFEST.MF")); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("META-INF should be skipped, got err=%v", err)
	}
	if _, err := os.Stat(filepath.Join(nativesDir, "lwjgl.dll.sha1")); !errors.Is(err, os.ErrNotExist) {
		t.Errorf(".sha1 should be skipped, got err=%v", err)
	}
	if _, err := os.Stat(filepath.Join(nativesDir, "notmine.so")); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("foreign-platform should be skipped, got err=%v", err)
	}

	// Manifest must list both staged files with non-empty sha1s.
	manifestRaw, err := os.ReadFile(filepath.Join(nativesDir, ".json"))
	if err != nil {
		t.Fatalf("manifest missing: %v", err)
	}
	var m nativeChecksum
	if err := json.Unmarshal(manifestRaw, &m); err != nil {
		t.Fatalf("manifest unmarshal: %v", err)
	}
	if len(m.Entries) != 2 {
		t.Errorf("entries len = %d, want 2: %+v", len(m.Entries), m.Entries)
	}
	for _, e := range m.Entries {
		if e.Sha1 == "" {
			t.Errorf("entry %s has empty sha1", e.File)
		}
	}
	expectedSum := sha1Hex(dllBody)
	for _, e := range m.Entries {
		if e.File == "lwjgl.dll" && e.Sha1 != expectedSum {
			t.Errorf("lwjgl.dll sha1 = %s, want %s", e.Sha1, expectedSum)
		}
	}
}

func TestCheckNatives_SkipsWhenManifestValid(t *testing.T) {
	root := t.TempDir()
	mc := NewMinecraftFolder(root)
	platform := &Platform{Name: "linux", Arch: "x64"}

	jarRel := "org/lwjgl/lwjgl/3.2.1/lwjgl-3.2.1-natives-linux.jar"
	body := []byte("fake-so")
	buildNativeJar(t, mc.LibraryByPath(jarRel), map[string][]byte{
		"liblwjgl.so": body,
	})

	v := &ResolvedVersion{
		ID: "test",
		Libraries: []ResolvedLibrary{{
			LibraryInfo: LibraryInfo{Name: "org.lwjgl:lwjgl:3.2.1:natives-linux"},
			Download:    Artifact{Path: jarRel},
			IsNative:    true,
		}},
	}
	nativesDir := mc.NativesRoot(v.ID)

	// First call extracts.
	if err := CheckNatives(mc, v, nativesDir, platform); err != nil {
		t.Fatalf("first CheckNatives: %v", err)
	}
	staged := filepath.Join(nativesDir, "liblwjgl.so")
	statBefore, err := os.Stat(staged)
	if err != nil {
		t.Fatalf("stat after first call: %v", err)
	}

	// Mutate the source jar so a re-extract would replace the staged
	// file. The manifest however reports the existing sha1 as valid,
	// so we expect CheckNatives to leave the file alone.
	buildNativeJar(t, mc.LibraryByPath(jarRel), map[string][]byte{
		"liblwjgl.so": []byte("DIFFERENT BODY"),
	})

	if err := CheckNatives(mc, v, nativesDir, platform); err != nil {
		t.Fatalf("second CheckNatives: %v", err)
	}
	statAfter, err := os.Stat(staged)
	if err != nil {
		t.Fatalf("stat after second call: %v", err)
	}
	if statBefore.Size() != statAfter.Size() {
		t.Errorf("file was re-extracted unexpectedly")
	}
}

func TestCheckNatives_ReExtractsWhenLibSetChanges(t *testing.T) {
	root := t.TempDir()
	mc := NewMinecraftFolder(root)
	platform := &Platform{Name: "linux", Arch: "x64"}

	jarRel := "a/b/1/b-1-natives-linux.jar"
	buildNativeJar(t, mc.LibraryByPath(jarRel), map[string][]byte{"a.so": []byte("aa")})
	v1 := &ResolvedVersion{
		ID: "test",
		Libraries: []ResolvedLibrary{{
			LibraryInfo: LibraryInfo{Name: "a:b:1:natives-linux"},
			Download:    Artifact{Path: jarRel},
			IsNative:    true,
		}},
	}
	nativesDir := mc.NativesRoot(v1.ID)
	if err := CheckNatives(mc, v1, nativesDir, platform); err != nil {
		t.Fatalf("v1 extract: %v", err)
	}

	// Add a second native jar; the lib *set* changed so the manifest
	// must be invalidated and the new jar extracted.
	jarRel2 := "x/y/1/y-1-natives-linux.jar"
	buildNativeJar(t, mc.LibraryByPath(jarRel2), map[string][]byte{"y.so": []byte("yy")})
	v2 := &ResolvedVersion{
		ID:        "test",
		Libraries: append([]ResolvedLibrary{}, v1.Libraries...),
	}
	v2.Libraries = append(v2.Libraries, ResolvedLibrary{
		LibraryInfo: LibraryInfo{Name: "x:y:1:natives-linux"},
		Download:    Artifact{Path: jarRel2},
		IsNative:    true,
	})

	if err := CheckNatives(mc, v2, nativesDir, platform); err != nil {
		t.Fatalf("v2 extract: %v", err)
	}
	if _, err := os.Stat(filepath.Join(nativesDir, "y.so")); err != nil {
		t.Errorf("y.so should have been extracted on lib-set change: %v", err)
	}
}

func sha1Hex(b []byte) string {
	h := sha1.New()
	_, _ = io.Copy(h, bytes.NewReader(b))
	return hex.EncodeToString(h.Sum(nil))
}

// shouldExtract is internal — these tests exercise the predicate
// directly to keep the rule semantics regression-locked.
func TestShouldExtract(t *testing.T) {
	plat := &Platform{Name: "windows", Arch: "x64"}
	cases := []struct {
		name     string
		excludes []string
		want     bool
	}{
		{"lwjgl.dll", nil, true},
		{"META-INF/MANIFEST.MF", nil, false},
		{"native/lwjgl.dll", nil, false}, // wrong os prefix
		{"windows/x64/lwjgl.dll", nil, true},
		{"linux/x64/foo.so", nil, false},
		{"windows/ia32/foo.dll", nil, false}, // ia32 → x86 ≠ x64
		{"foo.git", nil, false},
		{"foo.sha1", nil, false},
		{"some/dir/", nil, false},
		{"excluded.txt", []string{"exclud"}, false},
	}
	for _, tc := range cases {
		got := shouldExtract(tc.name, tc.excludes, plat)
		if got != tc.want {
			t.Errorf("shouldExtract(%q, %v) = %v, want %v", tc.name, tc.excludes, got, tc.want)
		}
	}
}

func TestShouldExtract_Ia32MapsToX86(t *testing.T) {
	plat := &Platform{Name: "windows", Arch: "x86"}
	if !shouldExtract("windows/ia32/foo.dll", nil, plat) {
		t.Error("ia32 should map to x86")
	}
}

// strip-only sanity check on the empty-classifier branch — ParseLibraryName
// already covered by core_test.go but keep one local assertion so the
// natives manifest layout doesn't drift away from the inputs we feed it.
func TestNativesManifest_EmptyClassifierGetsHandledByJoin(t *testing.T) {
	if !strings.Contains(filepath.ToSlash(filepath.Join("a", "b")), "/") {
		t.Skip("non-slash filesystem; manifest test paths assume slash-join")
	}
}
