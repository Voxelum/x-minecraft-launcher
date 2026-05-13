// Package profile parses + executes a Forge / NeoForge
// `install_profile.json` descriptor.
//
// Surface:
//
//   - Profile          — the on-wire shape of install_profile.json.
//   - Resolve          — substitutes {VARIABLE} placeholders +
//     resolves Maven coordinates ([…]) into real
//     on-disk paths for the requested side.
//   - InstallLibraries — downloads every library listed in `libraries`.
//   - RunPostProcessors — executes every processor with the supplied
//     java binary, surfacing per-step failures.
//
// The implementation purposefully mirrors `packages/installer/profile.ts`
// so output diffs against an "official" install line up byte-for-byte.
package profile

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/network"
	"github.com/voxelum/xmcl/wails/internal/parsers/core"
)

// Profile mirrors the install_profile.json shape Forge/NeoForge
// shipped from 1.13 onwards.
type Profile struct {
	Spec       int                              `json:"spec,omitempty"`
	Profile    string                           `json:"profile"`
	Version    string                           `json:"version"`
	JSON       string                           `json:"json,omitempty"`
	Path       string                           `json:"path,omitempty"`
	Minecraft  string                           `json:"minecraft"`
	Data       map[string]map[string]string     `json:"data,omitempty"`
	Processors []PostProcessor                  `json:"processors,omitempty"`
	Libraries  []ProfileLibrary                 `json:"libraries,omitempty"`
}

// PostProcessor is one entry in `processors`.
type PostProcessor struct {
	Jar       string            `json:"jar"`
	Classpath []string          `json:"classpath,omitempty"`
	Args      []string          `json:"args,omitempty"`
	Outputs   map[string]string `json:"outputs,omitempty"`
	Sides     []string          `json:"sides,omitempty"`
}

// ProfileLibrary is the install_profile library shape (Mojang format
// with the Maven name + downloads block).
type ProfileLibrary struct {
	Name      string `json:"name"`
	Downloads *struct {
		Artifact *struct {
			Path string `json:"path,omitempty"`
			URL  string `json:"url,omitempty"`
			SHA1 string `json:"sha1,omitempty"`
			Size int64  `json:"size,omitempty"`
		} `json:"artifact,omitempty"`
	} `json:"downloads,omitempty"`
}

// Parse reads and decodes an install_profile.json from raw bytes.
func Parse(raw []byte) (*Profile, error) {
	var p Profile
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, fmt.Errorf("profile: parse: %w", err)
	}
	return &p, nil
}

// LoadFromZip reads `install_profile.json` from a zip file (the
// installer jar). Returns the raw bytes too so the caller can stash
// them verbatim if needed.
func LoadFromZip(jarPath string) (*Profile, []byte, error) {
	zr, err := zip.OpenReader(jarPath)
	if err != nil {
		return nil, nil, err
	}
	defer zr.Close()
	for _, f := range zr.File {
		if f.Name == "install_profile.json" {
			rc, err := f.Open()
			if err != nil {
				return nil, nil, err
			}
			defer rc.Close()
			body, err := io.ReadAll(rc)
			if err != nil {
				return nil, nil, err
			}
			p, err := Parse(body)
			if err != nil {
				return nil, body, err
			}
			return p, body, nil
		}
	}
	return nil, nil, errors.New("profile: install_profile.json not found in installer jar")
}

// ============================================================
// Library install
// ============================================================

// InstallLibraries downloads every library referenced by the
// profile. Mirrors `installResolvedLibraries(profile.libraries)`.
// `mirror` (zero-value OK) toggles BMCL / mirror fall-back.
func InstallLibraries(ctx context.Context, client *network.Client, mc core.MinecraftFolder, libs []ProfileLibrary, parallelism int, mirror network.MirrorPreference) error {
	if parallelism <= 0 {
		parallelism = 8
	}
	items := make([]network.DownloadOptions, 0, len(libs))
	for _, lib := range libs {
		if lib.Name == "" {
			continue
		}
		info := core.ParseLibraryName(lib.Name)
		path := info.Path
		url := ""
		sha1 := ""
		var size int64
		if lib.Downloads != nil && lib.Downloads.Artifact != nil {
			art := lib.Downloads.Artifact
			if art.Path != "" {
				path = art.Path
			}
			url = art.URL
			sha1 = art.SHA1
			size = art.Size
		}
		// Skip "synthetic" libraries that have no URL — they're
		// expected to be produced by the post-processor (e.g.
		// patched client jar). We still register the path so the
		// processor can find it on disk.
		if url == "" {
			continue
		}
		items = append(items, network.DownloadOptions{
			URLs:         mirror.LibraryURLs(path, url),
			Destination:  mc.LibraryByPath(path),
			ExpectedSHA1: sha1,
			ExpectedSize: size,
		})
	}
	return client.DownloadAll(ctx, items, parallelism)
}

// ============================================================
// Variable resolution
// ============================================================

// Resolve produces the substituted processor list for the requested
// side. Mirrors `resolveProcessors`.
func Resolve(side string, p *Profile, mc core.MinecraftFolder) []PostProcessor {
	if side != "server" {
		side = "client"
	}
	vars := map[string]map[string]string{
		"SIDE": {
			"client": "client",
			"server": "server",
		},
		"MINECRAFT_JAR": {
			"client": mc.VersionJar(p.Minecraft, "client"),
			"server": mc.VersionJar(p.Minecraft, "server"),
		},
		"ROOT": {
			"client": mc.Root,
			"server": mc.Root,
		},
		"MINECRAFT_VERSION": {
			"client": p.Minecraft,
			"server": p.Minecraft,
		},
		"LIBRARY_DIR": {
			"client": mc.Libraries(),
			"server": mc.Libraries(),
		},
	}
	for k, v := range p.Data {
		vars[k] = map[string]string{
			"client": normaliseVarPath(v["client"], mc),
			"server": normaliseVarPath(v["server"], mc),
		}
	}

	out := make([]PostProcessor, 0, len(p.Processors))
	for _, proc := range p.Processors {
		if len(proc.Sides) > 0 && !contains(proc.Sides, side) {
			continue
		}
		args := make([]string, len(proc.Args))
		for i, a := range proc.Args {
			args[i] = normaliseVarPath(a, mc)
			args[i] = substituteVars(args[i], side, vars)
		}
		outputs := map[string]string{}
		for k, v := range proc.Outputs {
			key := substituteVars(normaliseVarPath(k, mc), side, vars)
			val := substituteVars(normaliseVarPath(v, mc), side, vars)
			val = strings.ReplaceAll(val, "'", "")
			outputs[key] = val
		}
		out = append(out, PostProcessor{
			Jar:       proc.Jar,
			Classpath: proc.Classpath,
			Args:      args,
			Outputs:   outputs,
			Sides:     proc.Sides,
		})
	}
	return out
}

// mavenCoordRE matches `[group:artifact:version[:classifier][@type]]`.
var mavenCoordRE = regexp.MustCompile(`^\[(.+)\]$`)

// varRE matches `{VARIABLE_NAME}` placeholders.
var varRE = regexp.MustCompile(`\{([A-Za-z0-9_-]+)\}`)

// normaliseVarPath collapses `[maven:coord]` into the resolved
// libraries path. Plain strings pass through unchanged.
func normaliseVarPath(val string, mc core.MinecraftFolder) string {
	if val == "" {
		return val
	}
	if m := mavenCoordRE.FindStringSubmatch(val); m != nil {
		info := core.ParseLibraryName(m[1])
		return mc.LibraryByPath(info.Path)
	}
	return val
}

// substituteVars expands `{VAR}` references against the resolved
// variables map for the requested side.
func substituteVars(val, side string, vars map[string]map[string]string) string {
	if val == "" {
		return val
	}
	return varRE.ReplaceAllStringFunc(val, func(match string) string {
		key := match[1 : len(match)-1]
		if v, ok := vars[key]; ok {
			if s, ok := v[side]; ok {
				return s
			}
		}
		return match
	})
}

func contains(xs []string, target string) bool {
	for _, x := range xs {
		if x == target {
			return true
		}
	}
	return false
}

// ============================================================
// Post-processor execution
// ============================================================

// Run executes every resolved post-processor sequentially. Each
// processor spawns the supplied java binary with the resolved
// classpath + args. Failures are wrapped with the offending
// processor's jar path so the caller can map the error back.
func Run(ctx context.Context, mc core.MinecraftFolder, javaBin string, procs []PostProcessor, progress func(stage string, completed, total int)) error {
	if javaBin == "" {
		return errors.New("profile: java binary required for post-processors")
	}
	if _, err := os.Stat(javaBin); err != nil {
		return fmt.Errorf("profile: java %q: %w", javaBin, err)
	}
	for i, proc := range procs {
		if progress != nil {
			progress("postprocess", i, len(procs))
		}
		if err := runOne(ctx, mc, javaBin, proc); err != nil {
			return fmt.Errorf("profile: post-processor %d (%s): %w", i, proc.Jar, err)
		}
	}
	if progress != nil {
		progress("postprocess", len(procs), len(procs))
	}
	return nil
}

func runOne(ctx context.Context, mc core.MinecraftFolder, javaBin string, proc PostProcessor) error {
	jarInfo := core.ParseLibraryName(proc.Jar)
	jarPath := mc.LibraryByPath(jarInfo.Path)
	mainClass, err := readMainClass(jarPath)
	if err != nil {
		return fmt.Errorf("read main class: %w", err)
	}

	// Build classpath: every entry in `classpath` plus the jar itself.
	cpEntries := make([]string, 0, len(proc.Classpath)+1)
	for _, name := range proc.Classpath {
		info := core.ParseLibraryName(name)
		cpEntries = append(cpEntries, mc.LibraryByPath(info.Path))
	}
	cpEntries = append(cpEntries, jarPath)

	args := append([]string{"-cp", strings.Join(cpEntries, classPathSep()), mainClass}, proc.Args...)
	cmd := exec.CommandContext(ctx, javaBin, args...)
	cmd.Dir = mc.Root
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		tail := strings.TrimSpace(stderr.String())
		if len(tail) > 1024 {
			tail = "…" + tail[len(tail)-1024:]
		}
		return fmt.Errorf("%w (java stderr: %s)", err, tail)
	}
	return nil
}

// readMainClass reads `Main-Class:` out of the jar's manifest.
func readMainClass(jarPath string) (string, error) {
	zr, err := zip.OpenReader(jarPath)
	if err != nil {
		return "", err
	}
	defer zr.Close()
	for _, f := range zr.File {
		if f.Name != "META-INF/MANIFEST.MF" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return "", err
		}
		defer rc.Close()
		body, err := io.ReadAll(rc)
		if err != nil {
			return "", err
		}
		// MANIFEST.MF folds long lines with " " continuation. Normalise
		// before line-splitting.
		flat := strings.ReplaceAll(string(body), "\r\n", "\n")
		flat = strings.ReplaceAll(flat, "\n ", "")
		for _, line := range strings.Split(flat, "\n") {
			if strings.HasPrefix(line, "Main-Class:") {
				return strings.TrimSpace(strings.TrimPrefix(line, "Main-Class:")), nil
			}
		}
		return "", fmt.Errorf("profile: jar %s missing Main-Class", jarPath)
	}
	return "", fmt.Errorf("profile: jar %s missing META-INF/MANIFEST.MF", jarPath)
}

// classPathSep returns the platform classpath separator.
func classPathSep() string {
	if runtime.GOOS == "windows" {
		return ";"
	}
	return ":"
}

// ============================================================
// Misc helpers
// ============================================================

// FilterEmpty drops empty-string entries — useful for processor args
// after substitution that produced ""s.
func FilterEmpty(xs []string) []string {
	out := xs[:0]
	for _, x := range xs {
		if x == "" {
			continue
		}
		out = append(out, x)
	}
	return out
}

// MarshalIndent re-serialises a value with stable indentation. Used
// for writing back the patched version.json.
func MarshalIndent(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	out := buf.Bytes()
	out = bytes.TrimRight(out, "\n")
	return out, nil
}

// EnsureDir is a tiny convenience wrapper.
func EnsureDir(p string) error {
	return os.MkdirAll(filepath.Dir(p), 0o755)
}
