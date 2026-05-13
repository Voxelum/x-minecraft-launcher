package core

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func writeFile(t *testing.T, path string, body []byte) string {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, body, 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	return path
}

func TestCheckVersion_NoSha1ChecksExistence(t *testing.T) {
	root := t.TempDir()
	mc := NewMinecraftFolder(root)
	v := &ResolvedVersion{ID: "1.20", MinecraftVersion: "1.20"}

	// Missing — should fail with the typed error.
	missingErr := CheckVersion(mc, v)
	if missingErr == nil {
		t.Fatal("expected error for missing jar")
	}
	var cve *CorruptedVersionJarError
	if !errors.As(missingErr, &cve) {
		t.Errorf("expected CorruptedVersionJarError, got %T", missingErr)
	}

	// Present — should pass.
	writeFile(t, mc.VersionJar("1.20", ""), []byte("fake-jar"))
	if err := CheckVersion(mc, v); err != nil {
		t.Fatalf("expected pass, got %v", err)
	}
}

func TestCheckVersion_BadSha1(t *testing.T) {
	root := t.TempDir()
	mc := NewMinecraftFolder(root)

	body := []byte("fake-jar")
	writeFile(t, mc.VersionJar("1.20", ""), body)

	v := &ResolvedVersion{
		ID:               "1.20",
		MinecraftVersion: "1.20",
		Downloads: map[string]*Download{
			"client": {SHA1: "deadbeef" + "00000000000000000000000000000000"},
		},
	}
	err := CheckVersion(mc, v)
	if err == nil {
		t.Fatal("expected error for sha1 mismatch")
	}
	var cve *CorruptedVersionJarError
	if !errors.As(err, &cve) {
		t.Errorf("expected CorruptedVersionJarError, got %T", err)
	}
}

func TestCheckVersion_GoodSha1(t *testing.T) {
	root := t.TempDir()
	mc := NewMinecraftFolder(root)

	body := []byte("fake-jar contents")
	writeFile(t, mc.VersionJar("1.20", ""), body)
	sum := sha1Hex(body)

	v := &ResolvedVersion{
		ID:               "1.20",
		MinecraftVersion: "1.20",
		Downloads: map[string]*Download{
			"client": {SHA1: sum},
		},
	}
	if err := CheckVersion(mc, v); err != nil {
		t.Fatalf("expected pass, got %v", err)
	}
}

func TestCheckLibraries_ReportsMissing(t *testing.T) {
	root := t.TempDir()
	mc := NewMinecraftFolder(root)

	good := []byte("good-lib")
	goodPath := "a/b/1/b-1.jar"
	writeFile(t, mc.LibraryByPath(goodPath), good)

	v := &ResolvedVersion{
		ID: "test",
		Libraries: []ResolvedLibrary{
			{
				LibraryInfo: LibraryInfo{Name: "a:b:1"},
				Download:    Artifact{Path: goodPath, Download: Download{SHA1: sha1Hex(good)}},
			},
			{
				LibraryInfo: LibraryInfo{Name: "x:y:1"},
				Download:    Artifact{Path: "x/y/1/y-1.jar", Download: Download{SHA1: "ignored"}},
			},
		},
	}
	err := CheckLibraries(mc, v)
	if err == nil {
		t.Fatal("expected MissingLibrariesError")
	}
	var mle *MissingLibrariesError
	if !errors.As(err, &mle) {
		t.Fatalf("expected MissingLibrariesError, got %T", err)
	}
	if len(mle.Libraries) != 1 || mle.Libraries[0].Name != "x:y:1" {
		t.Errorf("missing list = %+v", mle.Libraries)
	}
}

func TestCheckLibraries_AllPresent(t *testing.T) {
	root := t.TempDir()
	mc := NewMinecraftFolder(root)

	body := []byte("lib")
	relPath := "a/b/1/b-1.jar"
	writeFile(t, mc.LibraryByPath(relPath), body)

	v := &ResolvedVersion{
		ID: "test",
		Libraries: []ResolvedLibrary{{
			LibraryInfo: LibraryInfo{Name: "a:b:1"},
			Download:    Artifact{Path: relPath, Download: Download{SHA1: sha1Hex(body)}},
		}},
	}
	if err := CheckLibraries(mc, v); err != nil {
		t.Errorf("expected pass, got %v", err)
	}
}

func TestCheckLibraries_EmptySha1IsExistenceOnly(t *testing.T) {
	root := t.TempDir()
	mc := NewMinecraftFolder(root)

	relPath := "a/b/1/b-1.jar"
	writeFile(t, mc.LibraryByPath(relPath), []byte("anything"))

	v := &ResolvedVersion{
		ID: "test",
		Libraries: []ResolvedLibrary{{
			LibraryInfo: LibraryInfo{Name: "a:b:1"},
			Download:    Artifact{Path: relPath /* SHA1 empty */},
		}},
	}
	if err := CheckLibraries(mc, v); err != nil {
		t.Errorf("empty sha1 + present file should pass, got %v", err)
	}
}

func TestCheckJava_Missing(t *testing.T) {
	err := CheckJava(filepath.Join(t.TempDir(), "no-such-java"))
	if err == nil {
		t.Fatal("expected error")
	}
	var mje *MissingJavaError
	if !errors.As(err, &mje) {
		t.Errorf("expected MissingJavaError, got %T", err)
	}
}

func TestCheckJava_Empty(t *testing.T) {
	err := CheckJava("")
	if err == nil {
		t.Fatal("expected error")
	}
	var mje *MissingJavaError
	if !errors.As(err, &mje) {
		t.Errorf("expected MissingJavaError, got %T", err)
	}
}

func TestCheckJava_Present(t *testing.T) {
	dir := t.TempDir()
	name := "java"
	if runtime.GOOS == "windows" {
		name = "java.exe"
	}
	path := filepath.Join(dir, name)
	writeFile(t, path, []byte("#!/bin/sh\nexit 0\n"))
	if err := CheckJava(path); err != nil {
		t.Errorf("expected pass, got %v", err)
	}
}

func TestCheckJava_DirectoryRejected(t *testing.T) {
	dir := t.TempDir()
	err := CheckJava(dir)
	if err == nil {
		t.Fatal("expected error for directory path")
	}
	var mje *MissingJavaError
	if !errors.As(err, &mje) {
		t.Errorf("expected MissingJavaError, got %T", err)
	}
}

func TestLinkAssets_NoOpForNewVersions(t *testing.T) {
	mc := NewMinecraftFolder(t.TempDir())
	v := &ResolvedVersion{ID: "1.20", Assets: "5"}
	if err := LinkAssets(mc, v); err != nil {
		t.Errorf("expected no-op, got %v", err)
	}
}

func TestLinkAssets_StagesLegacyIndex(t *testing.T) {
	root := t.TempDir()
	mc := NewMinecraftFolder(root)
	v := &ResolvedVersion{ID: "legacy", Assets: "legacy"}

	// Asset object on disk under assets/objects/aa/aabbcc...
	hash := "aabbcc1234567890abcdef0123456789abcdef01"
	body := []byte("hello.txt body")
	writeFile(t, mc.Asset(hash), body)

	// Asset index naming "lang/en_us.txt" → that file
	indexBody := []byte(`{"objects":{"lang/en_us.txt":{"hash":"` + hash + `","size":13}}}`)
	writeFile(t, mc.AssetsIndex("legacy"), indexBody)

	if err := LinkAssets(mc, v); err != nil {
		t.Fatalf("LinkAssets: %v", err)
	}
	staged := filepath.Join(root, "assets", "virtual", "legacy", "lang", "en_us.txt")
	got, err := os.ReadFile(staged)
	if err != nil {
		t.Fatalf("staged file missing: %v", err)
	}
	if string(got) != string(body) {
		t.Errorf("staged body = %q, want %q", got, body)
	}
}
