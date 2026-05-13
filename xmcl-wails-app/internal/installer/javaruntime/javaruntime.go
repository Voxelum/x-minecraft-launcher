// Package javaruntime ports the Mojang java-runtime installer.
//
// Mojang ships per-platform JRE bundles (the same ones the official
// launcher downloads for vanilla / Forge / Fabric versions whose
// `javaVersion.component` matches a known runtime name). The
// distribution layout is:
//
//  1. Index URL (`all.json`) lists every platform / component pair
//     and points at a per-bundle manifest.
//  2. The bundle manifest enumerates every file (`type: "file"`),
//     directory, or symlink, with sha1 + size + download URL. File
//     entries optionally carry an LZMA-compressed variant — we
//     always go for the raw download to avoid the cgo-only LZMA
//     libraries (the disk-space saving from LZMA is nice but not
//     necessary for the launcher).
//  3. We download each `file` entry via the shared `network.Client`
//     (sha1-verified, parallel via DownloadAll), recreate
//     directories, and stitch symlinks via os.Symlink (best-effort
//     fallback to a hard-link or file copy when the runtime
//     doesn't permit symlinks — Windows non-admin users hit this).
//
// The fully-installed bundle is rooted at
// `<destination>/<component>/`; the launcher is expected to look for
// `bin/javaw.exe` (Windows) or `jre.bundle/Contents/Home/bin/java`
// (macOS) / `bin/java` (linux) under that root.
package javaruntime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"time"

	"github.com/voxelum/xmcl/wails/internal/network"
)

// DefaultIndexURL is the root manifest the official launcher uses.
const DefaultIndexURL = "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json"

// Component aliases per the Mojang naming convention.
const (
	ComponentLegacy = "jre-legacy"
	ComponentAlpha  = "java-runtime-alpha"
	ComponentBeta   = "java-runtime-beta"
	ComponentDelta  = "java-runtime-delta"
	ComponentGamma  = "java-runtime-gamma"
	ComponentJavaXe = "minecraft-java-exe"
)

// downloadInfo is the (sha1, size, url) triple Mojang publishes for
// every artifact (manifest entries + per-file entries).
type downloadInfo struct {
	SHA1 string `json:"sha1"`
	Size int64  `json:"size"`
	URL  string `json:"url"`
}

// targetEntry is one per-platform component release.
type targetEntry struct {
	Manifest downloadInfo `json:"manifest"`
	Version  struct {
		Name     string `json:"name"`
		Released string `json:"released"`
	} `json:"version"`
}

// indexAll is the top-level shape of the upstream `all.json`.
//
// We decode every key as `map[string][]targetEntry` rather than the
// strongly-typed shape because Mojang occasionally adds a new
// component name (e.g. `java-runtime-delta` post-`gamma`) and we'd
// rather decode unknown keys into the generic map than fail.
type indexAll map[string]map[string][]targetEntry

// fileEntry is one row in the per-bundle manifest.
type fileEntry struct {
	Type       string `json:"type"` // "file" | "directory" | "link"
	Executable bool   `json:"executable,omitempty"`
	Target     string `json:"target,omitempty"` // for type=link
	Downloads  struct {
		Raw  *downloadInfo `json:"raw,omitempty"`
		LZMA *downloadInfo `json:"lzma,omitempty"`
	} `json:"downloads,omitempty"`
}

// manifest is the per-bundle manifest.
type manifest struct {
	Files map[string]fileEntry `json:"files"`
}

// Options configures Installer.Install.
type Options struct {
	// Destination is the root install dir
	// (e.g. `<gameDataPath>/jre`). Per-component subdirs get
	// created under it.
	Destination string
	// Component is the Mojang component name, e.g. "jre-legacy" or
	// "java-runtime-gamma". When empty we default to ComponentLegacy
	// (Java 8) which works for every vanilla MC version up to 1.16.
	Component string
	// IndexURLs is the candidate URL chain for `all.json`. Empty =
	// just the upstream default.
	IndexURLs []string
	// Concurrency caps parallel file downloads. Zero = 16.
	Concurrency int
	// Progress, when set, fires after every file completes (success
	// or failure). `done` counts only successful downloads.
	Progress func(done, total int)
}

// Result describes the installed bundle.
type Result struct {
	// ComponentDir is the directory the bundle was extracted to,
	// rooted at `<Destination>/<Component>/`.
	ComponentDir string
	// JavaPath is the conventional `java` / `javaw` binary the
	// launcher should invoke.
	JavaPath string
	// Version is the Mojang-reported version name (e.g. `8u51`).
	Version string
}

// Installer wraps the bundle install pipeline.
type Installer struct {
	client *network.Client
}

// New builds an Installer.
func New(client *network.Client) *Installer {
	if client == nil {
		panic("javaruntime: nil client")
	}
	return &Installer{client: client}
}

// Install fetches the index, picks the right per-platform target,
// downloads every file, and recreates the directory + symlink
// structure.
func (in *Installer) Install(ctx context.Context, opts Options) (*Result, error) {
	if opts.Destination == "" {
		return nil, errors.New("javaruntime: Destination required")
	}
	if opts.Component == "" {
		opts.Component = ComponentLegacy
	}
	if opts.Concurrency <= 0 {
		opts.Concurrency = 16
	}
	if len(opts.IndexURLs) == 0 {
		opts.IndexURLs = []string{DefaultIndexURL}
	}

	// 1. Fetch the index, pick the matching platform/component.
	index, err := in.fetchIndex(ctx, opts.IndexURLs)
	if err != nil {
		return nil, fmt.Errorf("javaruntime: fetch index: %w", err)
	}
	platformKey, err := platformKey()
	if err != nil {
		return nil, err
	}
	platform, ok := index[platformKey]
	if !ok {
		return nil, fmt.Errorf("javaruntime: no manifest for platform %q", platformKey)
	}
	targets := platform[opts.Component]
	if len(targets) == 0 {
		return nil, fmt.Errorf("javaruntime: no target for component %q on platform %q", opts.Component, platformKey)
	}
	target := targets[0]

	// 2. Fetch the per-bundle manifest.
	man, err := in.fetchManifest(ctx, target.Manifest.URL)
	if err != nil {
		return nil, fmt.Errorf("javaruntime: fetch manifest: %w", err)
	}

	// 3. Download every file entry in parallel. Directories +
	//    symlinks are deferred to a post-pass because os.Symlink
	//    requires the target to exist on Windows.
	root := filepath.Join(opts.Destination, opts.Component)
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}

	type fileTask struct {
		path   string // jar-relative
		dest   string // absolute
		entry  fileEntry
	}

	var (
		dirs    []string
		links   [][2]string // [name, target]
		files   []fileTask
	)
	// Order paths so dirs come before any contained entries even
	// though Mojang publishes them out of order.
	keys := make([]string, 0, len(man.Files))
	for k := range man.Files {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, name := range keys {
		ent := man.Files[name]
		switch ent.Type {
		case "directory":
			dirs = append(dirs, name)
		case "link":
			links = append(links, [2]string{name, ent.Target})
		case "file":
			if ent.Downloads.Raw == nil {
				continue
			}
			files = append(files, fileTask{path: name, dest: filepath.Join(root, name), entry: ent})
		}
	}
	for _, d := range dirs {
		if err := os.MkdirAll(filepath.Join(root, d), 0o755); err != nil {
			return nil, fmt.Errorf("javaruntime: mkdir %s: %w", d, err)
		}
	}

	total := len(files)
	if opts.Progress != nil {
		opts.Progress(0, total)
	}
	var done int
	items := make([]network.DownloadOptions, 0, len(files))
	for _, f := range files {
		raw := f.entry.Downloads.Raw
		items = append(items, network.DownloadOptions{
			URLs:         []string{raw.URL},
			Destination:  f.dest,
			ExpectedSHA1: raw.SHA1,
			ExpectedSize: raw.Size,
		})
	}
	// Watch progress as items complete via a poller that stats each
	// file on a fixed cadence. The bounded ticker keeps the goroutine
	// cheap and side-effect-free while DownloadAll is in flight.
	stop := make(chan struct{})
	done = 0
	go func() {
		ticker := time.NewTicker(250 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
			c := 0
			for _, f := range files {
				if info, err := os.Stat(f.dest); err == nil && info.Size() >= f.entry.Downloads.Raw.Size {
					c++
				}
			}
			if c != done {
				done = c
				if opts.Progress != nil {
					opts.Progress(done, total)
				}
			}
		}
	}()
	dlErr := in.client.DownloadAll(ctx, items, opts.Concurrency)
	close(stop)
	if dlErr != nil {
		return nil, fmt.Errorf("javaruntime: download files: %w", dlErr)
	}

	// 4. Apply executable bit.
	if runtime.GOOS != "windows" {
		for _, f := range files {
			if f.entry.Executable {
				_ = os.Chmod(f.dest, 0o755)
			}
		}
	}

	// 5. Create symlinks (or fall back to copies when the OS
	//    rejects unprivileged symlink creation, e.g. Windows
	//    without dev mode).
	for _, l := range links {
		linkPath := filepath.Join(root, l[0])
		_ = os.MkdirAll(filepath.Dir(linkPath), 0o755)
		// Remove pre-existing target to avoid "file exists" on retry.
		_ = os.Remove(linkPath)
		if err := os.Symlink(l[1], linkPath); err == nil {
			continue
		}
		// Fall back to a file copy when symlink creation isn't
		// permitted. Resolve the target relative to the link's
		// directory.
		src := filepath.Join(filepath.Dir(linkPath), l[1])
		if info, err := os.Stat(src); err == nil && !info.IsDir() {
			_ = copyFile(src, linkPath)
		}
	}

	// 6. Pick the conventional executable path.
	javaPath := PickExecutable(root)
	if opts.Progress != nil {
		opts.Progress(total, total)
	}
	return &Result{
		ComponentDir: root,
		JavaPath:     javaPath,
		Version:      target.Version.Name,
	}, nil
}

// PickExecutable returns the conventional `java` binary path under a
// Mojang JRE bundle root. Doesn't stat — callers can verify
// existence via `os.Stat`.
func PickExecutable(root string) string {
	switch runtime.GOOS {
	case "windows":
		// jre-legacy / java-runtime-* both put the binary at
		// `bin/javaw.exe` (windowed) or `bin/java.exe` (console).
		// The launcher prefers `javaw.exe` because it doesn't pop
		// a console window on the user.
		return filepath.Join(root, "bin", "javaw.exe")
	case "darwin":
		// Mojang ships macOS bundles under `jre.bundle/`.
		return filepath.Join(root, "jre.bundle", "Contents", "Home", "bin", "java")
	default:
		return filepath.Join(root, "bin", "java")
	}
}

// ============================================================
// Network helpers
// ============================================================

func (in *Installer) fetchIndex(ctx context.Context, urls []string) (indexAll, error) {
	var lastErr error
	for _, u := range urls {
		var raw indexAll
		if _, err := in.client.GetJSON(ctx, u, &raw); err != nil {
			lastErr = err
			continue
		}
		return raw, nil
	}
	if lastErr == nil {
		return nil, errors.New("javaruntime: no index URLs configured")
	}
	return nil, lastErr
}

func (in *Installer) fetchManifest(ctx context.Context, url string) (*manifest, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := in.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("status %s", resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var m manifest
	if err := json.Unmarshal(body, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// ============================================================
// Platform mapping
// ============================================================

// platformKey returns the Mojang index key for the current OS/arch.
func platformKey() (string, error) {
	switch runtime.GOOS {
	case "windows":
		switch runtime.GOARCH {
		case "amd64":
			return "windows-x64", nil
		case "386":
			return "windows-x86", nil
		case "arm64":
			return "windows-arm64", nil
		}
	case "darwin":
		switch runtime.GOARCH {
		case "amd64":
			return "mac-os", nil
		case "arm64":
			return "mac-os-arm64", nil
		}
	case "linux":
		switch runtime.GOARCH {
		case "amd64":
			return "linux", nil
		case "386":
			return "linux-i386", nil
		}
	}
	return "", fmt.Errorf("javaruntime: unsupported platform %s/%s", runtime.GOOS, runtime.GOARCH)
}

// ============================================================
// Tiny helpers
// ============================================================

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
	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return nil
}

