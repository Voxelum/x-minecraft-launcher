// Package instancemodsgroup implements
// contract.InstanceModsGroupService.
//
// Two on-disk surfaces:
//
//   - `<instance>/mod-groups.json` — per-instance mapping of group
//     name → { color, files[] }. Watched via fsnotify so manual
//     edits / external sync tools propagate to the renderer.
//
//   - `<appData>/shared-mod-group-rules.json` — global mod-id ↔
//     group-name catalog reused across instances.
//
// `getGroupState` returns a SharedState whose payload mirrors the TS
// `InstanceModsGroupState` (a single `groups` map). Renderer-driven
// `commit("groupsSet", …)` calls land on the typed mutator the
// codegen emitted; we additionally apply the value to the shared
// payload so subsequent fetches see the same data.
package instancemodsgroup

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

const (
	// groupsFile is the conventional per-instance mod-groups payload
	// (matches the TS reference's `mod-groups.json`).
	groupsFile = "mod-groups.json"
	// rulesFile lives under `<appData>/` and stores the global
	// modId → group-name catalog.
	rulesFile = "shared-mod-group-rules.json"
)

// Service implements contract.InstanceModsGroupService.
type Service struct {
	contract.InstanceModsGroupServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	mu      sync.Mutex
	watches map[string]*watch // instancePath → watch
}

// watch caches the SharedState + payload + fsnotify handle for a
// single instance so repeated `GetGroupState` calls return the same
// SharedState id (the renderer dedupes on id).
type watch struct {
	state   *bridge.SharedState
	payload *contract.InstanceModsGroupState
	once    sync.Once

	mu      sync.Mutex
	watcher *fsnotify.Watcher
	stop    chan struct{}
}

// New constructs an InstanceModsGroupService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{
		host:    h,
		states:  sm,
		watches: map[string]*watch{},
	}
}

// Compile-time assertion that we implement the generated contract.
var _ contract.InstanceModsGroupService = (*Service)(nil)

// stateIDFor mirrors the TS `InstanceGroupStateKey`.
func stateIDFor(instancePath string) string {
	return "instance-mods-group-state://" + instancePath
}

// init wires the codegen mutator hook so renderer-driven `commit`
// calls actually land on the live payload (the codegen default is a
// no-op). Done once at process start; safe to register from inside
// `init` because the contract package's apply-vars are package-level
// `var`s the codegen emits.
func init() {
	contract.ApplyInstanceModsGroupState_GroupsSet = func(payload *contract.InstanceModsGroupState, value map[string]contract.ModGroupData) {
		if payload == nil {
			return
		}
		payload.Groups = value
	}
}

// ============================================================
// GetGroupState
// ============================================================

// GetGroupState returns the live SharedState for `<instancePath>`.
// On first call we read `<instancePath>/mod-groups.json` (when it
// exists) into the payload and start an fsnotify watcher so manual
// edits propagate.
func (s *Service) GetGroupState(_ context.Context, instancePath string) (*bridge.SharedState, error) {
	if instancePath == "" {
		return nil, errors.New("GetGroupState: instancePath required")
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
	groups, _ := readGroupsFile(filepath.Join(instancePath, groupsFile))
	w.payload = &contract.InstanceModsGroupState{Groups: groups}
	w.stop = make(chan struct{})

	stateID := stateIDFor(instancePath)
	w.state = s.states.Register(bridge.StateOpts{
		ID:        stateID,
		StateName: "InstanceModsGroupState",
		Payload:   w.payload,
		Mutators: map[string]bridge.Mutator{
			// `groupsSet` mirrors the TS payload mutation. We update
			// the live payload AND broadcast through the state
			// manager so peer renderer windows refresh.
			"groupsSet": func(raw any) {
				next, ok := decodeGroups(raw)
				if !ok {
					return
				}
				w.mu.Lock()
				w.payload.Groups = next
				w.mu.Unlock()
				s.states.Push(stateID, "groupsSet", next)
			},
		},
		Dispose: func() { s.disposeWatch(instancePath) },
	})

	s.startWatcher(instancePath, w)
	return nil
}

// disposeWatch tears down the fsnotify goroutine + cache entry. The
// SharedState manager calls this once the renderer's last reference
// to the state is dropped.
func (s *Service) disposeWatch(instancePath string) {
	s.mu.Lock()
	w, ok := s.watches[instancePath]
	if ok {
		delete(s.watches, instancePath)
	}
	s.mu.Unlock()
	if !ok || w == nil {
		return
	}
	if w.stop != nil {
		close(w.stop)
		w.stop = nil
	}
	if w.watcher != nil {
		_ = w.watcher.Close()
		w.watcher = nil
	}
}

// ============================================================
// UpdateModsGroups
// ============================================================

// UpdateModsGroups overwrites the instance's mod-groups.json file
// with `groups`, and pushes the same payload through the SharedState
// so subscribed renderers see the change immediately.
func (s *Service) UpdateModsGroups(ctx context.Context, instancePath string, groups map[string]contract.ModGroupData) error {
	if instancePath == "" {
		return errors.New("UpdateModsGroups: instancePath required")
	}
	if groups == nil {
		groups = map[string]contract.ModGroupData{}
	}

	// Reach the SharedState handle (creates it lazily). This also
	// ensures the fsnotify watcher is in place before we write — so
	// the corresponding self-write event re-asserts the same data
	// without re-entering this method.
	if _, err := s.GetGroupState(ctx, instancePath); err != nil {
		return err
	}

	w := s.getWatch(instancePath)
	w.mu.Lock()
	if w.payload != nil {
		w.payload.Groups = groups
	}
	w.mu.Unlock()
	s.states.Push(stateIDFor(instancePath), "groupsSet", groups)

	groupsPath := filepath.Join(instancePath, groupsFile)
	if err := os.MkdirAll(filepath.Dir(groupsPath), 0o755); err != nil {
		s.host.Logger.Warn("instancemodsgroup: mkdir for groups", "path", groupsPath, "err", err)
		return nil
	}
	if err := writeJSON(groupsPath, groups); err != nil {
		s.host.Logger.Warn("instancemodsgroup: write groups", "path", groupsPath, "err", err)
	}
	return nil
}

// ============================================================
// Shared rules
// ============================================================

// GetSharedGroupRules reads the global modId → group-name catalog.
// Returns an empty (but non-nil) struct when the file is missing or
// malformed so the renderer's `Object.entries(rules)` reads cleanly.
func (s *Service) GetSharedGroupRules(_ context.Context) (contract.ModGroupRules, error) {
	rules := contract.ModGroupRules{Extra: map[string]any{}}
	path := filepath.Join(s.host.AppDataPath, rulesFile)
	data, err := os.ReadFile(path)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			s.host.Logger.Warn("instancemodsgroup: read shared rules", "path", path, "err", err)
		}
		return rules, nil
	}
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		s.host.Logger.Warn("instancemodsgroup: parse shared rules", "path", path, "err", err)
		return rules, nil
	}
	rules.Extra = raw
	return rules, nil
}

// UpdateSharedGroupRules merges `mapping` into the persisted catalog.
// New entries take precedence: any modId that appears under any key in
// `mapping` wins; remaining entries from the existing file are
// preserved (mirrors the TS reference).
func (s *Service) UpdateSharedGroupRules(ctx context.Context, mapping contract.ModGroupRules) error {
	existing, _ := s.GetSharedGroupRules(ctx)
	out := make(map[string][]string)
	visited := make(map[string]struct{})

	consume := func(src map[string]any, allowVisited bool) {
		for key, raw := range src {
			modIds, ok := toStringSlice(raw)
			if !ok {
				continue
			}
			if _, exists := out[key]; !exists {
				out[key] = []string{}
			}
			for _, mid := range modIds {
				if !allowVisited {
					if _, seen := visited[mid]; seen {
						continue
					}
				}
				if !contains(out[key], mid) {
					out[key] = append(out[key], mid)
				}
				visited[mid] = struct{}{}
			}
		}
	}

	consume(mapping.Extra, true)
	consume(existing.Extra, false)

	path := filepath.Join(s.host.AppDataPath, rulesFile)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("instancemodsgroup: mkdir for shared rules: %w", err)
	}
	if err := writeJSON(path, out); err != nil {
		return fmt.Errorf("instancemodsgroup: write shared rules: %w", err)
	}
	return nil
}

// ============================================================
// fsnotify watcher
// ============================================================

// startWatcher spawns the fsnotify goroutine for a watch. We watch
// the parent directory because fsnotify struggles with files that
// don't exist yet (mod-groups.json is created the first time the
// renderer saves a group layout).
func (s *Service) startWatcher(instancePath string, w *watch) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		s.host.Logger.Warn("instancemodsgroup: fsnotify unavailable", "err", err)
		return
	}
	w.watcher = watcher

	if err := os.MkdirAll(instancePath, 0o755); err != nil {
		s.host.Logger.Warn("instancemodsgroup: mkdir instance dir", "path", instancePath, "err", err)
	}
	if err := watcher.Add(instancePath); err != nil {
		s.host.Logger.Warn("instancemodsgroup: watch instance dir", "path", instancePath, "err", err)
		return
	}

	go s.runWatcher(instancePath, w)
}

// runWatcher debounces fsnotify events and emits a `groupsSet`
// mutation when `mod-groups.json` materially changes.
func (s *Service) runWatcher(instancePath string, w *watch) {
	const debounce = 200 * time.Millisecond
	target := filepath.Join(instancePath, groupsFile)
	var timer *time.Timer
	var timerC <-chan time.Time
	arm := func() {
		if timer == nil {
			timer = time.NewTimer(debounce)
			timerC = timer.C
			return
		}
		if !timer.Stop() {
			select {
			case <-timer.C:
			default:
			}
		}
		timer.Reset(debounce)
		timerC = timer.C
	}

	for {
		select {
		case <-w.stop:
			if timer != nil {
				timer.Stop()
			}
			return
		case ev, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			if ev.Name != target {
				continue
			}
			arm()
		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			s.host.Logger.Debug("instancemodsgroup: watcher error", "err", err)
		case <-timerC:
			timer = nil
			timerC = nil
			s.reloadAndPush(instancePath, w, target)
		}
	}
}

// reloadAndPush re-reads mod-groups.json and pushes a `groupsSet`
// mutation when the on-disk content differs from the current payload.
// Identical reads are silently dropped to avoid infinite self-write
// loops (UpdateModsGroups → fsnotify → reloadAndPush → state push).
func (s *Service) reloadAndPush(instancePath string, w *watch, target string) {
	next, _ := readGroupsFile(target)
	w.mu.Lock()
	cur := w.payload.Groups
	if groupsEqual(cur, next) {
		w.mu.Unlock()
		return
	}
	w.payload.Groups = next
	w.mu.Unlock()
	s.states.Push(stateIDFor(instancePath), "groupsSet", next)
}

// ============================================================
// Helpers
// ============================================================

// readGroupsFile loads `<path>` and returns the decoded groups map.
// Missing / malformed files surface as an empty map; callers don't
// distinguish "no file" from "broken file" — both are presented as
// "no groups configured".
func readGroupsFile(path string) (map[string]contract.ModGroupData, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return map[string]contract.ModGroupData{}, err
	}
	var out map[string]contract.ModGroupData
	if err := json.Unmarshal(data, &out); err != nil {
		return map[string]contract.ModGroupData{}, err
	}
	if out == nil {
		out = map[string]contract.ModGroupData{}
	}
	return out, nil
}

// writeJSON serialises `v` and atomically writes it to `path` using
// the conventional `<path>.part` → rename dance.
func writeJSON(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".part"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// decodeGroups normalises the renderer-supplied payload (`map[string]any`
// after JSON decode) into the typed `map[string]ModGroupData`. Returns
// (nil, false) when the wire shape is unrecognisable.
func decodeGroups(raw any) (map[string]contract.ModGroupData, bool) {
	if raw == nil {
		return map[string]contract.ModGroupData{}, true
	}
	if m, ok := raw.(map[string]contract.ModGroupData); ok {
		return m, true
	}
	// Round-trip through JSON for the common `map[string]any` case.
	data, err := json.Marshal(raw)
	if err != nil {
		return nil, false
	}
	var out map[string]contract.ModGroupData
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, false
	}
	if out == nil {
		out = map[string]contract.ModGroupData{}
	}
	return out, true
}

// toStringSlice coerces the generic Extra-map values into `[]string`.
// Accepts both `[]string` and `[]any` (the path the renderer's
// freshly-deserialised wire payload takes).
func toStringSlice(v any) ([]string, bool) {
	switch x := v.(type) {
	case []string:
		out := make([]string, 0, len(x))
		out = append(out, x...)
		return out, true
	case []any:
		out := make([]string, 0, len(x))
		for _, item := range x {
			s, ok := item.(string)
			if !ok {
				return nil, false
			}
			out = append(out, s)
		}
		return out, true
	}
	return nil, false
}

func contains(slice []string, v string) bool {
	for _, s := range slice {
		if s == v {
			return true
		}
	}
	return false
}

// groupsEqual compares two ModGroupData maps for value equality. Used
// by the fsnotify reloader to skip no-op mutations and break the
// self-write loop.
func groupsEqual(a, b map[string]contract.ModGroupData) bool {
	if len(a) != len(b) {
		return false
	}
	for k, va := range a {
		vb, ok := b[k]
		if !ok {
			return false
		}
		if va.Color != vb.Color {
			return false
		}
		if len(va.Files) != len(vb.Files) {
			return false
		}
		for i := range va.Files {
			if va.Files[i] != vb.Files[i] {
				return false
			}
		}
	}
	return true
}
