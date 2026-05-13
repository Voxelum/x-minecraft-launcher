// Package instancemods implements contract.InstanceModsService.
//
// Provides on-disk operations for `<instance>/mods/` files plus a
// `Watch(instancePath)` SharedState that mirrors the directory
// contents as a `ResourceState`. Each `.jar` is parsed via the
// modparser package so the renderer gets typed metadata (forge /
// fabric / quilt + manifest fields) without having to crack jars
// itself.
//
// Per-watch state caching keeps the disk walk one-shot per
// instance; `RefreshMetadata` re-scans on demand.
package instancemods

import (
	"context"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
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
	"github.com/voxelum/xmcl/wails/internal/parsers/modparser"
	"github.com/voxelum/xmcl/wails/internal/resource"
)

// modsSubdir is the conventional Minecraft mods folder under each
// instance root.
const modsSubdir = "mods"

// Service implements contract.InstanceModsService.
type Service struct {
	contract.InstanceModsServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	mu       sync.Mutex
	watches  map[string]*watch // instancePath → watch
}

// watch caches the SharedState + payload for a single instance so
// repeated `Watch` calls return the same handle.
type watch struct {
	state   *bridge.SharedState
	payload *contract.ResourceState
	once    sync.Once
}

// New constructs an InstanceModsService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{
		host:    h,
		states:  sm,
		watches: map[string]*watch{},
	}
}

var _ contract.InstanceModsService = (*Service)(nil)

// ============================================================
// Watch
// ============================================================

// Watch returns the live ResourceState SharedState for the named
// instance, scanning the mods directory on first call.
//
// The state id mirrors the TS convention so the renderer can dedupe
// references across reloads: `instance-mods://<instancePath>`.
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

// RefreshMetadata re-walks the mods directory and pushes a snapshot
// replace to the renderer. Real metadata enrichment (curseforge /
// modrinth fingerprinting) lands in G5/G6 alongside the network
// layer.
func (s *Service) RefreshMetadata(_ context.Context, instancePath string) error {
	w := s.getWatch(instancePath)
	files, err := s.scan(instancePath)
	if err != nil {
		return err
	}
	s.mu.Lock()
	if w.payload == nil {
		// Watch() hasn't run yet — refresh can still proceed for
		// callers like Enable/Disable, but we won't push since
		// nobody's subscribed.
		w.payload = &contract.ResourceState{Files: files}
		s.mu.Unlock()
		return nil
	}
	w.payload.Files = files
	state := w.state
	s.mu.Unlock()
	if state == nil {
		return nil
	}
	// `refresh` isn't a TS-side mutation name; we push under "refresh"
	// and rely on the renderer's `subscribeAll` listener to react. If
	// individual file deltas are needed later, switch to per-file
	// commits emitted by a watcher goroutine.
	s.states.Push(stateIDFor(instancePath), "refresh", files)
	return nil
}

// ============================================================
// Enable / Disable
// ============================================================

// Enable strips the `.disabled` suffix from every file in `files` that
// sits in `<path>/mods/`. Files outside the directory are skipped
// with a log line (mirrors the TS reference).
func (s *Service) Enable(_ context.Context, options contract.UpdateInstanceResourcesOptions) error {
	if options.Path == "" {
		return errors.New("Enable: path required")
	}
	dir := filepath.Join(options.Path, modsSubdir)
	for _, src := range options.Files {
		if filepath.Dir(src) != dir {
			s.host.Logger.Warn("instancemods: enable: unmanaged file", "src", src)
			continue
		}
		if !strings.HasSuffix(src, ".disabled") {
			s.host.Logger.Warn("instancemods: enable: already enabled", "src", src)
			continue
		}
		dst := strings.TrimSuffix(src, ".disabled")
		if err := s.host.Mutex.With("instance-mods:"+options.Path, func() error {
			return os.Rename(src, dst)
		}); err != nil {
			s.host.Logger.Warn("instancemods: enable failed", "src", src, "err", err)
		}
	}
	return s.RefreshMetadata(context.Background(), options.Path)
}

// Disable appends `.disabled` to every file in `files` that sits in
// `<path>/mods/`.
func (s *Service) Disable(_ context.Context, options contract.UpdateInstanceResourcesOptions) error {
	if options.Path == "" {
		return errors.New("Disable: path required")
	}
	dir := filepath.Join(options.Path, modsSubdir)
	for _, src := range options.Files {
		if filepath.Dir(src) != dir {
			s.host.Logger.Warn("instancemods: disable: unmanaged file", "src", src)
			continue
		}
		if strings.HasSuffix(src, ".disabled") {
			s.host.Logger.Warn("instancemods: disable: already disabled", "src", src)
			continue
		}
		dst := src + ".disabled"
		if err := s.host.Mutex.With("instance-mods:"+options.Path, func() error {
			return os.Rename(src, dst)
		}); err != nil {
			s.host.Logger.Warn("instancemods: disable failed", "src", src, "err", err)
		}
	}
	return s.RefreshMetadata(context.Background(), options.Path)
}

// ============================================================
// Install / Uninstall
// ============================================================

// Install copies the given files into `<path>/mods/`. We attempt a
// hard link first (cheap on the same filesystem) and fall back to a
// byte-copy. Mirrors the TS reference's `linkWithTimeoutOrCopy`.
func (s *Service) Install(_ context.Context, options contract.UpdateInstanceResourcesOptions) ([]string, error) {
	if options.Path == "" {
		return nil, errors.New("Install: path required")
	}
	dir := filepath.Join(options.Path, modsSubdir)
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
		if err := s.host.Mutex.With("instance-mods:"+options.Path, func() error {
			return linkOrCopy(src, dst)
		}); err != nil {
			return out, err
		}
		out = append(out, dst)
	}
	if err := s.RefreshMetadata(context.Background(), options.Path); err != nil {
		s.host.Logger.Warn("instancemods: refresh after install failed", "err", err)
	}
	return out, nil
}

// InstallFromMarket downloads the requested Modrinth/CurseForge mod
// files into `<instancePath>/mods/`. Wire payload mirrors
// `InstallMarketOptionWithInstance` from `xmcl-runtime-api`.
//
// We deliberately don't dedupe on existing on-disk hashes here —
// `network.Client.Download`'s fast-path already short-circuits when
// the destination matches `ExpectedSHA1`.
func (s *Service) InstallFromMarket(ctx context.Context, options map[string]any) ([]string, error) {
	instancePath, _ := options["instancePath"].(string)
	if instancePath == "" {
		return nil, errors.New("InstallFromMarket: instancePath required")
	}
	files, err := market.NewResolver(s.host.HTTP, s.host.CurseforgeAPIKey).Resolve(ctx, options)
	if err != nil {
		return nil, err
	}
	dir := filepath.Join(instancePath, modsSubdir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(files))
	for _, f := range files {
		dst := filepath.Join(dir, f.Filename)
		err := s.host.Mutex.With("instance-mods:"+instancePath, func() error {
			return s.host.HTTP.Download(ctx, network.DownloadOptions{
				URLs:         f.URLs,
				Destination:  dst,
				ExpectedSHA1: f.SHA1,
				ExpectedSize: f.Size,
			})
		})
		if err != nil {
			s.host.Logger.Warn("instancemods: market install failed", "file", f.Filename, "err", err)
			return out, err
		}
		out = append(out, dst)
	}
	if err := s.RefreshMetadata(context.Background(), instancePath); err != nil {
		s.host.Logger.Warn("instancemods: refresh after market install failed", "err", err)
	}
	return out, nil
}

// Uninstall removes the given files from `<path>/mods/` (idempotent).
func (s *Service) Uninstall(_ context.Context, options contract.UpdateInstanceResourcesOptions) error {
	if options.Path == "" {
		return errors.New("Uninstall: path required")
	}
	dir := filepath.Join(options.Path, modsSubdir)
	for _, src := range options.Files {
		dst := filepath.Join(dir, filepath.Base(src))
		if err := s.host.Mutex.With("instance-mods:"+options.Path, func() error {
			err := os.Remove(dst)
			if errors.Is(err, os.ErrNotExist) {
				return nil
			}
			return err
		}); err != nil {
			s.host.Logger.Warn("instancemods: uninstall failed", "src", dst, "err", err)
		}
	}
	return s.RefreshMetadata(context.Background(), options.Path)
}

// ShowDirectory opens `<instance>/mods/` in the user's native file
// manager.
func (s *Service) ShowDirectory(_ context.Context, instancePath string) error {
	if instancePath == "" {
		return errors.New("ShowDirectory: instancePath required")
	}
	dir := filepath.Join(instancePath, modsSubdir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	if err := host.OpenInFileManager(dir); err != nil {
		s.host.Logger.Warn("instancemods: ShowDirectory", "dir", dir, "err", err)
	}
	return nil
}

// ============================================================
// Server-instance helpers
// ============================================================

// GetServerInstanceMods enumerates `<path>/server/mods/` (used when
// the user launches the instance with a bundled server). Returns
// each file's basename + on-disk inode (or stable id surrogate) for
// renderer-side diffing.
func (s *Service) GetServerInstanceMods(_ context.Context, path string) ([]map[string]any, error) {
	dir := filepath.Join(path, "server", modsSubdir)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []map[string]any{}, nil
		}
		return nil, err
	}
	out := make([]map[string]any, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, map[string]any{
			"fileName": e.Name(),
			"ino":      info.Size(), // platform-stable surrogate; renderer only uses it for de-dupe
		})
	}
	return out, nil
}

// InstallToServerInstance empties `<path>/server/mods/` then installs
// the given files into it. Mirrors the TS reference.
func (s *Service) InstallToServerInstance(_ context.Context, options contract.UpdateInstanceResourcesOptions) error {
	if options.Path == "" {
		return errors.New("InstallToServerInstance: path required")
	}
	dir := filepath.Join(options.Path, "server", modsSubdir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	// Empty the directory: read entries, remove each.
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, e := range entries {
		_ = os.Remove(filepath.Join(dir, e.Name()))
	}
	return s.host.Mutex.With("instance-server-mods:"+options.Path, func() error {
		for _, src := range options.Files {
			dst := filepath.Join(dir, filepath.Base(src))
			if err := linkOrCopy(src, dst); err != nil {
				return err
			}
		}
		return nil
	})
}

// SearchInstalled queries the SQLite resource catalogue for mods
// whose name contains `keyword` (case-insensitive). When the
// catalogue isn't wired (no SQLite, dev mode), returns an empty
// slice so the renderer's search input doesn't crash.
func (s *Service) SearchInstalled(_ context.Context, keyword string) ([]contract.Resource, error) {
	mgr := s.manager()
	if mgr == nil {
		return []contract.Resource{}, nil
	}
	hits, err := mgr.SearchByName(keyword, resource.DomainMods)
	if err != nil {
		return nil, err
	}
	out := make([]contract.Resource, 0, len(hits))
	for _, h := range hits {
		out = append(out, contract.Resource{
			Version:  3,
			Name:     h.Name,
			Hash:     h.SHA1,
			Icons:    h.Icons,
			Metadata: storedMetadataToContract(h.Metadata),
		})
	}
	return out, nil
}

// storedMetadataToContract collapses a free-form metadata map into
// the typed contract.ResourceMetadata where possible. Unknown keys
// are dropped (they live in the SQLite blob if a caller needs the
// raw shape).
func storedMetadataToContract(in map[string]any) contract.ResourceMetadata {
	out := contract.ResourceMetadata{}
	if in == nil {
		return out
	}
	if v, ok := in["forge"]; ok {
		var fmm contract.ForgeModCommonMetadata
		if jsonRoundtrip(v, &fmm) == nil {
			out.Forge = &fmm
		}
	}
	if v, ok := in["neoforge"]; ok {
		var nmm contract.NeoforgeMetadata
		if jsonRoundtrip(v, &nmm) == nil {
			out.Neoforge = &nmm
		}
	}
	if v, ok := in["fabric"]; ok {
		out.Fabric = v
	}
	if v, ok := in["quilt"]; ok {
		var qmm contract.QuiltModMetadata
		if jsonRoundtrip(v, &qmm) == nil {
			out.Quilt = &qmm
		}
	}
	if v, ok := in["resourcepack"]; ok {
		var p contract.Pack
		if jsonRoundtrip(v, &p) == nil {
			out.Resourcepack = &p
		}
	}
	return out
}

// jsonRoundtrip marshals `v` then unmarshals into `out`. Returns
// nil on success or the first error encountered.
func jsonRoundtrip(v, out any) error {
	raw, err := jsonMarshal(v)
	if err != nil {
		return err
	}
	return jsonUnmarshal(raw, out)
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
	w.state = s.states.Register(bridge.StateOpts{
		ID:        stateIDFor(instancePath),
		StateName: "ResourceState",
		Payload:   w.payload,
		// No renderer-driven mutators on this state (the TS reference
		// has none either — file lists are read-only from the
		// renderer's POV).
		Mutators: nil,
	})
	return nil
}

// scan walks `<instancePath>/mods/` and produces a Resource per file
// (jar or jar.disabled). Uses the SQLite-backed `resource.Manager`
// when one is registered (cached snapshot fast-path), otherwise
// falls back to a live scan via the local jar parsers.
func (s *Service) scan(instancePath string) ([]any, error) {
	dir := filepath.Join(instancePath, modsSubdir)
	if mgr := s.manager(); mgr != nil {
		return s.scanWithManager(mgr, dir)
	}
	return s.scanLive(dir)
}

// manager returns the registered resource.Manager, or nil when one
// hasn't been wired (tests / dev builds without SQLite).
func (s *Service) manager() *resource.Manager {
	if s.host == nil || s.host.Registry == nil {
		return nil
	}
	mgr, _ := host.Get[*resource.Manager](s.host.Registry)
	return mgr
}

// scanWithManager drives the catalogue and converts each FileEntry
// into the wire map the renderer expects.
func (s *Service) scanWithManager(mgr *resource.Manager, dir string) ([]any, error) {
	entries, err := mgr.Scan(context.Background(), dir, resource.DomainMods)
	if err != nil {
		return nil, err
	}
	out := make([]any, 0, len(entries))
	for _, e := range entries {
		out = append(out, fileEntryToWire(e))
	}
	return out, nil
}

// fileEntryToWire converts a resource.FileEntry into the
// contract.Resource map shape the SharedState ships.
func fileEntryToWire(e resource.FileEntry) map[string]any {
	name := strings.TrimSuffix(strings.TrimSuffix(e.FileName, ".disabled"), ".jar")
	res := contract.Resource{
		Version:  3,
		Name:     name,
		Hash:     e.Snapshot.SHA1,
		Path:     e.Path,
		FileName: e.FileName,
		Size:     float64(e.Size),
		Mtime:    float64(e.Mtime),
		Atime:    float64(e.Atime),
		Ctime:    float64(e.Ctime),
		Ino:      float64(e.Ino),
	}
	m, err := structToMap(&res)
	if err != nil {
		m = map[string]any{}
	}
	if e.Stored != nil {
		if e.Stored.Name != "" {
			m["name"] = e.Stored.Name
		}
		if len(e.Stored.Metadata) > 0 {
			md, _ := m["metadata"].(map[string]any)
			if md == nil {
				md = map[string]any{}
			}
			for k, v := range e.Stored.Metadata {
				md[k] = v
			}
			m["metadata"] = md
		}
		if len(e.Stored.Icons) > 0 {
			m["icons"] = e.Stored.Icons
		}
		if len(e.Stored.URIs) > 0 {
			m["uris"] = e.Stored.URIs
		}
		if len(e.Stored.Tags) > 0 {
			m["tags"] = e.Stored.Tags
		}
	}
	return m
}

// scanLive is the legacy path used when the resource catalogue
// isn't available. Re-hashes and re-parses every file on every call
// — noticeably slower for large mod folders but functional.
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
		if e.IsDir() {
			continue
		}
		name := e.Name()
		info, err := e.Info()
		if err != nil {
			continue
		}
		path := filepath.Join(dir, name)

		res, err := s.resourceFromFile(path, name, info)
		if err != nil {
			s.host.Logger.Warn("instancemods: scan: skip", "path", path, "err", err)
			continue
		}
		out = append(out, res)
	}
	return out, nil
}

// resourceFromFile builds the contract.Resource for a single mods/<f>
// file. Returns a json-encodable map so the SharedState wire stays
// faithful to the TS shape (it serializes Resource as an arbitrary
// object).
func (s *Service) resourceFromFile(path, name string, info os.FileInfo) (map[string]any, error) {
	stat := osStat(info)
	res := contract.Resource{
		Version:     1,
		Name:        strings.TrimSuffix(strings.TrimSuffix(name, ".disabled"), ".jar"),
		Path:        path,
		FileName:    name,
		Size:        float64(info.Size()),
		Mtime:       stat.mtime,
		Atime:       stat.atime,
		Ctime:       stat.ctime,
		Ino:         stat.ino,
		IsDirectory: info.IsDir(),
	}

	// Only crack open .jar files. `.disabled` mods are jars too once
	// you strip the suffix; some users use `.zip` / `.litemod` but
	// those are out of scope for G6 (per migration decision —
	// LiteLoader dropped from modparser).
	var extras map[string]any
	var icons []string
	if strings.HasSuffix(strings.ToLower(strings.TrimSuffix(name, ".disabled")), ".jar") {
		hash, err := sha1OfFile(path)
		if err == nil {
			res.Hash = hash
		}

		jar, err := modparser.OpenJar(path)
		if err == nil {
			defer jar.Close()
			res.Metadata, extras, icons = collectMetadata(jar)
		}
	}

	// Convert to map for SharedState wire fidelity.
	m, err := structToMap(&res)
	if err != nil {
		return nil, err
	}

	// Merge fabric/quilt/liteloader keys (computed property names the
	// codegen had to drop) into the wire `metadata` object so the
	// renderer's `resource.metadata.fabric` / `.quilt` consumers
	// resolve.
	if len(extras) > 0 {
		md, _ := m["metadata"].(map[string]any)
		if md == nil {
			md = map[string]any{}
		}
		for k, v := range extras {
			md[k] = v
		}
		m["metadata"] = md
	}
	if len(icons) > 0 {
		m["icons"] = icons
	}
	return m, nil
}

// collectMetadata runs every loader-specific parser and stitches the
// results into:
//
//   - contract.ResourceMetadata — the typed fields the codegen emits
//     (forge / neoforge today),
//   - extras map — JSON keys the codegen had to drop because the TS
//     interface uses computed property names (`fabric` / `quilt` /
//     `liteloader`); merged into the wire `metadata` object,
//   - icons — `data:` URIs extracted from in-jar logo files
//     (`logoFile` for forge/neoforge, `icon` for fabric).
//
// The neoforge vs forge split is driven by the actual jar entry
// present: a jar shipping `META-INF/neoforge.mods.toml` is reported as
// neoforge metadata; one shipping `META-INF/mods.toml` (only) is
// reported as forge.
func collectMetadata(jar *modparser.JarSource) (contract.ResourceMetadata, map[string]any, []string) {
	out := contract.ResourceMetadata{}
	extras := map[string]any{}
	var icons []string
	addIcon := func(jarPath string) {
		if jarPath == "" {
			return
		}
		uri := jarIconAsDataURI(jar, jarPath)
		if uri != "" {
			icons = append(icons, uri)
		}
	}

	if fabric, err := modparser.ReadFabricMod(jar); err == nil && fabric != nil {
		// Pass through under the `fabric` computed-key the renderer
		// expects (see ResourceMetadata.ts in `packages/resource/`).
		extras["fabric"] = fabric
		if iconPath, ok := fabricIconPath(fabric.Icon); ok {
			addIcon(iconPath)
		}
	}
	if quilt, err := modparser.ReadQuiltMod(jar); err == nil && quilt != nil {
		extras["quilt"] = quilt
		if quilt.QuiltLoader.Metadata != nil {
			if iconPath, ok := fabricIconPath(quilt.QuiltLoader.Metadata.Icon); ok {
				addIcon(iconPath)
			}
		}
	}
	if forge, err := modparser.ReadForgeMod(jar); err == nil && forge != nil {
		isNeoforge := jar.HasEntry("META-INF/neoforge.mods.toml")
		if isNeoforge {
			out.Neoforge = neoforgeFromForge(forge)
			if out.Neoforge != nil {
				addIcon(out.Neoforge.LogoFile)
			}
		} else {
			out.Forge = forgeFromForge(forge)
			if out.Forge != nil {
				addIcon(out.Forge.LogoFile)
			}
		}
	}
	return out, extras, icons
}

// forgeFromForge promotes the canonical fields off the parser output
// so the renderer's `resource.metadata.forge.{modid,name,version,…}`
// reads resolve.
func forgeFromForge(forge *modparser.ForgeModMetadata) *contract.ForgeModCommonMetadata {
	fmm := &contract.ForgeModCommonMetadata{
		McmodInfo: convertMcmodInfo(forge.McmodInfo),
		Manifest:  manifestToMap(forge.Manifest),
		ModsToml:  convertToml(forge.ModsToml),
	}
	if forge.ManifestMetadata != nil {
		fmm.ManifestMetadata = &contract.ManifestMetadata{
			Modid:       forge.ManifestMetadata.Modid,
			Name:        forge.ManifestMetadata.Name,
			Authors:     forge.ManifestMetadata.Authors,
			Version:     forge.ManifestMetadata.Version,
			Description: forge.ManifestMetadata.Description,
			Url:         forge.ManifestMetadata.URL,
		}
	}
	if len(forge.ModsToml) > 0 {
		t := forge.ModsToml[0]
		fmm.Modid = t.Modid
		fmm.Name = t.DisplayName
		fmm.Version = t.Version
		fmm.Description = t.Description
		fmm.LogoFile = t.LogoFile
		if t.Authors != "" {
			fmm.Authors = []string{t.Authors}
		}
	} else if len(forge.McmodInfo) > 0 {
		i := forge.McmodInfo[0]
		fmm.Modid = i.Modid
		fmm.Name = i.Name
		fmm.Version = i.Version
		fmm.Description = i.Description
		fmm.LogoFile = i.LogoFile
		fmm.Authors = i.AuthorList
	} else if forge.ManifestMetadata != nil {
		fmm.Modid = forge.ManifestMetadata.Modid
		fmm.Name = forge.ManifestMetadata.Name
		fmm.Version = forge.ManifestMetadata.Version
		fmm.Description = forge.ManifestMetadata.Description
		fmm.Authors = forge.ManifestMetadata.Authors
	}
	return fmm
}

// neoforgeFromForge reshapes the shared parser output into the typed
// NeoforgeMetadata block the codegen emitted from the TS reference.
// All TOML entries are surfaced under `Children`; the first entry's
// canonical fields are promoted to the top level so the renderer's
// `resource.metadata.neoforge.{modid,displayName,version,…}` reads
// resolve.
func neoforgeFromForge(forge *modparser.ForgeModMetadata) *contract.NeoforgeMetadata {
	if len(forge.ModsToml) == 0 {
		return nil
	}
	first := forge.ModsToml[0]
	n := &contract.NeoforgeMetadata{
		Children:        convertToml(forge.ModsToml),
		Modid:           first.Modid,
		Version:         first.Version,
		DisplayName:     first.DisplayName,
		UpdateJSONURL:   first.UpdateJSONURL,
		DisplayURL:      first.DisplayURL,
		LogoFile:        first.LogoFile,
		Credits:         first.Credits,
		Authors:         first.Authors,
		Description:     first.Description,
		Provides:        first.Provides,
		ModLoader:       first.ModLoader,
		LoaderVersion:   first.LoaderVersion,
		IssueTrackerURL: first.IssueTrackerURL,
		ClientSideOnly:  first.ClientSideOnly,
	}
	n.Dependencies = make([]map[string]any, len(first.Dependencies))
	for i, d := range first.Dependencies {
		n.Dependencies[i] = map[string]any{
			"modId":        d.ModId,
			"mandatory":    d.Mandatory,
			"versionRange": d.VersionRange,
			"ordering":     d.Ordering,
			"side":         d.Side,
		}
	}
	return n
}

// fabricIconPath normalises the polymorphic `icon` field on
// fabric.mod.json (string | { sizeStr: pathStr }) to a single jar
// path. Returns false if no icon is set.
func fabricIconPath(v any) (string, bool) {
	switch x := v.(type) {
	case string:
		if x != "" {
			return x, true
		}
	case map[string]any:
		// Pick the largest numeric key (e.g. `"128"` → 128) so we
		// surface the highest-resolution icon the mod ships.
		var bestKey int
		var bestPath string
		for k, val := range x {
			s, ok := val.(string)
			if !ok || s == "" {
				continue
			}
			size := atoi(k)
			if size >= bestKey {
				bestKey = size
				bestPath = s
			}
		}
		if bestPath != "" {
			return bestPath, true
		}
	}
	return "", false
}

// atoi is a non-erroring strconv.Atoi for icon-size keys (`"64"` etc).
func atoi(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + int(c-'0')
	}
	return n
}

// jarIconAsDataURI reads the named entry from the jar (with the
// conventional leading-slash trim) and base64-encodes it into a PNG
// `data:` URI. Empty / missing entries return "".
func jarIconAsDataURI(jar *modparser.JarSource, path string) string {
	if path == "" {
		return ""
	}
	path = strings.TrimPrefix(path, "/")
	data, err := jar.ReadEntry(path)
	if err != nil || len(data) == 0 {
		return ""
	}
	// Always tag as PNG — every loader's mod-icon convention is PNG;
	// the few JPEG outliers will display fine via `data:image/png`
	// in modern WebViews (browsers sniff the header).
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(data)
}

func convertMcmodInfo(in []modparser.ForgeModMcmodInfo) []contract.ForgeModMcmodInfo {
	out := make([]contract.ForgeModMcmodInfo, len(in))
	for i, m := range in {
		out[i] = contract.ForgeModMcmodInfo{
			Modid:                    m.Modid,
			Name:                     m.Name,
			Description:              m.Description,
			Version:                  m.Version,
			Mcversion:                m.MCVersion,
			Url:                      m.URL,
			UpdateUrl:                m.UpdateURL,
			UpdateJSON:               m.UpdateJSON,
			AuthorList:               m.AuthorList,
			Credits:                  m.Credits,
			LogoFile:                 m.LogoFile,
			Screenshots:              m.Screenshots,
			Parent:                   m.Parent,
			UseDependencyInformation: m.UseDependencyInformation,
			RequiredMods:             m.RequiredMods,
			Dependencies:             m.Dependencies,
			Dependants:               m.Dependants,
		}
	}
	return out
}

func convertToml(in []modparser.ForgeModTOMLData) []contract.ForgeModTOMLData {
	out := make([]contract.ForgeModTOMLData, len(in))
	for i, t := range in {
		entry := contract.ForgeModTOMLData{
			Modid:           t.Modid,
			Version:         t.Version,
			DisplayName:     t.DisplayName,
			UpdateJSONURL:   t.UpdateJSONURL,
			DisplayURL:      t.DisplayURL,
			LogoFile:        t.LogoFile,
			Credits:         t.Credits,
			Authors:         t.Authors,
			Description:     t.Description,
			Provides:        t.Provides,
			ModLoader:       t.ModLoader,
			LoaderVersion:   t.LoaderVersion,
			IssueTrackerURL: t.IssueTrackerURL,
			ClientSideOnly:  t.ClientSideOnly,
		}
		entry.Dependencies = make([]map[string]any, len(t.Dependencies))
		for j, d := range t.Dependencies {
			entry.Dependencies[j] = map[string]any{
				"modId":        d.ModId,
				"mandatory":    d.Mandatory,
				"versionRange": d.VersionRange,
				"ordering":     d.Ordering,
				"side":         d.Side,
			}
		}
		out[i] = entry
	}
	return out
}

func manifestToMap(in map[string]string) map[string]any {
	out := make(map[string]any, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

// ============================================================
// Filesystem helpers
// ============================================================

// stateIDFor mirrors the TS convention for the SharedState id.
func stateIDFor(instancePath string) string {
	return "instance-mods://" + instancePath
}

// linkOrCopy hard-links src→dst when possible, falling back to a
// byte copy. Hard-link saves disk space when the user's resource
// catalog and the instance live on the same volume.
func linkOrCopy(src, dst string) error {
	// Bail early if the destination already matches.
	if existingStat, err := os.Stat(dst); err == nil {
		if srcStat, err := os.Stat(src); err == nil {
			if os.SameFile(existingStat, srcStat) {
				return nil
			}
			// Different file at the destination — overwrite.
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
	if _, err := io.Copy(out, in); err != nil {
		return fmt.Errorf("copy %s -> %s: %w", src, dst, err)
	}
	return nil
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

// structToMap JSON-round-trips a value into a map so the SharedState
// wire carries the same shape it would when emitted by the TS
// runtime.
func structToMap(v any) (map[string]any, error) {
	raw, err := jsonMarshal(v)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err := jsonUnmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}
