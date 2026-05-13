// Package instancedomain implements the shared scaffolding for
// "instance subfolder ↔ ResourceState" services
// (InstanceResourcePacksService, InstanceShaderPacksService,
// InstanceResourcesService).
//
// Each of those exposes:
//
//   - Watch(instancePath)  — SharedState[ResourceState] containing
//     one entry per file in the subfolder.
//   - Install / Uninstall  — file-level link/unlink under the dir.
//   - ShowDirectory        — renderer affordance (no-op on Go side).
//   - RefreshMetadata      — re-walk the directory.
//
// Resource pack files get their `pack.mcmeta` parsed so the renderer
// gets `description` + `pack_format` for free; shaderpacks have no
// loader-defined metadata, so we just surface `name` + `path` + size.
package instancedomain

import (
	"context"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/market"
	"github.com/voxelum/xmcl/wails/internal/network"
	"github.com/voxelum/xmcl/wails/internal/parsers/resourcepack"
	"github.com/voxelum/xmcl/wails/internal/resource"
)

// ParseResult bundles the per-file metadata + icon URIs produced by a
// MetaParser. Either / both may be nil.
type ParseResult struct {
	// Metadata is merged into the wire `metadata` object so the
	// renderer can read e.g. `metadata.resourcepack.pack_format`
	// directly.
	Metadata map[string]any
	// Icons is appended to the wire `icons` array. Entries are
	// arbitrary strings the renderer slots into `<img src=...>` —
	// `data:image/png;base64,…` is the simplest working choice
	// until the in-process image-store HTTP handler lands in G8.
	Icons []string
}

// MetaParser produces the per-file `metadata` map + icon URIs (or nil
// to skip) for a single file. Implementations live in the per-domain
// caller.
type MetaParser func(path string, name string) *ParseResult

// PNGToDataURI base64-encodes a raw PNG payload as a `data:` URI the
// renderer can drop straight into `<img>` without the image-store HTTP
// shim. Empty input returns an empty string.
func PNGToDataURI(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(b)
}

// Service is a re-usable backing for the per-domain services.
type Service struct {
	Host        *host.Host
	States      *bridge.StateManager
	Subdir      string     // e.g. "resourcepacks" / "shaderpacks"
	StateScheme string     // e.g. "instance-resourcepacks"
	Parse       MetaParser // optional per-file parser
	Domain      resource.Domain // overrides Subdir → resource.Domain when set

	mu      sync.Mutex
	watches map[string]*watch
}

type watch struct {
	state   *bridge.SharedState
	payload *contract.ResourceState
	once    sync.Once
}

// New constructs a Service. Subdir + StateScheme are required.
func New(h *host.Host, sm *bridge.StateManager, subdir, scheme string, parser MetaParser) *Service {
	return &Service{
		Host:        h,
		States:      sm,
		Subdir:      subdir,
		StateScheme: scheme,
		Parse:       parser,
		watches:     map[string]*watch{},
	}
}

// ============================================================
// Contract methods (shared signatures across the three services)
// ============================================================

// Watch returns the live ResourceState for the given instance.
func (s *Service) Watch(_ context.Context, instancePath string) (*bridge.SharedState, error) {
	if instancePath == "" {
		return nil, errors.New("Watch: instancePath required")
	}
	w := s.getWatch(instancePath)
	var initErr error
	w.once.Do(func() {
		initErr = s.populateWatch(instancePath, w)
	})
	if initErr != nil {
		return nil, initErr
	}
	return w.state, nil
}

// RefreshMetadata re-walks the directory and pushes a snapshot.
func (s *Service) RefreshMetadata(_ context.Context, instancePath string) error {
	if instancePath == "" {
		return errors.New("RefreshMetadata: instancePath required")
	}
	files, err := s.scan(instancePath)
	if err != nil {
		return err
	}
	s.mu.Lock()
	w, ok := s.watches[instancePath]
	if !ok || w.payload == nil {
		s.mu.Unlock()
		return nil
	}
	w.payload.Files = files
	state := w.state
	s.mu.Unlock()
	if state != nil {
		s.States.Push(s.stateID(instancePath), "filesUpdates", files)
	}
	return nil
}

// Install hard-links / copies the listed files into the subdir.
func (s *Service) Install(_ context.Context, options contract.UpdateInstanceResourcesOptions) ([]string, error) {
	if options.Path == "" {
		return nil, errors.New("Install: path required")
	}
	dir := filepath.Join(options.Path, s.Subdir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(options.Files))
	for _, src := range options.Files {
		dst := filepath.Join(dir, filepath.Base(src))
		if src == dst {
			out = append(out, dst)
			continue
		}
		if err := s.Host.Mutex.With("instance-domain:"+s.Subdir+":"+options.Path, func() error {
			return linkOrCopy(src, dst)
		}); err != nil {
			return out, err
		}
		out = append(out, dst)
	}
	if err := s.RefreshMetadata(context.Background(), options.Path); err != nil {
		s.Host.Logger.Warn("instancedomain: refresh after install failed", "err", err)
	}
	return out, nil
}

// Uninstall removes listed files from the subdir.
func (s *Service) Uninstall(_ context.Context, options contract.UpdateInstanceResourcesOptions) error {
	if options.Path == "" {
		return errors.New("Uninstall: path required")
	}
	dir := filepath.Join(options.Path, s.Subdir)
	for _, src := range options.Files {
		dst := filepath.Join(dir, filepath.Base(src))
		if err := s.Host.Mutex.With("instance-domain:"+s.Subdir+":"+options.Path, func() error {
			err := os.Remove(dst)
			if errors.Is(err, os.ErrNotExist) {
				return nil
			}
			return err
		}); err != nil {
			s.Host.Logger.Warn("instancedomain: uninstall failed", "src", dst, "err", err)
		}
	}
	return s.RefreshMetadata(context.Background(), options.Path)
}

// InstallFromMarket downloads the requested Modrinth/CurseForge
// files into the per-domain subdir under `<instancePath>`. Returns
// the absolute on-disk paths of every successful download (the
// renderer cross-checks these against its in-flight project entries).
//
// The wire payload follows `InstallMarketOptionWithInstance` from
// `xmcl-runtime-api`: `{ market: 0|1, version|file: T|T[],
// instancePath: string }`. Verification + atomic rename are
// inherited from `network.Client.Download`.
func (s *Service) InstallFromMarket(ctx context.Context, options map[string]any) ([]string, error) {
	instancePath := stringOf(options["instancePath"])
	if instancePath == "" {
		return nil, errors.New("InstallFromMarket: instancePath required")
	}
	files, err := market.NewResolver(s.Host.HTTP, s.Host.CurseforgeAPIKey).Resolve(ctx, options)
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return []string{}, nil
	}
	dir := filepath.Join(instancePath, s.Subdir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}

	out := make([]string, 0, len(files))
	for _, f := range files {
		dst := filepath.Join(dir, f.Filename)
		err := s.Host.Mutex.With("instance-domain:"+s.Subdir+":"+instancePath, func() error {
			return s.Host.HTTP.Download(ctx, network.DownloadOptions{
				URLs:         f.URLs,
				Destination:  dst,
				ExpectedSHA1: f.SHA1,
				ExpectedSize: f.Size,
			})
		})
		if err != nil {
			s.Host.Logger.Warn("instancedomain: market install failed", "file", f.Filename, "err", err)
			return out, err
		}
		out = append(out, dst)
	}
	if err := s.RefreshMetadata(context.Background(), instancePath); err != nil {
		s.Host.Logger.Warn("instancedomain: refresh after market install failed", "err", err)
	}
	return out, nil
}

// stringOf is a tiny accessor for the renderer's loose JSON payloads.
func stringOf(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// ShowDirectory opens the per-instance subdir in the user's native
// file manager. Errors are swallowed so the renderer never sees a
// platform-specific shell failure (the action is best-effort).
func (s *Service) ShowDirectory(_ context.Context, instancePath string) error {
	if instancePath == "" {
		return errors.New("ShowDirectory: instancePath required")
	}
	dir := filepath.Join(instancePath, s.Subdir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	if err := host.OpenInFileManager(dir); err != nil {
		s.Host.Logger.Warn("instancedomain: ShowDirectory", "dir", dir, "err", err)
	}
	return nil
}

// ============================================================
// Internals
// ============================================================

func (s *Service) getWatch(instancePath string) *watch {
	s.mu.Lock()
	defer s.mu.Unlock()
	if w, ok := s.watches[instancePath]; ok {
		return w
	}
	w := &watch{}
	s.watches[instancePath] = w
	return w
}

func (s *Service) populateWatch(instancePath string, w *watch) error {
	files, err := s.scan(instancePath)
	if err != nil {
		return err
	}
	w.payload = &contract.ResourceState{Files: files}
	w.state = s.States.Register(bridge.StateOpts{
		ID:        s.stateID(instancePath),
		StateName: "ResourceState",
		Payload:   w.payload,
		// When the renderer drops its last reference, the bridge
		// calls Dispose. Drop the per-instance cache too so the
		// next Watch re-registers a fresh state instead of
		// returning a dead handle that yields UnknownState on
		// SerializeState.
		Dispose: func() { s.dropWatch(instancePath) },
	})
	return nil
}

// dropWatch removes the cached watch for an instance. Called from
// the bridge's Dispose hook (last-client-unref).
func (s *Service) dropWatch(instancePath string) {
	s.mu.Lock()
	delete(s.watches, instancePath)
	s.mu.Unlock()
}

// scan walks the subdir and produces a Resource map per file. Hidden
// files (`.foo`) are skipped. Routes through the SQLite resource
// manager when one is registered (cached snapshot fast-path);
// otherwise live-stats every file.
func (s *Service) scan(instancePath string) ([]any, error) {
	dir := filepath.Join(instancePath, s.Subdir)
	if mgr := s.manager(); mgr != nil {
		return s.scanWithManager(mgr, dir)
	}
	return s.scanLive(dir)
}

// manager returns the registered resource.Manager, or nil when none
// is wired (tests / dev builds without SQLite).
func (s *Service) manager() *resource.Manager {
	if s.Host == nil || s.Host.Registry == nil {
		return nil
	}
	mgr, _ := host.Get[*resource.Manager](s.Host.Registry)
	return mgr
}

// scanWithManager drives the catalogue. Each FileEntry is converted
// into the wire `Resource` map. Cached metadata + icons + uris are
// merged in directly so a re-scan after the first launch is just
// stat() + a SQLite read.
func (s *Service) scanWithManager(mgr *resource.Manager, dir string) ([]any, error) {
	dom := s.Domain
	if dom == "" {
		dom = resource.Domain(s.Subdir)
	}
	entries, err := mgr.Scan(context.Background(), dir, dom)
	if err != nil {
		return nil, err
	}
	out := make([]any, 0, len(entries))
	for _, e := range entries {
		res := contract.Resource{
			Version:  3,
			Name:     baseName(e.FileName),
			Hash:     e.Snapshot.SHA1,
			Path:     e.Path,
			FileName: e.FileName,
			Size:     float64(e.Size),
			Mtime:    float64(e.Mtime),
			Atime:    float64(e.Atime),
			Ctime:    float64(e.Ctime),
			Ino:      float64(e.Ino),
		}
		raw, err := json.Marshal(&res)
		if err != nil {
			continue
		}
		var entryMap map[string]any
		if err := json.Unmarshal(raw, &entryMap); err != nil {
			continue
		}
		if e.Stored != nil {
			if e.Stored.Name != "" {
				entryMap["name"] = e.Stored.Name
			}
			if len(e.Stored.Metadata) > 0 {
				entryMap["metadata"] = e.Stored.Metadata
			}
			if len(e.Stored.Icons) > 0 {
				entryMap["icons"] = e.Stored.Icons
			}
			if len(e.Stored.URIs) > 0 {
				entryMap["uris"] = e.Stored.URIs
			}
		}
		out = append(out, entryMap)
	}
	return out, nil
}

// scanLive is the fallback path used when the resource catalogue
// isn't wired. Re-stats / re-hashes every file on every call.
func (s *Service) scanLive(dir string) ([]any, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []any{}, nil
		}
		return nil, err
	}
	out := make([]any, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		path := filepath.Join(dir, name)
		hash, _ := sha1OfFile(path)
		mt := float64(info.ModTime().UnixMilli())

		res := contract.Resource{
			Version:     1,
			Name:        baseName(name),
			Hash:        hash,
			Path:        path,
			FileName:    name,
			Size:        float64(info.Size()),
			Mtime:       mt,
			Atime:       mt,
			Ctime:       mt,
			IsDirectory: info.IsDir(),
		}

		// Project the typed Resource into a map so we can merge in
		// the per-file metadata (resource pack `pack.mcmeta`, etc.)
		// without poking through generated struct tags.
		raw, err := json.Marshal(&res)
		if err != nil {
			s.Host.Logger.Warn("instancedomain: marshal", "path", path, "err", err)
			continue
		}
		var entryMap map[string]any
		if err := json.Unmarshal(raw, &entryMap); err != nil {
			continue
		}
		if s.Parse != nil {
			if extra := s.Parse(path, name); extra != nil {
				if extra.Metadata != nil {
					entryMap["metadata"] = extra.Metadata
				}
				if len(extra.Icons) > 0 {
					entryMap["icons"] = extra.Icons
				}
			}
		}
		out = append(out, entryMap)
	}
	return out, nil
}

func (s *Service) stateID(instancePath string) string {
	return s.StateScheme + "://" + instancePath
}

// ============================================================
// Filesystem helpers
// ============================================================

// baseName strips the conventional `.zip`/`.disabled` suffix off a
// file name so the renderer's display name reads cleanly.
func baseName(name string) string {
	n := strings.TrimSuffix(name, ".disabled")
	for _, ext := range []string{".zip", ".jar"} {
		n = strings.TrimSuffix(n, ext)
	}
	return n
}

// linkOrCopy hard-links src→dst when possible, falling back to a copy.
func linkOrCopy(src, dst string) error {
	if existing, err := os.Stat(dst); err == nil {
		if srcStat, err := os.Stat(src); err == nil {
			if os.SameFile(existing, srcStat) {
				return nil
			}
			if err := os.Remove(dst); err != nil {
				return err
			}
		}
	}
	if err := os.Link(src, dst); err == nil {
		return nil
	}
	return copyFile(src, dst)
}

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

func sha1OfFile(path string) (string, error) {
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

// ============================================================
// Built-in parsers
// ============================================================

// ParseResourcePack reads `pack.mcmeta` + `pack.png` from a `.zip`
// resource pack, returning a ParseResult shaped like the renderer's
// `ResourceMetadata` resource-pack block. The pack icon (when
// present) is surfaced as a single `data:` URI in `Icons[0]` so the
// renderer's existing `resource.icons[0]` consumers light up
// without an HTTP image handler.
func ParseResourcePack(path, name string) *ParseResult {
	if !strings.HasSuffix(strings.ToLower(strings.TrimSuffix(name, ".disabled")), ".zip") {
		return nil
	}
	src, err := resourcepack.OpenSource(path)
	if err != nil {
		return nil
	}
	defer src.Close()
	mi, err := resourcepack.ReadPackMetaAndIcon(src)
	if err != nil {
		return nil
	}
	r := &ParseResult{
		Metadata: map[string]any{
			"resourcepack": map[string]any{
				// Keep both keys so the renderer's
				// `meta.format ?? meta.pack_format` fallback resolves.
				"format":      mi.Metadata.PackFormat,
				"pack_format": mi.Metadata.PackFormat,
				"description": mi.Metadata.Description,
			},
		},
	}
	if uri := PNGToDataURI(mi.Icon); uri != "" {
		r.Icons = []string{uri}
	}
	return r
}
