// Package core — natives extraction (port of `@xmcl/core`'s
// `LaunchPrecheck.checkNatives`).
//
// At launch time the JVM needs the platform-specific native libraries
// (LWJGL .dll/.so/.dylib, etc.) staged in a single directory passed via
// `-Djava.library.path=…`. Mojang ships those natives as classifier
// jars under `libraries/`; this file unpacks the entries that match the
// current platform into `<version>-natives/` and remembers the staged
// content via a `.json` checksum file so subsequent launches skip the
// work when the on-disk files are still valid.

package core

import (
	"archive/zip"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// nativeChecksumFile is the marker dropped at the root of the
// `<version>-natives/` directory recording the libraries that produced
// the staged files plus per-file sha1s. Matches the TS layout exactly
// so a launcher that already has staged natives from the legacy
// codebase continues to skip the extraction.
const nativeChecksumFile = ".json"

// nativeChecksum is the on-disk record. Field names match the TS shape
// so existing files round-trip without rewrites.
type nativeChecksum struct {
	Entries   []nativeChecksumEntry `json:"entries"`
	Libraries []string              `json:"libraries"`
}

type nativeChecksumEntry struct {
	File string `json:"file"`
	Sha1 string `json:"sha1"`
	Name string `json:"name"`
}

// CheckNatives ensures `<nativeRoot>/` is populated with the native
// files for `version` on `platform`. When `platform` is nil the host
// platform is used.
//
// Behaviour mirrors the TS reference:
//   - First call walks every native library jar and extracts the
//     entries that pass the rule + arch + extract-exclude filters.
//   - Subsequent calls validate existing files via sha1 against the
//     checksum manifest and only re-extract what's missing or
//     corrupted.
//   - When the *set* of native libraries changes (e.g. user switched
//     versions), the manifest is invalidated and all natives are
//     re-extracted.
//
// Errors from individual jars are collected; a multi-error is returned
// when more than one jar fails so the launcher can decide whether to
// abort or warn.
func CheckNatives(mc MinecraftFolder, version *ResolvedVersion, nativeRoot string, platform *Platform) error {
	if version == nil {
		return errors.New("CheckNatives: nil version")
	}
	if nativeRoot == "" {
		nativeRoot = mc.NativesRoot(version.ID)
	}
	if platform == nil {
		p := CurrentPlatform()
		platform = &p
	}
	if err := os.MkdirAll(nativeRoot, 0o755); err != nil {
		return fmt.Errorf("CheckNatives: mkdir %s: %w", nativeRoot, err)
	}

	natives := nativeLibraries(version)
	if len(natives) == 0 {
		return nil
	}

	includedLibs := make([]string, len(natives))
	for i, n := range natives {
		includedLibs[i] = n.Name
	}
	sort.Strings(includedLibs)

	manifestPath := filepath.Join(nativeRoot, nativeChecksumFile)
	prev, _ := loadNativeChecksum(manifestPath)

	// If the recorded library set matches, only re-extract jars whose
	// staged files are missing or whose sha1 mismatches.
	if prev != nil && libSetMatches(prev.Libraries, includedLibs) {
		valid := map[string]bool{}
		for _, e := range prev.Entries {
			if e.File == "" {
				continue
			}
			if validateSha1(filepath.Join(nativeRoot, e.File), e.Sha1) {
				valid[e.Name] = true
			}
		}
		var missing []ResolvedLibrary
		for _, n := range natives {
			if !valid[n.Name] {
				missing = append(missing, n)
			}
		}
		if len(missing) == 0 {
			return nil
		}
		return extractAll(mc, version, nativeRoot, platform, missing, /*regenManifest*/ false, prev)
	}

	// Cold path: extract everything, then write a fresh manifest.
	return extractAll(mc, version, nativeRoot, platform, natives, /*regenManifest*/ true, &nativeChecksum{Libraries: includedLibs})
}

// extractAll runs extractNativeJar on every library and (optionally)
// rewrites the on-disk checksum manifest. Errors per library are
// collected via errors.Join so partial extracts still surface every
// problem to the caller.
func extractAll(mc MinecraftFolder, version *ResolvedVersion, nativeRoot string, platform *Platform, libs []ResolvedLibrary, regenManifest bool, base *nativeChecksum) error {
	var errs []error
	staged := base.Entries // when not regenerating we append to existing

	for _, lib := range libs {
		entries, err := extractNativeJar(mc, version, nativeRoot, platform, lib)
		if err != nil {
			errs = append(errs, fmt.Errorf("extract %s: %w", lib.Name, err))
			continue
		}
		// Drop any prior entries for this library before appending the
		// fresh set so the manifest stays consistent with what's on
		// disk.
		staged = filterOutLibrary(staged, lib.Name)
		staged = append(staged, entries...)
	}

	if regenManifest || len(staged) != len(base.Entries) {
		manifest := &nativeChecksum{
			Entries:   staged,
			Libraries: base.Libraries,
		}
		// Compute fresh sha1s for any entry that lacks one (cold path
		// records empty sha1s during extract for batching).
		for i := range manifest.Entries {
			if manifest.Entries[i].Sha1 != "" {
				continue
			}
			sum, err := sha1File(filepath.Join(nativeRoot, manifest.Entries[i].File))
			if err == nil {
				manifest.Entries[i].Sha1 = sum
			}
		}
		if err := saveNativeChecksum(filepath.Join(nativeRoot, nativeChecksumFile), manifest); err != nil {
			errs = append(errs, fmt.Errorf("save manifest: %w", err))
		}
	}

	return errors.Join(errs...)
}

// extractNativeJar opens one library jar and writes every matching
// entry into `nativeRoot`. Returns the list of files written so the
// caller can record them in the checksum manifest.
func extractNativeJar(mc MinecraftFolder, version *ResolvedVersion, nativeRoot string, platform *Platform, lib ResolvedLibrary) ([]nativeChecksumEntry, error) {
	if lib.Download.Path == "" {
		return nil, fmt.Errorf("library %s (%s) has no download path", lib.Name, version.ID)
	}
	jarPath := mc.LibraryByPath(lib.Download.Path)
	r, err := zip.OpenReader(jarPath)
	if err != nil {
		return nil, fmt.Errorf("open jar %s: %w", jarPath, err)
	}
	defer r.Close()

	var entries []nativeChecksumEntry
	for _, f := range r.File {
		if !shouldExtract(f.Name, lib.ExtractExclude, platform) {
			continue
		}
		// Mojang's native jars are flat — basename is the staged file
		// name. Some Forge / community jars place natives under
		// subdirectories matching `<os>/<arch>/`; the `isSatisfyPlatform`
		// rule already pinned us to ours, so a flat dest is correct.
		fileName := filepath.Base(f.Name)
		if fileName == "" || fileName == "." {
			continue
		}
		dest := filepath.Join(nativeRoot, fileName)
		if err := writeZipEntry(f, dest); err != nil {
			return nil, fmt.Errorf("write %s: %w", fileName, err)
		}
		entries = append(entries, nativeChecksumEntry{File: fileName, Name: lib.Name})
	}
	return entries, nil
}

// shouldExtract mirrors the TS predicate stack in `extractJar`:
//   - skip anything under META-INF/
//   - skip *.sha1 / *.git markers
//   - skip directory entries
//   - skip entries the library's `extract.exclude` field matches
//   - skip entries whose `<os>/<arch>/…` prefix doesn't match the
//     current platform.
func shouldExtract(name string, excludes []string, platform *Platform) bool {
	if name == "" || strings.HasSuffix(name, "/") {
		return false
	}
	if strings.Contains(name, "META-INF/") {
		return false
	}
	if strings.HasSuffix(name, ".sha1") || strings.HasSuffix(name, ".git") {
		return false
	}
	for _, ex := range excludes {
		if strings.HasPrefix(name, ex) {
			return false
		}
	}
	// Only enforce the os/arch sub-path filter when the entry is
	// nested. Flat entries are by-platform via the classifier itself.
	if strings.Contains(name, "/") {
		parts := strings.SplitN(name, "/", 3)
		os, arch := parts[0], parts[1]
		// `ia32` ↔ `x86` quirk inherited from the TS reference.
		if arch == "ia32" {
			arch = "x86"
		}
		if os != platform.Name || arch != platform.Arch {
			return false
		}
	}
	return true
}

// writeZipEntry pipes one zip member to disk, creating any needed
// directories. Permissions follow the entry mode but are clamped to
// 0o755 for executables / 0o644 otherwise — preserves the +x bit on
// macOS dylib loaders without trusting the zip metadata.
func writeZipEntry(f *zip.File, dest string) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()
	mode := os.FileMode(0o644)
	if f.Mode()&0o111 != 0 {
		mode = 0o755
	}
	out, err := os.OpenFile(dest, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	defer out.Close()
	if _, err := io.Copy(out, rc); err != nil {
		return err
	}
	return nil
}

// nativeLibraries returns the subset of resolved libraries that were
// flagged as natives by the rule walker.
func nativeLibraries(v *ResolvedVersion) []ResolvedLibrary {
	out := make([]ResolvedLibrary, 0, len(v.Libraries))
	for _, lib := range v.Libraries {
		if lib.IsNative {
			out = append(out, lib)
		}
	}
	return out
}

// libSetMatches reports whether two sorted library-name lists are
// element-equal. The caller sorts `current`; `prev` is sorted here so
// callers don't need to re-sort what they read from disk.
func libSetMatches(prev, current []string) bool {
	if len(prev) != len(current) {
		return false
	}
	cp := append([]string(nil), prev...)
	sort.Strings(cp)
	for i := range cp {
		if cp[i] != current[i] {
			return false
		}
	}
	return true
}

func filterOutLibrary(entries []nativeChecksumEntry, name string) []nativeChecksumEntry {
	out := entries[:0]
	for _, e := range entries {
		if e.Name == name {
			continue
		}
		out = append(out, e)
	}
	return out
}

func loadNativeChecksum(path string) (*nativeChecksum, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var c nativeChecksum
	if err := json.Unmarshal(raw, &c); err != nil {
		return nil, err
	}
	return &c, nil
}

func saveNativeChecksum(path string, c *nativeChecksum) error {
	raw, err := json.Marshal(c)
	if err != nil {
		return err
	}
	return os.WriteFile(path, raw, 0o644)
}

// sha1File is a small helper around crypto/sha1 + io.Copy. Returns the
// hex-encoded digest.
func sha1File(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha1.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// validateSha1 returns true when the file at `path` exists and matches
// `expected`. An empty `expected` short-circuits to a stat-only check
// (mirrors the TS reference, which also accepts an empty hash as
// "exists" when the manifest predates sha1 capture).
func validateSha1(path, expected string) bool {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return false
	}
	if expected == "" {
		return true
	}
	got, err := sha1File(path)
	if err != nil {
		return false
	}
	return strings.EqualFold(got, expected)
}
