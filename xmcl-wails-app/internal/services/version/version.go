// Package version implements contract.VersionService.
//
// Walks `<MinecraftDataPath>/versions/` to discover installed
// Minecraft versions. Each subdirectory is expected to carry a
// `<name>/<name>.json` (the version manifest). The full inheritance
// chain is resolved via the core package so the renderer's
// `VersionHeader` (with loader-version fields) can be populated
// without making the renderer re-read every JSON.
package version

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/parsers/core"
)

const stateID = "VersionService"

// Service implements contract.VersionService.
type Service struct {
	contract.VersionServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	once    sync.Once
	loadErr error

	mu      sync.Mutex
	state   *bridge.SharedState
	payload *contract.LocalVersions
}

// New constructs a VersionService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm}
}

var _ contract.VersionService = (*Service)(nil)

// ============================================================
// Contract
// ============================================================

// GetLocalVersions returns the live LocalVersions SharedState. The
// initial scan happens on first call; subsequent calls reuse the
// same handle.
func (s *Service) GetLocalVersions(_ context.Context) (*bridge.SharedState, error) {
	s.once.Do(func() { s.loadErr = s.bootstrap() })
	if s.loadErr != nil {
		return nil, s.loadErr
	}
	return s.state, nil
}

// RefreshVersions re-scans the versions folder and replaces the
// SharedState payload via the `localVersions` mutator.
func (s *Service) RefreshVersions(_ context.Context, _ bool) error {
	s.bootstrapIfNeeded()
	headers := s.scanVersions("versions")
	servers := s.scanServers("server-versions")

	s.mu.Lock()
	s.payload.Local = headersAsAny(headers)
	s.payload.Servers = serversAsAny(servers)
	s.mu.Unlock()

	if s.state != nil {
		s.states.Push(stateID, "localVersions", headers)
		// The TS state has no "set the whole servers list" mutator;
		// per-add events fire from RefreshServerVersion as needed.
	}
	return nil
}

// RefreshVersion targets a single directory. We re-parse just that
// version and push either an `add` or `remove` event so the renderer
// avoids replaying the whole list.
func (s *Service) RefreshVersion(_ context.Context, versionFolder string) error {
	if versionFolder == "" {
		return errors.New("RefreshVersion: versionFolder required")
	}
	s.bootstrapIfNeeded()
	header, ok := s.parseHeader("versions", versionFolder)
	if !ok {
		// Fell off disk — emit a remove so renderer state stays
		// consistent.
		s.removeFromPayload(versionFolder)
		s.states.Push(stateID, "localVersionRemove", versionFolder)
		return nil
	}
	s.upsertHeader(header)
	s.states.Push(stateID, "localVersionAdd", header)
	return nil
}

// RefreshServerVersion mirrors RefreshVersion for the server pool.
// Server profile listings are simpler (no inheritance walk needed).
func (s *Service) RefreshServerVersion(_ context.Context, versionFolder string) error {
	if versionFolder == "" {
		return errors.New("RefreshServerVersion: versionFolder required")
	}
	s.bootstrapIfNeeded()
	prof, ok := s.parseServerProfile("server-versions", versionFolder)
	if !ok {
		// Same as client side — render-side listening for the bulk
		// refresh covers fall-off-disk cases.
		return s.RefreshVersions(context.Background(), false)
	}
	s.states.Push(stateID, "serverProfileAdd", prof)
	return nil
}

// DeleteVersion removes `<MinecraftDataPath>/versions/<version>/`.
func (s *Service) DeleteVersion(_ context.Context, version string) error {
	if version == "" {
		return errors.New("DeleteVersion: version required")
	}
	target := filepath.Join(s.host.MinecraftDataPath, "versions", version)
	if err := os.RemoveAll(target); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	s.bootstrapIfNeeded()
	s.removeFromPayload(version)
	s.states.Push(stateID, "localVersionRemove", version)
	return nil
}

// ShowVersionsDirectory / ShowVersionDirectory open a folder in the
// system file manager. Wails v3's Browser.OpenURL handles file://
// URIs on every platform, but we keep the renderer affordance as a
// simple no-op-but-success shim until G8 wires it through.
func (s *Service) ShowVersionsDirectory(_ context.Context) (bool, error) { return true, nil }

// ShowVersionDirectory mirrors ShowVersionsDirectory for one entry.
func (s *Service) ShowVersionDirectory(_ context.Context, _ string) (bool, error) {
	return true, nil
}

// MigrateMinecraftFile copies libraries / assets / versions from the
// system `.minecraft` into the launcher-managed root. Implementation
// lands with G7's MigrationService — we surface "not implemented" so
// the renderer's wizard can show a clear message.
func (s *Service) MigrateMinecraftFile(_ context.Context) error {
	return errors.New("MigrateMinecraftFile: not implemented (planned for G7 MigrationService)")
}

// ResolveLocalVersion parses the on-disk version JSON for the named
// version, walking its `inheritsFrom` chain.
func (s *Service) ResolveLocalVersion(_ context.Context, versionFolder string) (contract.ResolvedVersion, error) {
	if versionFolder == "" {
		return contract.ResolvedVersion{}, errors.New("ResolveLocalVersion: versionFolder required")
	}
	mc := core.NewMinecraftFolder(s.host.MinecraftDataPath)
	resolved, err := core.ParseVersion(mc, versionFolder, core.CurrentPlatform())
	if err != nil {
		return contract.ResolvedVersion{}, err
	}
	return toContractResolvedVersion(resolved), nil
}

// ResolveServerVersion is the bundled-server variant. G6 just
// delegates to the client parser — the bundled-jar resolution is a
// G5 follow-up.
func (s *Service) ResolveServerVersion(_ context.Context, id string) (contract.ResolvedServerVersion, error) {
	if id == "" {
		return contract.ResolvedServerVersion{}, errors.New("ResolveServerVersion: id required")
	}
	mc := core.NewMinecraftFolder(s.host.MinecraftDataPath)
	resolved, err := core.ParseVersion(mc, id, core.CurrentPlatform())
	if err != nil {
		return contract.ResolvedServerVersion{}, err
	}
	libs := make([]contract.ResolvedLibrary, 0, len(resolved.Libraries))
	for _, lib := range resolved.Libraries {
		libs = append(libs, libraryToContract(lib))
	}
	return contract.ResolvedServerVersion{
		Id:               resolved.ID,
		Libraries:        libs,
		MainClass:        resolved.MainClass,
		MinecraftVersion: resolved.MinecraftVersion,
		Arguments: map[string]any{
			"jvm":  flattenArgs(resolved.Arguments.JVM),
			"game": flattenArgs(resolved.Arguments.Game),
		},
	}, nil
}

// ============================================================
// Bootstrap + scanning
// ============================================================

func (s *Service) bootstrapIfNeeded() {
	s.once.Do(func() { s.loadErr = s.bootstrap() })
}

func (s *Service) bootstrap() error {
	headers := s.scanVersions("versions")
	servers := s.scanServers("server-versions")

	s.payload = &contract.LocalVersions{
		Local:   headersAsAny(headers),
		Servers: serversAsAny(servers),
	}
	s.state = contract.RegisterLocalVersions(s.states, stateID, s.payload)
	return nil
}

// scanVersions walks `<MinecraftDataPath>/<sub>/` and returns one
// VersionHeader per subdirectory that carries a `<name>/<name>.json`.
// Failures on individual versions are logged but never block the
// scan; the renderer prefers a partial list to none at all.
func (s *Service) scanVersions(sub string) []contract.VersionHeader {
	dir := filepath.Join(s.host.MinecraftDataPath, sub)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			s.host.Logger.Warn("version: scan failed", "dir", dir, "err", err)
		}
		return []contract.VersionHeader{}
	}
	out := make([]contract.VersionHeader, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		header, ok := s.parseHeader(sub, e.Name())
		if !ok {
			continue
		}
		out = append(out, header)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Id < out[j].Id })
	return out
}

// parseHeader reads one version directory and returns the rich
// VersionHeader the renderer's instance picker shows. The boolean is
// false when the directory has no manifest or the parse fails — the
// caller is expected to skip silently.
func (s *Service) parseHeader(sub, name string) (contract.VersionHeader, bool) {
	dir := filepath.Join(s.host.MinecraftDataPath, sub, name)
	jsonPath := filepath.Join(dir, fmt.Sprintf("%s.json", name))
	if _, err := os.Stat(jsonPath); err != nil {
		return contract.VersionHeader{}, false
	}

	mc := core.NewMinecraftFolder(s.host.MinecraftDataPath)
	resolved, err := core.ParseVersion(mc, name, core.CurrentPlatform())
	if err != nil {
		// Fall back to a shallow header so the renderer still sees
		// something — broken inheritance chains are common on user
		// installs that mix manual edits with launcher writes.
		s.host.Logger.Warn("version: parse failed", "id", name, "err", err)
		return contract.VersionHeader{
			Id:           name,
			Path:         dir,
			Inheritances: []string{name},
			Minecraft:    "",
		}, true
	}
	loaders := core.ExtractLoaders(resolved)
	pathChain := resolved.PathChain
	if len(pathChain) == 0 {
		pathChain = []string{dir}
	}
	return contract.VersionHeader{
		Id:           resolved.ID,
		Path:         pathChain[0],
		Inheritances: resolved.Inheritances,
		Minecraft:    loaders.Minecraft,
		Forge:        loaders.Forge,
		Fabric:       loaders.Fabric,
		Quilt:        loaders.Quilt,
		Optifine:     loaders.Optifine,
		NeoForged:    loaders.NeoForged,
		LabyMod:      loaders.LabyMod,
		Liteloader:   loaders.Liteloader,
	}, true
}

// scanServers walks `<MinecraftDataPath>/server-versions/`. Unlike
// the client list, server profiles are flat — one folder == one
// minecraft server install, no inheritance. The TS contract types
// the entries as `ServerVersionHeader`, but the codegen drops type
// aliases — we emit `map[string]any` so the generated `Servers []any`
// payload accepts them verbatim.
func (s *Service) scanServers(sub string) []map[string]any {
	dir := filepath.Join(s.host.MinecraftDataPath, sub)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			s.host.Logger.Warn("version: server scan failed", "dir", dir, "err", err)
		}
		return []map[string]any{}
	}
	out := make([]map[string]any, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		prof, ok := s.parseServerProfile(sub, e.Name())
		if !ok {
			continue
		}
		out = append(out, prof)
	}
	sort.Slice(out, func(i, j int) bool {
		ai, _ := out[i]["id"].(string)
		aj, _ := out[j]["id"].(string)
		return ai < aj
	})
	return out
}

// parseServerProfile produces a server-profile map from a server
// install dir. The shape mirrors the TS `ServerVersionHeader` (id,
// minecraft, type, version).
func (s *Service) parseServerProfile(sub, name string) (map[string]any, bool) {
	dir := filepath.Join(s.host.MinecraftDataPath, sub, name)
	jsonPath := filepath.Join(dir, fmt.Sprintf("%s.json", name))
	if _, err := os.Stat(jsonPath); err != nil {
		return nil, false
	}
	mc := core.NewMinecraftFolder(s.host.MinecraftDataPath)
	resolved, err := core.ParseVersion(mc, name, core.CurrentPlatform())
	if err != nil {
		return map[string]any{
			"id":        name,
			"minecraft": "",
			"type":      "vanilla",
		}, true
	}
	loaders := core.ExtractLoaders(resolved)
	prof := map[string]any{
		"id":        resolved.ID,
		"minecraft": loaders.Minecraft,
		"type":      "vanilla",
	}
	switch {
	case loaders.NeoForged != "":
		prof["type"] = "neoforge"
		prof["version"] = loaders.NeoForged
	case loaders.Forge != "":
		prof["type"] = "forge"
		prof["version"] = loaders.Forge
	case loaders.Fabric != "":
		prof["type"] = "fabric"
		prof["version"] = loaders.Fabric
	case loaders.Quilt != "":
		prof["type"] = "quilt"
		prof["version"] = loaders.Quilt
	}
	return prof, true
}

// ============================================================
// Payload mutation helpers
// ============================================================

// upsertHeader replaces the existing entry for `header.Id` in the
// payload, or appends it. Maintains lexicographic ordering.
func (s *Service) upsertHeader(header contract.VersionHeader) {
	s.mu.Lock()
	defer s.mu.Unlock()
	local := append([]any(nil), s.payload.Local...)
	for i, raw := range local {
		if h, ok := raw.(contract.VersionHeader); ok && h.Id == header.Id {
			local[i] = header
			s.payload.Local = local
			return
		}
		if m, ok := raw.(map[string]any); ok {
			if id, _ := m["id"].(string); id == header.Id {
				local[i] = header
				s.payload.Local = local
				return
			}
		}
	}
	local = append(local, header)
	sort.Slice(local, func(i, j int) bool {
		return idOf(local[i]) < idOf(local[j])
	})
	s.payload.Local = local
}

func (s *Service) removeFromPayload(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := s.payload.Local[:0]
	for _, raw := range s.payload.Local {
		if idOf(raw) == id {
			continue
		}
		out = append(out, raw)
	}
	s.payload.Local = out
}

// idOf reads an `id` from either a typed VersionHeader or a generic
// `map[string]any` (the format payload entries take after JSON
// round-trips through the renderer's commit channel).
func idOf(v any) string {
	switch t := v.(type) {
	case contract.VersionHeader:
		return t.Id
	case map[string]any:
		if id, _ := t["id"].(string); id != "" {
			return id
		}
	}
	return ""
}

// ============================================================
// Conversion helpers
// ============================================================

func headersAsAny(headers []contract.VersionHeader) []any {
	out := make([]any, len(headers))
	for i, h := range headers {
		out[i] = h
	}
	return out
}

func serversAsAny(profiles []map[string]any) []any {
	out := make([]any, len(profiles))
	for i, p := range profiles {
		out[i] = p
	}
	return out
}

// strPtr (kept for future contract types that adopt *string fields).
func strPtr(s string) *string { return &s }

// toContractResolvedVersion converts the parser-side struct into the
// generated contract.ResolvedVersion. Most fields are direct
// transfers; the dynamic-shape ones (`Arguments`, `Downloads`, `Logging`)
// pass through as `map[string]any`.
func toContractResolvedVersion(r *core.ResolvedVersion) contract.ResolvedVersion {
	libs := make([]contract.ResolvedLibrary, 0, len(r.Libraries))
	for _, lib := range r.Libraries {
		libs = append(libs, libraryToContract(lib))
	}
	downloads := make(map[string]any, len(r.Downloads))
	for k, v := range r.Downloads {
		downloads[k] = downloadToMap(v)
	}
	logging := make(map[string]any, len(r.Logging))
	for k, v := range r.Logging {
		logging[k] = loggingEntryToMap(v)
	}

	out := contract.ResolvedVersion{
		Id:                     r.ID,
		MainClass:              r.MainClass,
		Assets:                 r.Assets,
		Downloads:              downloads,
		Libraries:              libs,
		MinimumLauncherVersion: float64(r.MinimumLauncherVersion),
		ReleaseTime:            r.ReleaseTime,
		Time:                   r.Time,
		Type:                   r.Type,
		Logging:                logging,
		JavaVersion: contract.JavaVersion{
			Component:    r.JavaVersion.Component,
			MajorVersion: float64(r.JavaVersion.MajorVersion),
		},
		MinecraftVersion:   r.MinecraftVersion,
		MinecraftDirectory: r.MinecraftDirectory,
		Inheritances:       r.Inheritances,
		PathChain:          r.PathChain,
		Arguments: map[string]any{
			"jvm":  flattenArgs(r.Arguments.JVM),
			"game": flattenArgs(r.Arguments.Game),
		},
	}
	if r.AssetIndex != nil {
		out.AssetIndex = &contract.AssetIndex{
			Id:        r.AssetIndex.ID,
			TotalSize: float64(r.AssetIndex.TotalSize),
			Sha1:      r.AssetIndex.SHA1,
			Size:      float64(r.AssetIndex.Size),
			Url:       r.AssetIndex.URL,
		}
	}
	return out
}

func libraryToContract(lib core.ResolvedLibrary) contract.ResolvedLibrary {
	return contract.ResolvedLibrary{
		Name:       lib.Name,
		Path:       lib.Path,
		Type:       lib.Type,
		GroupId:    lib.GroupID,
		ArtifactId: lib.ArtifactID,
		Version:    lib.Version,
		IsSnapshot: lib.IsSnapshot,
		Classifier: lib.Classifier,
	}
}

func downloadToMap(d *core.Download) map[string]any {
	if d == nil {
		return nil
	}
	return map[string]any{
		"sha1": d.SHA1,
		"size": float64(d.Size),
		"url":  d.URL,
	}
}

func loggingEntryToMap(e core.LoggingEntry) map[string]any {
	return map[string]any{
		"file": map[string]any{
			"id":   e.File.ID,
			"sha1": e.File.SHA1,
			"size": float64(e.File.Size),
			"url":  e.File.URL,
		},
		"argument": e.Argument,
		"type":     e.Type,
	}
}

// flattenArgs reduces []LaunchArgument to a slice the renderer can
// iterate. Each entry is either a string (plain) or a map describing
// the rule-gated structure.
func flattenArgs(args []core.LaunchArgument) []any {
	out := make([]any, 0, len(args))
	for _, a := range args {
		if a.Plain != "" {
			out = append(out, a.Plain)
			continue
		}
		rules := make([]map[string]any, 0, len(a.Rules))
		for _, r := range a.Rules {
			m := map[string]any{"action": r.Action}
			if r.OS != nil {
				osMap := map[string]any{"name": r.OS.Name}
				if r.OS.Version != "" {
					osMap["version"] = r.OS.Version
				}
				if r.OS.Arch != "" {
					osMap["arch"] = r.OS.Arch
				}
				m["os"] = osMap
			}
			if len(r.Features) > 0 {
				m["features"] = r.Features
			}
			rules = append(rules, m)
		}
		out = append(out, map[string]any{
			"rules": rules,
			"value": a.Value,
		})
	}
	return out
}
