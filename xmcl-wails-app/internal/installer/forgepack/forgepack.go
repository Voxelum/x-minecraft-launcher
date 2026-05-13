// Package forgepack handles the shared "Forge-style installer jar"
// extraction Forge / NeoForge / NeoForged 47 all reuse.
//
// A Forge-style installer jar carries:
//
//   - `install_profile.json`  — descriptor of post-processors + libs.
//   - `version.json`          — the Mojang-format `version.json` to
//     drop into `versions/<id>/`.
//   - `maven/<group>/<art>/<v>/...` — embedded Maven artifacts that
//     the launcher must materialise into
//     `libraries/` so post-processors can
//     find them.
//   - `data/...`              — runtime assets (LZMA bin patches,
//     argument files) the post-processors
//     read from the installer-jar's maven
//     directory in `libraries/`.
//
// The post-process step itself lives in `internal/installer/profile`.
package forgepack

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/installer/profile"
	"github.com/voxelum/xmcl/wails/internal/network"
	"github.com/voxelum/xmcl/wails/internal/parsers/core"
)

// JarSource describes where the installer jar lives in the Mojang
// libraries hierarchy. The launcher needs this so it can place the
// jar (download target) AND know which directory to drop `data/`
// entries into (the installer jar's parent inside `libraries/`).
type JarSource struct {
	// MavenPath is the relative path under `libraries/` (e.g.
	// `net/minecraftforge/forge/1.20.4-49.0.13/forge-1.20.4-49.0.13-installer.jar`).
	MavenPath string
	// MavenCoord is the Maven coordinate used for `INSTALLER` data
	// entry patching (e.g.
	// `net.minecraftforge:forge:1.20.4-49.0.13`).
	MavenCoord string
	// URLs are the candidate download URLs (in priority order). The
	// first one that succeeds wins.
	URLs []string
	// SHA1, if known, verifies the download.
	SHA1 string
}

// Result is what a successful unpack produces.
type Result struct {
	// VersionID is the on-disk version id (post inheritsFrom/id
	// overrides).
	VersionID string
	// Profile is the parsed install_profile.json with any data
	// patches applied so post-processors can find the extracted
	// `data/` blobs by Maven coordinate.
	Profile *profile.Profile
	// JarPath is the on-disk path to the downloaded installer jar.
	JarPath string
}

// UnpackOptions configures one unpack.
type UnpackOptions struct {
	MinecraftDir string
	JarSource    JarSource
	// VersionID overrides the embedded version.json `id`. When empty
	// the embedded id is preserved.
	VersionID string
	// InheritsFrom overrides the embedded `inheritsFrom`. When empty
	// the embedded value is preserved.
	InheritsFrom string
}

// Download downloads the installer jar to its Maven path under
// `libraries/`, verifying the SHA-1 if supplied.
func Download(ctx context.Context, client *network.Client, mc core.MinecraftFolder, src JarSource) (string, error) {
	if len(src.URLs) == 0 {
		return "", errors.New("forgepack: no installer URLs")
	}
	dest := mc.LibraryByPath(src.MavenPath)
	err := client.Download(ctx, network.DownloadOptions{
		URLs:         src.URLs,
		Destination:  dest,
		ExpectedSHA1: src.SHA1,
	})
	if err != nil {
		return "", err
	}
	return dest, nil
}

// Unpack extracts the installer jar contents into the launcher's
// directory tree and returns the (possibly patched) profile + the
// final version id. Pre-condition: Download was called and the jar
// is on disk.
func Unpack(ctx context.Context, client *network.Client, opts UnpackOptions) (*Result, error) {
	_ = client // reserved for future asset re-fetches
	if opts.MinecraftDir == "" {
		return nil, errors.New("forgepack.Unpack: MinecraftDir required")
	}
	mc := core.NewMinecraftFolder(opts.MinecraftDir)
	jarPath := mc.LibraryByPath(opts.JarSource.MavenPath)

	zr, err := zip.OpenReader(jarPath)
	if err != nil {
		return nil, fmt.Errorf("forgepack: open %s: %w", jarPath, err)
	}
	defer zr.Close()

	var (
		profileBody []byte
		versionBody []byte
	)
	for _, f := range zr.File {
		switch f.Name {
		case "install_profile.json":
			profileBody, err = readZipEntry(f)
		case "version.json":
			versionBody, err = readZipEntry(f)
		}
		if err != nil {
			return nil, err
		}
	}
	if profileBody == nil {
		return nil, fmt.Errorf("forgepack: %s missing install_profile.json", jarPath)
	}
	if versionBody == nil {
		return nil, fmt.Errorf("forgepack: %s missing version.json", jarPath)
	}

	prof, err := profile.Parse(profileBody)
	if err != nil {
		return nil, err
	}

	// Patch the version JSON's id / inheritsFrom in-place.
	var versionJSON map[string]any
	if err := json.Unmarshal(versionBody, &versionJSON); err != nil {
		return nil, fmt.Errorf("forgepack: parse version.json: %w", err)
	}
	if opts.VersionID != "" {
		versionJSON["id"] = opts.VersionID
	}
	if opts.InheritsFrom != "" {
		versionJSON["inheritsFrom"] = opts.InheritsFrom
	}
	versionID, _ := versionJSON["id"].(string)
	if versionID == "" {
		return nil, errors.New("forgepack: version.json missing id")
	}

	// Write versions/<id>/<id>.json
	versionDest := mc.VersionJSON(versionID)
	if err := os.MkdirAll(filepath.Dir(versionDest), 0o755); err != nil {
		return nil, err
	}
	patched, err := json.MarshalIndent(versionJSON, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(versionDest, patched, 0o644); err != nil {
		return nil, err
	}

	// Walk the rest of the jar, extracting maven/ + data/ entries.
	jarDirInLibs := filepath.Dir(jarPath)
	for _, f := range zr.File {
		if f.FileInfo().IsDir() {
			continue
		}
		switch {
		case strings.HasPrefix(f.Name, "maven/"):
			rel := strings.TrimPrefix(f.Name, "maven/")
			dest := mc.LibraryByPath(filepath.FromSlash(rel))
			if err := writeZipEntry(f, dest); err != nil {
				return nil, fmt.Errorf("extract %s: %w", f.Name, err)
			}
		case strings.HasPrefix(f.Name, "data/"):
			rel := strings.TrimPrefix(f.Name, "data/")
			dest := filepath.Join(jarDirInLibs, filepath.FromSlash(rel))
			if err := writeZipEntry(f, dest); err != nil {
				return nil, fmt.Errorf("extract %s: %w", f.Name, err)
			}
		}
	}

	// Patch profile.data so post-processors can resolve `INSTALLER`
	// and `BINPATCH` entries via Maven coordinate. The installer jar's
	// own coordinate is `<MavenCoord>:installer`; the bin patches the
	// installer extracted from `data/client.lzma` / `data/server.lzma`
	// live next to the installer jar in the same Maven directory and
	// are normally referenced as `<MavenCoord>:clientdata@lzma` /
	// `<MavenCoord>:serverdata@lzma`.
	if prof.Data == nil {
		prof.Data = map[string]map[string]string{}
	}
	if opts.JarSource.MavenCoord != "" {
		installer := "[" + opts.JarSource.MavenCoord + ":installer]"
		prof.Data["INSTALLER"] = map[string]string{"client": installer, "server": installer}
		patchBinPatch(prof, opts.JarSource.MavenCoord, mc, jarDirInLibs)
	}

	return &Result{
		VersionID: versionID,
		Profile:   prof,
		JarPath:   jarPath,
	}, nil
}

// patchBinPatch upgrades any literal `/data/<file>.lzma` entries in
// `profile.data.BINPATCH` to Maven-coordinate references AND copies
// the data file from `<jarDir>/<file>.lzma` into the canonical
// `libraries/<group>/<artifact>/<version>/<artifact>-<version>-<classifier>.lzma`
// path that `[coord]` substitution expects. Older Forge installers
// rely on the launcher to do this rewrite.
func patchBinPatch(p *profile.Profile, mavenCoord string, mc core.MinecraftFolder, jarDir string) {
	binPatch, ok := p.Data["BINPATCH"]
	if !ok {
		return
	}
	for _, side := range []struct {
		key, classifier string
	}{
		{"client", "clientdata@lzma"},
		{"server", "serverdata@lzma"},
	} {
		val := binPatch[side.key]
		if val == "" || !strings.HasPrefix(val, "/data/") {
			continue
		}
		fileName := strings.TrimPrefix(val, "/data/")
		src := filepath.Join(jarDir, fileName)
		if _, err := os.Stat(src); err != nil {
			continue
		}
		coord := mavenCoord + ":" + side.classifier
		info := core.ParseLibraryName(coord)
		dst := mc.LibraryByPath(info.Path)
		if src != dst {
			_ = os.MkdirAll(filepath.Dir(dst), 0o755)
			if err := copyFile(src, dst); err != nil {
				continue
			}
		}
		binPatch[side.key] = "[" + coord + "]"
	}
	p.Data["BINPATCH"] = binPatch
}

// ============================================================
// Coordinate helpers
// ============================================================

// MavenCoordFromPath turns `net/minecraftforge/forge/1.20.4-49.0.13/foo-installer.jar`
// into `net.minecraftforge:forge:1.20.4-49.0.13`. The classifier (if
// any) is stripped — callers reattach it to form e.g. `:installer`.
func MavenCoordFromPath(libPath string) string {
	parts := strings.Split(filepath.ToSlash(libPath), "/")
	if len(parts) < 4 {
		return ""
	}
	version := parts[len(parts)-2]
	artifact := parts[len(parts)-3]
	group := strings.Join(parts[:len(parts)-3], ".")
	return group + ":" + artifact + ":" + version
}

// JarMavenPath returns the canonical maven path for an installer jar
// of the given group / artifact / version. Mirrors the path Forge +
// NeoForge use.
func JarMavenPath(group, artifact, version, classifier, ext string) string {
	if ext == "" {
		ext = "jar"
	}
	groupPath := strings.ReplaceAll(group, ".", "/")
	name := artifact + "-" + version
	if classifier != "" {
		name += "-" + classifier
	}
	name += "." + ext
	return path.Join(groupPath, artifact, version, name)
}

// ============================================================
// I/O helpers
// ============================================================

func readZipEntry(f *zip.File) ([]byte, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(rc)
}

func writeZipEntry(f *zip.File, dest string) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()
	tmp := dest + ".part"
	out, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, rc); err != nil {
		out.Close()
		os.Remove(tmp)
		return err
	}
	if err := out.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, dest)
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	tmp := dst + ".part"
	out, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		os.Remove(tmp)
		return err
	}
	if err := out.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, dst)
}
