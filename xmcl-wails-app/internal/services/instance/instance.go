// Package instance implements contract.InstanceService.
//
// The service is responsible for the on-disk model of "managed
// instances" — directories under `<gameDataPath>/instances/` plus
// any externally-tracked paths recorded in
// `<appDataPath>/instances.json`. Reads / writes are guarded by the
// host MutexManager so concurrent edits stay consistent.
package instance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	model "github.com/voxelum/xmcl/wails/internal/instance"
)

// stateID is the canonical SharedState id for InstanceState. Matches
// the service-key convention used by the legacy TS runtime so the
// renderer can dedupe state references across reloads.
const stateID = "InstanceService"

// Service implements contract.InstanceService.
type Service struct {
	contract.InstanceServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	once    sync.Once
	loadErr error

	mu      sync.Mutex
	state   *bridge.SharedState
	payload *contract.InstanceState

	// instances maps instance path → typed Instance model. The
	// state's `All` field carries the same content as `map[string]any`
	// for the renderer; this keeps a typed copy for backend services
	// (mods/saves/options/etc.) to consume without re-decoding.
	instances map[string]*model.Instance
}

// New constructs an InstanceService bound to the given host & state manager.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{
		host:      h,
		states:    sm,
		instances: map[string]*model.Instance{},
	}
}

var _ contract.InstanceService = (*Service)(nil)

func init() {
	// Wire the renderer-driven mutation hooks so the state stays in
	// sync when the renderer commits locally. The hooks are
	// package-global on the contract side; closures here capture
	// nothing state-specific, so a single install suffices.
	contract.ApplyInstanceState_InstanceGroupsSet = func(p *contract.InstanceState, value []any) {
		p.Groups = value
	}
	contract.ApplyInstanceState_InstanceAdd = func(p *contract.InstanceState, value map[string]any) {
		appendInstanceToState(p, value)
	}
	contract.ApplyInstanceState_InstanceRemove = func(p *contract.InstanceState, path string) {
		removeInstanceFromState(p, path)
	}
	contract.ApplyInstanceState_InstanceMove = func(p *contract.InstanceState, value map[string]any) {
		moveInstanceInState(p, value)
	}
	contract.ApplyInstanceState_InstanceEdit = func(p *contract.InstanceState, value map[string]any) {
		editInstanceInState(p, value)
	}
}

// ============================================================
// Public contract methods
// ============================================================

// GetSharedInstancesState returns the live InstanceState SharedState,
// performing the one-shot disk walk on first call.
func (s *Service) GetSharedInstancesState(_ context.Context) (*bridge.SharedState, error) {
	s.once.Do(func() {
		s.loadErr = s.bootstrapState()
	})
	if s.loadErr != nil {
		return nil, s.loadErr
	}
	return s.state, nil
}

// CreateInstance creates a managed instance under
// `<gameDataPath>/instances/<sanitized name>/`. Accepts the same
// shape as the renderer's CreateInstanceOptions:
//
//   - "name"     (string, required)
//   - "path"     (string, optional — overrides the candidate dir)
//   - "runtime"  (object, optional)
//   - …plus any other Instance fields the user wants to seed.
//
// Returns the on-disk path of the new instance.
func (s *Service) CreateInstance(_ context.Context, option map[string]any) (string, error) {
	if option == nil {
		return "", errors.New("CreateInstance: nil option")
	}
	name, _ := option["name"].(string)
	name = strings.TrimSpace(name)
	if name == "" {
		return "", errors.New("CreateInstance: name is required")
	}

	// Decode whatever fields the renderer set onto a typed Instance.
	// JSON round-trip handles every shape the option map can take.
	raw, err := json.Marshal(option)
	if err != nil {
		return "", fmt.Errorf("CreateInstance: marshal option: %w", err)
	}
	inst := model.New(name)
	if err := json.Unmarshal(raw, inst); err != nil {
		return "", fmt.Errorf("CreateInstance: decode option: %w", err)
	}
	inst.Name = name // preserve sanitized name

	path, _ := option["path"].(string)
	if path == "" {
		path = s.candidatePath(name)
	}
	inst.Path = path

	if err := s.host.Mutex.With("instance:"+path, func() error {
		return model.Save(inst)
	}); err != nil {
		return "", err
	}

	s.bootstrapStateIfNeeded()
	s.mu.Lock()
	s.instances[path] = inst
	pushInstanceAdd(s.states, s.state, s.payload, inst)
	s.mu.Unlock()

	if err := s.persistRegistry(); err != nil {
		s.host.Logger.Warn("instance: persist registry", "err", err)
	}
	return path, nil
}

// DeleteInstance removes the manifest from the registry and
// (optionally) deletes the on-disk directory.
func (s *Service) DeleteInstance(_ context.Context, path string, deleteData bool) error {
	if path == "" {
		return errors.New("DeleteInstance: path required")
	}
	if err := s.host.Mutex.With("instance:"+path, func() error {
		if deleteData {
			return os.RemoveAll(path)
		}
		// "non-data" delete: only the instance.json manifest. The
		// directory + saves stay around so the user can re-import.
		return os.Remove(filepath.Join(path, model.InstanceFile))
	}); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	s.bootstrapStateIfNeeded()
	s.mu.Lock()
	delete(s.instances, path)
	pushInstanceRemove(s.states, s.state, s.payload, path)
	s.mu.Unlock()
	if err := s.persistRegistry(); err != nil {
		s.host.Logger.Warn("instance: persist registry", "err", err)
	}
	return nil
}

// DuplicateInstance creates a sibling directory carrying a verbatim
// copy of the source instance.json + a fresh timestamp.
func (s *Service) DuplicateInstance(_ context.Context, path string) (string, error) {
	s.bootstrapStateIfNeeded()
	s.mu.Lock()
	src, ok := s.instances[path]
	s.mu.Unlock()
	if !ok {
		return "", fmt.Errorf("DuplicateInstance: %s: not found", path)
	}
	dup := *src
	dup.Name = src.Name + " Copy"
	dup.Path = s.candidatePath(dup.Name)
	dup.CreationDate = nowMillis()
	dup.LastAccessDate = dup.CreationDate
	dup.LastPlayedDate = 0
	dup.Playtime = 0

	if err := s.host.Mutex.With("instance:"+dup.Path, func() error {
		return model.Save(&dup)
	}); err != nil {
		return "", err
	}
	s.mu.Lock()
	s.instances[dup.Path] = &dup
	pushInstanceAdd(s.states, s.state, s.payload, &dup)
	s.mu.Unlock()

	if err := s.persistRegistry(); err != nil {
		s.host.Logger.Warn("instance: persist registry", "err", err)
	}
	return dup.Path, nil
}

// EditInstance updates a subset of fields on an existing instance.
// The TS contract takes `EditInstanceOptions & { instancePath: string }`
// — i.e. a map with `instancePath` plus any subset of Instance
// fields. We JSON-merge the changes onto the typed model.
func (s *Service) EditInstance(_ context.Context, options map[string]any) error {
	path, _ := options["instancePath"].(string)
	if path == "" {
		return errors.New("EditInstance: instancePath required")
	}
	s.bootstrapStateIfNeeded()
	s.mu.Lock()
	inst, ok := s.instances[path]
	s.mu.Unlock()
	if !ok {
		return fmt.Errorf("EditInstance: %s: not found", path)
	}

	// Merge: marshal the existing instance, overlay every option key,
	// then unmarshal back. This keeps unrelated fields intact while
	// honouring whatever the renderer sent (which can include nested
	// objects like `runtime` or `resolution`).
	base, err := marshalToMap(inst)
	if err != nil {
		return err
	}
	for k, v := range options {
		if k == "instancePath" {
			continue
		}
		base[k] = v
	}
	merged := *inst
	raw, err := json.Marshal(base)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(raw, &merged); err != nil {
		return err
	}
	merged.Path = path // protect against accidental Path overwrite

	if err := s.host.Mutex.With("instance:"+path, func() error {
		return model.Save(&merged)
	}); err != nil {
		return err
	}
	s.mu.Lock()
	s.instances[path] = &merged
	editPayload := marshalIgnoreErr(&merged)
	editPayload["path"] = path
	pushInstanceEdit(s.states, s.state, s.payload, editPayload)
	s.mu.Unlock()
	return nil
}

// ValidateInstancePath returns the canonical "is this a viable
// directory to place an instance at" error code, mirroring the TS
// contract. Empty string means "valid".
func (s *Service) ValidateInstancePath(_ context.Context, path string) (string, error) {
	if path == "" {
		return "bad", nil
	}
	if !filepath.IsAbs(path) {
		return "bad", nil
	}
	if info, err := os.Stat(path); err == nil {
		if !info.IsDir() {
			return "exists", nil
		}
		entries, _ := os.ReadDir(path)
		for _, e := range entries {
			if e.Name() == model.InstanceFile {
				return "exists", nil
			}
		}
	}
	// "noperm" / "invalidchar" / "nondictionary" / "exists" are the
	// canonical other codes; we don't currently distinguish them.
	return "", nil
}

// modpackMetadataFile is the conventional per-instance file
// (`<instance>/modpack-metadata.json`) the renderer's modpack export
// wizard reads + writes via this service. Mirrors the TS reference.
const modpackMetadataFile = "modpack-metadata.json"

// GetInstanceModpackMetadata reads `<path>/modpack-metadata.json`
// and returns the decoded payload with the renderer's expected
// defaults filled in. Missing / malformed files surface as `nil` so
// the renderer's "no modpack metadata yet" branch fires (matches
// the TS reference's `.catch(() => undefined)` semantics).
func (s *Service) GetInstanceModpackMetadata(_ context.Context, path string) (any, error) {
	if path == "" {
		return nil, nil
	}
	raw, err := os.ReadFile(filepath.Join(path, modpackMetadataFile))
	if err != nil {
		// Both "file missing" and "permission denied" collapse to
		// nil — the renderer treats either as "no metadata yet".
		return nil, nil
	}
	var data map[string]any
	if err := json.Unmarshal(raw, &data); err != nil {
		s.host.Logger.Warn("instance: modpack-metadata decode failed", "path", path, "err", err)
		return nil, nil
	}
	applyModpackMetadataDefaults(data)
	return data, nil
}

// SetInstanceModpackMetadata writes (or removes) the per-instance
// modpack-metadata file. Passing `nil` deletes the file (the
// renderer uses this to "reset to default").
func (s *Service) SetInstanceModpackMetadata(_ context.Context, path string, metadata any) error {
	if path == "" {
		return errors.New("SetInstanceModpackMetadata: path required")
	}
	dest := filepath.Join(path, modpackMetadataFile)
	if metadata == nil {
		if err := os.Remove(dest); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		return nil
	}
	// Coerce to map so the defaults pass works regardless of the
	// renderer-supplied wire shape (it's typed at the caller level
	// but the bridge hands us `map[string]any`).
	var data map[string]any
	switch v := metadata.(type) {
	case map[string]any:
		data = v
	default:
		raw, err := json.Marshal(metadata)
		if err != nil {
			return fmt.Errorf("SetInstanceModpackMetadata: marshal: %w", err)
		}
		if err := json.Unmarshal(raw, &data); err != nil {
			return fmt.Errorf("SetInstanceModpackMetadata: unmarshal: %w", err)
		}
	}
	applyModpackMetadataDefaults(data)
	return s.host.Mutex.With("instance:modpack-metadata:"+path, func() error {
		if err := os.MkdirAll(path, 0o755); err != nil {
			return err
		}
		raw, err := json.MarshalIndent(data, "", "  ")
		if err != nil {
			return err
		}
		tmp := dest + ".part"
		if err := os.WriteFile(tmp, raw, 0o644); err != nil {
			return err
		}
		return os.Rename(tmp, dest)
	})
}

// applyModpackMetadataDefaults fills in the same defaults the TS
// `InstanceModpackMetadataSchema.parse` applies. Keeps the renderer
// from having to defend against missing keys after a hand-edited
// `modpack-metadata.json`.
func applyModpackMetadataDefaults(m map[string]any) {
	if m == nil {
		return
	}
	if _, ok := m["version"]; !ok {
		m["version"] = float64(0)
	}
	setDefaultString(m, "exportDirectory", "")
	setDefaultString(m, "modpackVersion", "0.0.1")
	setDefaultBool(m, "emitCurseforge", true)
	setDefaultBool(m, "emitModrinth", true)
	setDefaultBool(m, "emitModrinthStrict", true)
	setDefaultBool(m, "emitOffline", false)
	if _, ok := m["emittedFiles"]; !ok {
		m["emittedFiles"] = []any{}
	}
	if _, ok := m["filesEnvironments"]; !ok {
		m["filesEnvironments"] = map[string]any{}
	}
}

func setDefaultString(m map[string]any, key, def string) {
	if v, ok := m[key]; !ok || v == nil {
		m[key] = def
	}
}

func setDefaultBool(m map[string]any, key string, def bool) {
	if v, ok := m[key]; !ok || v == nil {
		m[key] = def
	}
}

// ============================================================
// Bootstrap + state plumbing
// ============================================================

func (s *Service) bootstrapStateIfNeeded() {
	s.once.Do(func() { s.loadErr = s.bootstrapState() })
}

func (s *Service) bootstrapState() error {
	s.payload = &contract.InstanceState{
		All:       map[string]any{},
		Instances: []map[string]any{},
		Groups:    []any{},
	}

	reg, _ := model.LoadRegistry(s.host.AppDataPath)
	if reg != nil {
		s.payload.Groups = reg.Groups
	}

	managed := s.managedDir()
	_ = os.MkdirAll(managed, 0o755)

	seen := map[string]bool{}

	// Managed directory walk: any subdir with an instance.json is an
	// instance. Hidden dirs (`.foo`) are skipped to mirror the TS
	// runtime which uses `basename().startsWith('.')` as the filter.
	entries, _ := os.ReadDir(managed)
	for _, e := range entries {
		name := e.Name()
		if !e.IsDir() || strings.HasPrefix(name, ".") {
			continue
		}
		path := filepath.Join(managed, name)
		s.loadIntoState(path, seen)
	}

	// External instances from `instances.json`.
	if reg != nil {
		for _, p := range reg.Instances {
			if p == "" {
				continue
			}
			if !filepath.IsAbs(p) {
				p = filepath.Join(managed, p)
			}
			s.loadIntoState(p, seen)
		}
	}

	s.state = contract.RegisterInstanceState(s.states, stateID, s.payload)
	return nil
}

func (s *Service) loadIntoState(path string, seen map[string]bool) {
	if seen[path] {
		return
	}
	seen[path] = true
	inst, err := model.Load(path)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			s.host.Logger.Warn("instance: load failed", "path", path, "err", err)
		}
		return
	}
	s.instances[path] = inst
	m := marshalIgnoreErr(inst)
	m["path"] = path
	s.payload.All.(map[string]any)[path] = m
	s.payload.Instances = append(s.payload.Instances, m)
}

func (s *Service) managedDir() string {
	return filepath.Join(s.host.MinecraftDataPath, model.InstanceFolder)
}

// candidatePath finds an unused directory under the managed root by
// appending a numeric suffix when the sanitized name collides.
func (s *Service) candidatePath(name string) string {
	managed := s.managedDir()
	base := filepath.Join(managed, sanitiseFilename(name))
	if _, err := os.Stat(base); errors.Is(err, os.ErrNotExist) {
		return base
	}
	for i := 2; ; i++ {
		try := fmt.Sprintf("%s (%d)", base, i)
		if _, err := os.Stat(try); errors.Is(err, os.ErrNotExist) {
			return try
		}
	}
}

// persistRegistry rewrites `<appDataPath>/instances.json` from the
// current payload. Only EXTERNAL paths (those outside the managed
// dir) are recorded; managed paths are rediscovered on next boot.
func (s *Service) persistRegistry() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	reg := &model.Registry{Instances: []string{}, Groups: s.payload.Groups}
	managed := s.managedDir() + string(filepath.Separator)
	for path := range s.instances {
		if !strings.HasPrefix(path, managed) {
			reg.Instances = append(reg.Instances, path)
		}
	}
	return model.SaveRegistry(s.host.AppDataPath, reg)
}

// ============================================================
// SharedState push helpers
//
// These mirror the TS state mutators: a Go-side change pushes the
// matching `commit` event, which the renderer replays through the
// generated `instanceAdd` / `instanceRemove` / etc. method.
// ============================================================

func pushInstanceAdd(sm *bridge.StateManager, state *bridge.SharedState, p *contract.InstanceState, inst *model.Instance) {
	if state == nil {
		return
	}
	m := marshalIgnoreErr(inst)
	m["path"] = inst.Path
	appendInstanceToState(p, m)
	sm.Push(state.ID, "instanceAdd", m)
}

func pushInstanceRemove(sm *bridge.StateManager, state *bridge.SharedState, p *contract.InstanceState, path string) {
	if state == nil {
		return
	}
	removeInstanceFromState(p, path)
	sm.Push(state.ID, "instanceRemove", path)
}

func pushInstanceEdit(sm *bridge.StateManager, state *bridge.SharedState, p *contract.InstanceState, payload map[string]any) {
	if state == nil {
		return
	}
	editInstanceInState(p, payload)
	sm.Push(state.ID, "instanceEdit", payload)
}

// ============================================================
// In-state mutation helpers (used by both Apply* hooks + Go pushers).
// ============================================================

func appendInstanceToState(p *contract.InstanceState, m map[string]any) {
	if m == nil {
		return
	}
	path, _ := m["path"].(string)
	if path == "" {
		return
	}
	if all, ok := p.All.(map[string]any); ok {
		all[path] = m
	} else {
		p.All = map[string]any{path: m}
	}
	for _, existing := range p.Instances {
		if existing["path"] == path {
			return // already present
		}
	}
	p.Instances = append(p.Instances, m)
}

func removeInstanceFromState(p *contract.InstanceState, path string) {
	if all, ok := p.All.(map[string]any); ok {
		delete(all, path)
	}
	out := p.Instances[:0]
	for _, m := range p.Instances {
		if m["path"] != path {
			out = append(out, m)
		}
	}
	p.Instances = out
}

func moveInstanceInState(p *contract.InstanceState, value map[string]any) {
	from, _ := value["from"].(string)
	to, _ := value["to"].(string)
	if from == "" || to == "" {
		return
	}
	for _, m := range p.Instances {
		if m["path"] == from {
			m["path"] = to
		}
	}
	if all, ok := p.All.(map[string]any); ok {
		if inst, found := all[from]; found {
			delete(all, from)
			all[to] = inst
		}
	}
}

func editInstanceInState(p *contract.InstanceState, value map[string]any) {
	path, _ := value["path"].(string)
	if path == "" {
		return
	}
	for _, m := range p.Instances {
		if m["path"] == path {
			for k, v := range value {
				m[k] = v
			}
		}
	}
	if all, ok := p.All.(map[string]any); ok {
		if existing, found := all[path]; found {
			if existingMap, isMap := existing.(map[string]any); isMap {
				for k, v := range value {
					existingMap[k] = v
				}
			}
		}
	}
}

// ============================================================
// Helpers
// ============================================================

func marshalToMap(inst *model.Instance) (map[string]any, error) {
	raw, err := json.Marshal(inst)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func marshalIgnoreErr(inst *model.Instance) map[string]any {
	m, err := marshalToMap(inst)
	if err != nil {
		return map[string]any{}
	}
	return m
}

// sanitiseFilename strips characters that are illegal in directory
// names on Windows / macOS. The TS side uses the `filenamify`
// package; we mirror only the rules the launcher relies on.
func sanitiseFilename(name string) string {
	const illegal = `/\:*?"<>|`
	var b strings.Builder
	for _, r := range name {
		if strings.ContainsRune(illegal, r) {
			b.WriteRune('_')
			continue
		}
		if r < 0x20 {
			continue
		}
		b.WriteRune(r)
	}
	out := strings.TrimSpace(b.String())
	out = strings.TrimRight(out, ". ")
	if out == "" {
		out = "instance"
	}
	return out
}

func nowMillis() int64 {
	return time.Now().UnixMilli()
}
