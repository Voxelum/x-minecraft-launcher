// Package instanceoptions implements contract.InstanceOptionsService.
//
// G6 ships the on-disk read/write surface for options.txt + EULA +
// server.properties plus an fsnotify-backed Watch that pushes
// gameOptionsSet / shaderPackSet / eulaSet mutations to the
// renderer's GameOptionsState SharedState.
package instanceoptions

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/parsers/gamesetting"
)

// Service implements contract.InstanceOptionsService.
type Service struct {
	contract.InstanceOptionsServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	mu      sync.Mutex
	watches map[string]*watch
}

type watch struct {
	state   *bridge.SharedState
	payload *contract.GameOptionsState
	once    sync.Once
	watcher *fsnotify.Watcher
	stop    chan struct{}
	mu      sync.Mutex
}

// New constructs an InstanceOptionsService bound to the host.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm, watches: map[string]*watch{}}
}

var _ contract.InstanceOptionsService = (*Service)(nil)

// ============================================================
// options.txt
// ============================================================

// GetGameOptions reads `<instance>/options.txt` and returns it as the
// renderer-friendly Frame map. Missing file → empty map; downstream
// code treats that as "no options yet".
func (s *Service) GetGameOptions(_ context.Context, instancePath string) (any, error) {
	if instancePath == "" {
		return map[string]any{}, nil
	}
	data, err := os.ReadFile(filepath.Join(instancePath, "options.txt"))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return map[string]any{}, nil
		}
		return nil, err
	}
	frame := gamesetting.Parse(string(data))
	// TS reference unwraps a stringified `resourcePacks` field that
	// some legacy installers produce. Mirror it here.
	if rp, ok := frame["resourcePacks"].(string); ok {
		// Best-effort: try a JSON-ish decode by re-routing through the
		// array decoder. Easiest path is to re-stringify and run the
		// parser's array path manually.
		frame["resourcePacks"] = parseStringResourcePacks(rp)
	}
	return map[string]any(frame), nil
}

// EditGameSetting merges the renderer-supplied options onto the
// existing options.txt, writing back via the gamesetting stringify.
//
// The `Extra` map carries every TS option key the renderer set
// (lang, fov, renderDistance, …). The named `InstancePath` is the
// target directory.
func (s *Service) EditGameSetting(_ context.Context, options contract.EditGameSettingOptions) error {
	if options.InstancePath == "" {
		return errors.New("EditGameSetting: instancePath required")
	}
	current, err := s.GetGameOptions(context.Background(), options.InstancePath)
	if err != nil {
		return err
	}
	frame, _ := current.(map[string]any)
	if frame == nil {
		frame = map[string]any{}
	}

	// Compute the diff exactly like the TS reference: when the file
	// already has the key, only write a different value; otherwise
	// accept the new key wholesale.
	dirty := false
	for key, val := range options.Extra {
		// `lang` is canonicalised to lower_case with underscores.
		if key == "lang" {
			if s, ok := val.(string); ok {
				val = strings.ReplaceAll(strings.ToLower(s), "-", "_")
			}
		}
		if existing, present := frame[key]; present {
			if !equalScalar(existing, val) {
				frame[key] = val
				dirty = true
			}
			continue
		}
		frame[key] = val
		dirty = true
	}
	if !dirty {
		return nil
	}
	return s.host.Mutex.With("options:"+options.InstancePath, func() error {
		out := gamesetting.Stringify(gamesetting.Frame(frame), "", "")
		return atomicWrite(filepath.Join(options.InstancePath, "options.txt"), []byte(out))
	})
}

// ShowOptionsFileInFolder is a renderer-side affordance we forward
// to the host's file manager. Stubbed to no-op until G8 wires the
// `image://` / shell-open paths.
func (s *Service) ShowOptionsFileInFolder(_ context.Context, _ string) error { return nil }

// ============================================================
// EULA
// ============================================================

// GetEULA reads `<instance>/server/eula.txt` and returns the
// `eula=true` flag. Anything else → false (incl. missing file).
func (s *Service) GetEULA(_ context.Context, instancePath string) (bool, error) {
	data, err := os.ReadFile(filepath.Join(instancePath, "server", "eula.txt"))
	if err != nil {
		return false, nil
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}
		eq := strings.IndexByte(line, '=')
		if eq < 0 {
			continue
		}
		key := strings.TrimSpace(line[:eq])
		val := strings.TrimSpace(line[eq+1:])
		if key == "eula" {
			return val == "true", nil
		}
	}
	return false, nil
}

// SetEULA writes `<instance>/server/eula.txt`.
func (s *Service) SetEULA(_ context.Context, instancePath string, value bool) error {
	dir := filepath.Join(instancePath, "server")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	body := fmt.Sprintf("#XMCL-managed eula\neula=%v\n", value)
	return atomicWrite(filepath.Join(dir, "eula.txt"), []byte(body))
}

// ============================================================
// server.properties
// ============================================================

// GetServerProperties reads `<instance>/server/server.properties` as
// a flat string→string map. Missing file → empty map.
func (s *Service) GetServerProperties(_ context.Context, instancePath string) (map[string]string, error) {
	data, err := os.ReadFile(filepath.Join(instancePath, "server", "server.properties"))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return map[string]string{}, nil
		}
		return nil, err
	}
	return parseProperties(string(data)), nil
}

// SetServerProperties merges `properties` onto the existing file.
func (s *Service) SetServerProperties(_ context.Context, instancePath string, properties map[string]any) error {
	current, err := s.GetServerProperties(context.Background(), instancePath)
	if err != nil {
		return err
	}
	for k, v := range properties {
		current[k] = fmt.Sprint(v)
	}
	return s.host.Mutex.With("server-props:"+instancePath, func() error {
		dir := filepath.Join(instancePath, "server")
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
		return atomicWrite(filepath.Join(dir, "server.properties"), []byte(stringifyProperties(current)))
	})
}

// ============================================================
// Helpers
// ============================================================

func parseProperties(s string) map[string]string {
	out := map[string]string{}
	for _, line := range strings.Split(s, "\n") {
		line = strings.TrimRight(line, "\r ")
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		eq := strings.IndexByte(line, '=')
		if eq < 0 {
			continue
		}
		out[strings.TrimSpace(line[:eq])] = strings.TrimSpace(line[eq+1:])
	}
	return out
}

func stringifyProperties(m map[string]string) string {
	// Stable ordering for predictable diffs.
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	for i := 1; i < len(keys); i++ {
		x, j := keys[i], i
		for ; j > 0 && keys[j-1] > x; j-- {
			keys[j] = keys[j-1]
		}
		keys[j] = x
	}
	var b strings.Builder
	for _, k := range keys {
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(m[k])
		b.WriteByte('\n')
	}
	return b.String()
}

func atomicWrite(path string, data []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// parseStringResourcePacks turns a JSON-ish string (legacy serialisation)
// into a real []string. Anything that doesn't decode is treated as the
// empty list — the TS reference does the same defensively.
func parseStringResourcePacks(s string) []string {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "[") || !strings.HasSuffix(s, "]") {
		return []string{}
	}
	frame := gamesetting.Parse("resourcePacks:" + s)
	return frame.Strings("resourcePacks")
}

// equalScalar compares two values for "same setting written to disk".
// We can't recurse into nested objects from here (they go through the
// renderer's mutator path); for scalars / simple slices a JSON-ish
// equality is good enough.
func equalScalar(a, b any) bool {
	return fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b)
}

// ============================================================
// Shader options
// ============================================================

// GetShaderOptions reads `<instance>/optionsshaders.txt` and returns
// the parsed `ShaderOptions`. Missing file or no `shaderPack` key →
// `{ShaderPack: ""}`. Mirrors the TS reference's defensive parser.
func (s *Service) GetShaderOptions(_ context.Context, instancePath string) (contract.ShaderOptions, error) {
	if instancePath == "" {
		return contract.ShaderOptions{}, nil
	}
	data, err := os.ReadFile(filepath.Join(instancePath, "optionsshaders.txt"))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return contract.ShaderOptions{}, nil
		}
		return contract.ShaderOptions{}, err
	}
	pack := ""
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		eq := strings.IndexByte(line, '=')
		if eq < 0 {
			continue
		}
		key := strings.TrimSpace(line[:eq])
		val := strings.TrimSpace(line[eq+1:])
		if key == "shaderPack" {
			pack = val
			break
		}
	}
	return contract.ShaderOptions{ShaderPack: pack}, nil
}

// ============================================================
// Watch
// ============================================================

// Watch returns the live GameOptionsState SharedState for the named
// instance. Subsequent fsnotify events on `options.txt`,
// `optionsshaders.txt`, and `server/eula.txt` push the matching
// `gameOptionsSet` / `shaderPackSet` / `eulaSet` mutation through the
// bridge.
//
// State id mirrors the TS convention: `instance-game-option://<path>`.
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
	w.payload = &contract.GameOptionsState{ResourcePacks: []any{}}
	w.stop = make(chan struct{})

	// Initial fill: read each of the three files; ignore failures so a
	// brand-new instance still produces a usable state.
	s.loadGameOptions(instancePath, w, false)
	s.loadShader(instancePath, w, false)
	s.loadEula(instancePath, w, false)

	stateID := stateIDFor(instancePath)
	w.state = s.states.Register(bridge.StateOpts{
		ID:        stateID,
		StateName: "GameOptionsState",
		Payload:   w.payload,
		Dispose: func() {
			s.disposeWatch(instancePath)
		},
	})

	s.startWatcher(instancePath, w)
	return nil
}

func (s *Service) startWatcher(instancePath string, w *watch) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		s.host.Logger.Warn("instanceoptions: fsnotify unavailable", "err", err)
		return
	}
	w.watcher = watcher
	if err := os.MkdirAll(instancePath, 0o755); err == nil {
		if err := watcher.Add(instancePath); err != nil {
			s.host.Logger.Debug("instanceoptions: watch instance dir", "err", err)
		}
	}
	serverDir := filepath.Join(instancePath, "server")
	if err := os.MkdirAll(serverDir, 0o755); err == nil {
		if err := watcher.Add(serverDir); err != nil {
			s.host.Logger.Debug("instanceoptions: watch server dir", "err", err)
		}
	}
	go s.runWatcher(instancePath, w)
}

func (s *Service) runWatcher(instancePath string, w *watch) {
	const debounce = 200 * time.Millisecond
	pending := map[string]*time.Timer{}
	fire := func(name string) {
		switch name {
		case "options.txt":
			s.loadGameOptions(instancePath, w, true)
		case "optionsshaders.txt":
			s.loadShader(instancePath, w, true)
		case "eula.txt":
			s.loadEula(instancePath, w, true)
		}
	}
	arm := func(name string) {
		if t, ok := pending[name]; ok {
			t.Reset(debounce)
			return
		}
		pending[name] = time.AfterFunc(debounce, func() {
			fire(name)
		})
	}
	for {
		select {
		case <-w.stop:
			for _, t := range pending {
				t.Stop()
			}
			return
		case ev, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			arm(filepath.Base(ev.Name))
		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			s.host.Logger.Debug("instanceoptions: watcher error", "err", err)
		}
	}
}

func (s *Service) disposeWatch(instancePath string) {
	s.mu.Lock()
	w, ok := s.watches[instancePath]
	if ok {
		delete(s.watches, instancePath)
	}
	s.mu.Unlock()
	if !ok {
		return
	}
	if w.stop != nil {
		select {
		case <-w.stop:
		default:
			close(w.stop)
		}
	}
	if w.watcher != nil {
		_ = w.watcher.Close()
	}
}

func (s *Service) loadGameOptions(instancePath string, w *watch, push bool) {
	res, err := s.GetGameOptions(context.Background(), instancePath)
	if err != nil {
		s.host.Logger.Debug("instanceoptions: load options.txt", "err", err)
		return
	}
	w.mu.Lock()
	w.payload = applyGameOptions(w.payload, res)
	w.mu.Unlock()
	if push {
		s.states.Push(stateIDFor(instancePath), "gameOptionsSet", res)
	}
}

func (s *Service) loadShader(instancePath string, w *watch, push bool) {
	opts, err := s.GetShaderOptions(context.Background(), instancePath)
	if err != nil {
		s.host.Logger.Debug("instanceoptions: load optionsshaders.txt", "err", err)
		return
	}
	w.mu.Lock()
	if w.payload != nil {
		w.payload.ShaderPack = opts.ShaderPack
	}
	w.mu.Unlock()
	if push {
		s.states.Push(stateIDFor(instancePath), "shaderPackSet", opts.ShaderPack)
	}
}

func (s *Service) loadEula(instancePath string, w *watch, push bool) {
	value, err := s.GetEULA(context.Background(), instancePath)
	if err != nil {
		s.host.Logger.Debug("instanceoptions: load eula.txt", "err", err)
		return
	}
	w.mu.Lock()
	if w.payload != nil {
		w.payload.Eula = value
	}
	w.mu.Unlock()
	if push {
		s.states.Push(stateIDFor(instancePath), "eulaSet", value)
	}
}

// applyGameOptions overlays the parsed options.txt frame onto the
// GameOptionsState payload, leaving fields untouched when the frame
// has no entry. Mirrors the TS `state.gameOptionsSet(frame)` which
// does an `Object.assign`.
func applyGameOptions(payload *contract.GameOptionsState, raw any) *contract.GameOptionsState {
	if payload == nil {
		payload = &contract.GameOptionsState{}
	}
	frame, ok := raw.(map[string]any)
	if !ok {
		return payload
	}
	if v, ok := frame["resourcePacks"]; ok {
		switch t := v.(type) {
		case []any:
			payload.ResourcePacks = t
		case []string:
			out := make([]any, len(t))
			for i, s := range t {
				out[i] = s
			}
			payload.ResourcePacks = out
		}
	}
	if v, ok := frame["anaglyph3d"]; ok {
		payload.Anaglyph3d = v
	}
	if v, ok := frame["ao"]; ok {
		payload.Ao = v
	}
	if v, ok := frame["useVbo"]; ok {
		payload.UseVbo = v
	}
	if v, ok := frame["enableVsync"]; ok {
		payload.EnableVsync = v
	}
	if v, ok := frame["difficulty"]; ok {
		payload.Difficulty = v
	}
	if v, ok := frame["entityShadows"]; ok {
		payload.EntityShadows = v
	}
	if v, ok := frame["fboEnable"]; ok {
		payload.FboEnable = v
	}
	if v, ok := frame["fullscreen"]; ok {
		payload.Fullscreen = v
	}
	if v, ok := frame["renderDistance"]; ok {
		payload.RenderDistance = v
	}
	if v, ok := frame["fancyGraphics"]; ok {
		payload.FancyGraphics = v
	}
	if v, ok := frame["renderClouds"]; ok {
		payload.RenderClouds = v
	}
	if v, ok := frame["lang"]; ok {
		if s, ok := v.(string); ok {
			payload.Lang = s
		}
	}
	if v, ok := frame["shaderPack"]; ok {
		if s, ok := v.(string); ok {
			payload.ShaderPack = s
		}
	}
	return payload
}

func stateIDFor(instancePath string) string {
	return "instance-game-option://" + instancePath
}
