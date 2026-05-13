// Package core ports `@xmcl/core` to Go.
//
// Surface:
//
//   - Platform           — current OS + arch in the Mojang
//                          launcher-meta vocabulary.
//   - MinecraftFolder    — every path the launcher writes/reads under
//                          a `.minecraft` directory.
//   - LibraryInfo        — Maven-coordinate parsing.
//   - ResolvedLibrary    — a library reference after rule
//                          evaluation + classifier resolution.
//   - Version + Resolved — the full version JSON model, including
//                          inheritance walk via `inheritsFrom`.
//   - ParseVersion       — walk a version directory tree, returning
//                          the fully-merged ResolvedVersion the
//                          launcher then turns into JVM args.
//
// Launch argument assembly (`GenerateArguments`) lives in launch.go
// next door.
//
// This package contains zero IO besides reading version JSON files
// from disk (matches the TS reference's surface). Higher-level
// services compose it with the host (sqlite/network/etc.).
package core

import (
	"path/filepath"
	"runtime"
)

// Platform mirrors the Mojang version JSON's OS/arch vocabulary. The
// renderer-side rules in version JSONs match against these
// values verbatim (e.g. `"os":{"name":"windows"}`).
type Platform struct {
	Name    string // osx / linux / windows / unknown
	Version string // e.g. `os.release()` output
	Arch    string // x64 / x86 / arm64 / …
}

// CurrentPlatform reports the host's platform. Mirrors the TS
// `getPlatform()` helper.
func CurrentPlatform() Platform {
	p := Platform{Version: ""}
	switch runtime.GOOS {
	case "darwin":
		p.Name = "osx"
	case "linux":
		p.Name = "linux"
	case "windows":
		p.Name = "windows"
	default:
		p.Name = "unknown"
	}
	// Map Go's arch names to the Mojang vocabulary. The TS reference
	// uses `os.arch()` raw, but Go's `runtime.GOARCH` already produces
	// values the version JSONs accept (`amd64` ↔ vanilla doesn't pin
	// this, the rules check substrings).
	switch runtime.GOARCH {
	case "amd64":
		p.Arch = "x64"
	case "386":
		p.Arch = "x86"
	case "arm64":
		p.Arch = "arm64"
	case "arm":
		p.Arch = "arm"
	default:
		p.Arch = runtime.GOARCH
	}
	return p
}

// ============================================================
// MinecraftFolder
// ============================================================

// MinecraftFolder is the resolver for every path under a `.minecraft`
// directory. Mirrors the TS class.
type MinecraftFolder struct {
	Root string
}

// NewMinecraftFolder constructs a folder rooted at `root`.
func NewMinecraftFolder(root string) MinecraftFolder {
	return MinecraftFolder{Root: root}
}

// Path returns `root + parts...` joined.
func (m MinecraftFolder) Path(parts ...string) string {
	return filepath.Join(append([]string{m.Root}, parts...)...)
}

// Mods, ResourcePacks, Assets, Libraries, Versions, Logs, Saves.
func (m MinecraftFolder) Mods() string          { return m.Path("mods") }
func (m MinecraftFolder) ResourcePacks() string { return m.Path("resourcepacks") }
func (m MinecraftFolder) Assets() string        { return m.Path("assets") }
func (m MinecraftFolder) Libraries() string     { return m.Path("libraries") }
func (m MinecraftFolder) Versions() string      { return m.Path("versions") }
func (m MinecraftFolder) Logs() string          { return m.Path("logs") }
func (m MinecraftFolder) Saves() string         { return m.Path("saves") }
func (m MinecraftFolder) Screenshots() string   { return m.Path("screenshots") }

// VersionRoot returns `versions/<version>/`.
func (m MinecraftFolder) VersionRoot(version string) string {
	return filepath.Join(m.Versions(), version)
}

// VersionJSON returns `versions/<version>/<version>.json`.
func (m MinecraftFolder) VersionJSON(version string) string {
	return filepath.Join(m.VersionRoot(version), version+".json")
}

// VersionServerJSON returns `versions/<version>/server.json`.
func (m MinecraftFolder) VersionServerJSON(version string) string {
	return filepath.Join(m.VersionRoot(version), "server.json")
}

// VersionJar returns `versions/<version>/<version>.jar` (client) or
// the bundled server jar when `kind == "server"`.
func (m MinecraftFolder) VersionJar(version, kind string) string {
	if kind == "" || kind == "client" {
		return filepath.Join(m.VersionRoot(version), version+".jar")
	}
	if kind == "server" {
		return m.Path("libraries", "net", "minecraft", "server", version, "server-"+version+"-bundled.jar")
	}
	return filepath.Join(m.VersionRoot(version), version+"-"+kind+".jar")
}

// NativesRoot returns `versions/<version>/<version>-natives/`.
func (m MinecraftFolder) NativesRoot(version string) string {
	return filepath.Join(m.VersionRoot(version), version+"-natives")
}

// LibraryByPath returns `libraries/<libPath>`.
func (m MinecraftFolder) LibraryByPath(libPath string) string {
	return filepath.Join(m.Libraries(), libPath)
}

// AssetsIndex returns `assets/indexes/<id>.json`.
func (m MinecraftFolder) AssetsIndex(id string) string {
	return m.Path("assets", "indexes", id+".json")
}

// Asset returns `assets/objects/<hash[0:2]>/<hash>`.
func (m MinecraftFolder) Asset(hash string) string {
	if len(hash) < 2 {
		return m.Path("assets", "objects", hash)
	}
	return m.Path("assets", "objects", hash[:2], hash)
}

// LogConfig returns `assets/log_configs/<file>`.
func (m MinecraftFolder) LogConfig(file string) string {
	return m.Path("assets", "log_configs", file)
}
