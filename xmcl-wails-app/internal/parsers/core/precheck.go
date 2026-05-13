// Package core — launch precheck (port of `@xmcl/core`'s
// `LaunchPrecheck` namespace).
//
// Before launching Minecraft we validate that the on-disk artefacts
// (version jar + library jars + extracted natives) are present and
// match the recorded sha1s. Failures are returned as typed errors so
// the InstallService can reactively download whatever's missing.

package core

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// CorruptedVersionJarError signals the client jar at `<version>.jar`
// is missing or the recorded sha1 doesn't match.
type CorruptedVersionJarError struct {
	Version string
	Path    string
	Cause   error
}

func (e *CorruptedVersionJarError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("CorruptedVersionJar: %s (%s): %v", e.Version, e.Path, e.Cause)
	}
	return fmt.Sprintf("CorruptedVersionJar: %s (%s)", e.Version, e.Path)
}

func (e *CorruptedVersionJarError) Unwrap() error { return e.Cause }

// MissingLibrariesError carries the list of libraries whose jars are
// missing or sha1-mismatched. Empty `Libraries` means the precheck
// passed.
type MissingLibrariesError struct {
	VersionID string
	Libraries []ResolvedLibrary
}

func (e *MissingLibrariesError) Error() string {
	names := make([]string, len(e.Libraries))
	for i, lib := range e.Libraries {
		names[i] = lib.Name
	}
	return fmt.Sprintf("MissingLibraries (%s): %d corrupt — %s",
		e.VersionID, len(e.Libraries), strings.Join(names, ", "))
}

// MissingJavaError is returned when CheckJava cannot find an
// executable at the provided path. The InstallService can use this to
// trigger a JRE download.
type MissingJavaError struct {
	Path  string
	Cause error
}

func (e *MissingJavaError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("MissingJava: %s: %v", e.Path, e.Cause)
	}
	return fmt.Sprintf("MissingJava: %s", e.Path)
}

func (e *MissingJavaError) Unwrap() error { return e.Cause }

// CheckVersion validates the client jar matches the recorded sha1.
// Mirrors `LaunchPrecheck.checkVersion`. When the version JSON has no
// `downloads.client.sha1` (e.g. inherited custom builds) the check is
// a no-op — the jar's mere existence is verified by the launcher when
// it builds the classpath.
func CheckVersion(mc MinecraftFolder, version *ResolvedVersion) error {
	if version == nil {
		return errors.New("CheckVersion: nil version")
	}
	jarVersion := version.MinecraftVersion
	if jarVersion == "" {
		jarVersion = version.ID
	}
	jarPath := mc.VersionJar(jarVersion, "")
	expected := ""
	if version.Downloads != nil {
		if d, ok := version.Downloads["client"]; ok && d != nil {
			expected = d.SHA1
		}
	}
	if expected == "" {
		// No recorded hash → existence-only check.
		if _, err := os.Stat(jarPath); err != nil {
			return &CorruptedVersionJarError{Version: jarVersion, Path: jarPath, Cause: err}
		}
		return nil
	}
	if !validateSha1(jarPath, expected) {
		return &CorruptedVersionJarError{Version: jarVersion, Path: jarPath}
	}
	return nil
}

// CheckLibraries validates every resolved library jar exists and
// matches its recorded sha1. Mirrors `LaunchPrecheck.checkLibraries`.
//
// Native libraries are checked too — their archive must be present so
// CheckNatives can re-extract on demand.
//
// Libraries with empty `Download.SHA1` are existence-only.
func CheckLibraries(mc MinecraftFolder, version *ResolvedVersion) error {
	if version == nil {
		return errors.New("CheckLibraries: nil version")
	}
	var corrupt []ResolvedLibrary
	for _, lib := range version.Libraries {
		if lib.Download.Path == "" {
			// Skip libraries with no Maven path (rare; e.g. inheritance
			// pruned downloads).
			continue
		}
		path := mc.LibraryByPath(lib.Download.Path)
		if !validateSha1(path, lib.Download.SHA1) {
			corrupt = append(corrupt, lib)
		}
	}
	if len(corrupt) > 0 {
		return &MissingLibrariesError{VersionID: version.ID, Libraries: corrupt}
	}
	return nil
}

// CheckJava verifies `javaPath` points to an executable file. Returns
// MissingJavaError when the binary is missing or unreadable.
//
// We deliberately don't run `java -version` — that's the job of the
// JavaService which caches per-binary metadata. CheckJava is a pure
// filesystem precheck that runs on every launch.
func CheckJava(javaPath string) error {
	if javaPath == "" {
		return &MissingJavaError{Path: javaPath, Cause: errors.New("empty path")}
	}
	info, err := os.Stat(javaPath)
	if err != nil {
		return &MissingJavaError{Path: javaPath, Cause: err}
	}
	if info.IsDir() {
		return &MissingJavaError{Path: javaPath, Cause: errors.New("is a directory")}
	}
	return nil
}

// LinkAssets stages assets/objects/* under assets/virtual/<assets> for
// legacy / pre-1.6 versions that expect the resource layout from
// before assetIndex. Mirrors `LaunchPrecheck.linkAssets`.
//
// When the assets index reports a non-legacy layout, this is a no-op.
// The links are created via `os.Link` (hard link) to match the TS
// reference; falls back to copy when hard-linking is unsupported on
// the target filesystem.
func LinkAssets(mc MinecraftFolder, version *ResolvedVersion) error {
	if version == nil {
		return errors.New("LinkAssets: nil version")
	}
	if version.Assets != "legacy" && !strings.HasPrefix(version.Assets, "pre-") {
		return nil
	}

	indexPath := mc.AssetsIndex(version.Assets)
	idx, err := loadAssetIndex(indexPath)
	if err != nil {
		return fmt.Errorf("LinkAssets: read index %s: %w", indexPath, err)
	}

	virtualRoot := mc.Path("assets", "virtual", version.Assets)
	if err := os.MkdirAll(virtualRoot, 0o755); err != nil {
		return fmt.Errorf("LinkAssets: mkdir %s: %w", virtualRoot, err)
	}

	for path, obj := range idx.Objects {
		target := filepath.Join(virtualRoot, filepath.FromSlash(path))
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return fmt.Errorf("LinkAssets: mkdir %s: %w", filepath.Dir(target), err)
		}
		// Already linked / copied — skip.
		if _, err := os.Stat(target); err == nil {
			continue
		}
		src := mc.Asset(obj.Hash)
		if err := os.Link(src, target); err == nil {
			continue
		}
		// Hard-link failed (cross-volume on Windows, some FUSE FSes).
		// Fall back to copy. We don't bubble the original link error;
		// the copy outcome is what the launcher actually needs.
		if err := copyFile(src, target); err != nil {
			return fmt.Errorf("LinkAssets: stage %s: %w", path, err)
		}
	}
	return nil
}

type assetIndexFile struct {
	Objects map[string]struct {
		Hash string `json:"hash"`
		Size int64  `json:"size"`
	} `json:"objects"`
}

func loadAssetIndex(path string) (*assetIndexFile, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var idx assetIndexFile
	if err := json.Unmarshal(raw, &idx); err != nil {
		return nil, err
	}
	return &idx, nil
}

// copyFile is a minimal io.Copy wrapper used as the LinkAssets
// fallback when hard-linking isn't supported.
func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}
