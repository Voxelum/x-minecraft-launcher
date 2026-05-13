// Package instancesaves implements contract.InstanceSavesService.
//
// On-disk operations for `<instance>/saves/`:
//
//   - GetInstanceSaves / Watch — produce InstanceSaveHeader rows
//     for each subfolder under `saves/` containing a `level.dat`.
//   - CloneSave / DeleteSave / ImportSave / ExportSave — typical
//     filesystem dance the renderer's Saves tab triggers.
//   - LinkSharedSave / UnlinkSharedSave / IsSaveLinked — symlink
//     `<instance>/saves` → `<gameRoot>/saves` so saves are pooled
//     across instances.
//   - LinkSaveAsServerWorld — symlink `<instance>/server/world` →
//     a save folder so the bundled server reuses it.
//
// Watch returns the canonical `Saves` SharedState; the initial scan
// is one-shot per instance (subsequent file mutations push deltas
// through the `instanceSaveUpdate` / `instanceSaveRemove` mutators).
package instancesaves

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/parsers/gamedata"
)

const savesSubdir = "saves"

// Service implements contract.InstanceSavesService.
type Service struct {
	contract.InstanceSavesServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	mu      sync.Mutex
	watches map[string]*watch
}

type watch struct {
	state   *bridge.SharedState
	payload *contract.Saves
	once    sync.Once
	watcher *fsnotify.Watcher
	stop    chan struct{}
	// known maps each currently-known save path to its last header so
	// the debounced rescan can compute add/update/remove deltas.
	known map[string]contract.InstanceSave
	mu    sync.Mutex
}

// New constructs an InstanceSavesService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm, watches: map[string]*watch{}}
}

var _ contract.InstanceSavesService = (*Service)(nil)

// ============================================================
// Listing
// ============================================================

// GetInstanceSaves returns one header per save folder under
// `<instancePath>/saves/`. Hidden folders (`.foo`) are skipped.
func (s *Service) GetInstanceSaves(_ context.Context, path string) ([]contract.InstanceSaveHeader, error) {
	if path == "" {
		return nil, errors.New("GetInstanceSaves: path required")
	}
	dir := filepath.Join(path, savesSubdir)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []contract.InstanceSaveHeader{}, nil
		}
		return nil, err
	}
	instanceName := filepath.Base(path)
	out := make([]contract.InstanceSaveHeader, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		savePath := filepath.Join(dir, e.Name())
		if _, err := os.Stat(filepath.Join(savePath, "level.dat")); err != nil {
			continue
		}
		out = append(out, makeHeader(savePath, instanceName))
	}
	return out, nil
}

// Watch returns the live Saves SharedState, scanning the saves
// directory on first call. The state id mirrors the TS convention:
// `instance-saves://<instancePath>`.
func (s *Service) Watch(_ context.Context, path string) (*bridge.SharedState, error) {
	if path == "" {
		return nil, errors.New("Watch: instancePath required")
	}
	w := s.getWatch(path)
	var initErr error
	w.once.Do(func() {
		initErr = s.populateWatch(path, w)
	})
	if initErr != nil {
		return nil, initErr
	}
	return w.state, nil
}

func (s *Service) getWatch(path string) *watch {
	s.mu.Lock()
	defer s.mu.Unlock()
	if w, ok := s.watches[path]; ok {
		return w
	}
	w := &watch{}
	s.watches[path] = w
	return w
}

func (s *Service) populateWatch(path string, w *watch) error {
	saves, err := s.scanFull(path)
	if err != nil {
		return err
	}
	items := make([]any, len(saves))
	known := make(map[string]contract.InstanceSave, len(saves))
	for i, sv := range saves {
		items[i] = sv
		known[sv.Path] = sv
	}
	w.payload = &contract.Saves{Saves: items}
	w.known = known
	w.stop = make(chan struct{})

	stateID := stateIDFor(path)
	w.state = s.states.Register(bridge.StateOpts{
		ID:        stateID,
		StateName: "Saves",
		Payload:   w.payload,
		Dispose: func() {
			s.disposeWatch(path)
		},
	})

	s.startWatcher(path, w)
	return nil
}

// startWatcher spawns the fsnotify goroutine for a watch. Failure to
// create the watcher is logged but non-fatal — the SharedState still
// works in snapshot-only mode.
func (s *Service) startWatcher(instancePath string, w *watch) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		s.host.Logger.Warn("instancesaves: fsnotify unavailable", "err", err)
		return
	}
	w.watcher = watcher

	savesDir := filepath.Join(instancePath, savesSubdir)
	if err := os.MkdirAll(savesDir, 0o755); err != nil {
		s.host.Logger.Warn("instancesaves: mkdir saves", "path", savesDir, "err", err)
	}
	if err := watcher.Add(savesDir); err != nil {
		s.host.Logger.Warn("instancesaves: watch saves dir", "path", savesDir, "err", err)
	}
	// Watch each existing save subfolder so we get events for level.dat
	// add/change/remove without relying on recursive watching (fsnotify
	// is non-recursive on every backend).
	for savePath := range w.known {
		if err := watcher.Add(savePath); err != nil {
			s.host.Logger.Debug("instancesaves: watch save", "path", savePath, "err", err)
		}
	}

	go s.runWatcher(instancePath, w)
}

// runWatcher debounces fsnotify events and triggers full rescans /
// diffs against w.known. It exits when w.stop is closed.
func (s *Service) runWatcher(instancePath string, w *watch) {
	const debounce = 300 * time.Millisecond
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
	savesDir := filepath.Join(instancePath, savesSubdir)
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
			// On a new save subdir, start watching it so we catch
			// the level.dat write that follows.
			if ev.Op&fsnotify.Create != 0 && filepath.Dir(ev.Name) == savesDir {
				if info, err := os.Stat(ev.Name); err == nil && info.IsDir() {
					_ = w.watcher.Add(ev.Name)
				}
			}
			if ev.Op&fsnotify.Remove != 0 || ev.Op&fsnotify.Rename != 0 {
				if filepath.Dir(ev.Name) == savesDir {
					_ = w.watcher.Remove(ev.Name)
				}
			}
			arm()
		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			s.host.Logger.Debug("instancesaves: watcher error", "err", err)
		case <-timerC:
			timer = nil
			timerC = nil
			s.diffAndPush(instancePath, w)
		}
	}
}

// diffAndPush re-scans the saves dir and emits per-save
// instanceSaveUpdate / instanceSaveRemove mutations against the last
// known set.
func (s *Service) diffAndPush(instancePath string, w *watch) {
	saves, err := s.scanFull(instancePath)
	if err != nil {
		s.host.Logger.Debug("instancesaves: rescan failed", "err", err)
		return
	}
	next := make(map[string]contract.InstanceSave, len(saves))
	for _, sv := range saves {
		next[sv.Path] = sv
	}

	w.mu.Lock()
	prev := w.known
	items := make([]any, len(saves))
	for i, sv := range saves {
		items[i] = sv
	}
	if w.payload != nil {
		w.payload.Saves = items
	}
	w.known = next
	w.mu.Unlock()

	stateID := stateIDFor(instancePath)
	for path, sv := range next {
		old, existed := prev[path]
		if !existed || !sameSave(old, sv) {
			s.states.Push(stateID, "instanceSaveUpdate", sv)
			// Newly-discovered save dirs need a watcher entry.
			if !existed && w.watcher != nil {
				_ = w.watcher.Add(path)
			}
		}
	}
	for path := range prev {
		if _, ok := next[path]; !ok {
			s.states.Push(stateID, "instanceSaveRemove", path)
			if w.watcher != nil {
				_ = w.watcher.Remove(path)
			}
		}
	}
}

// disposeWatch tears down the fsnotify goroutine and drops the watch
// from the cache so the next Watch() call re-initialises.
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

// sameSave reports whether two InstanceSave records are equal for the
// purpose of suppressing redundant instanceSaveUpdate pushes.
func sameSave(a, b contract.InstanceSave) bool {
	return a.LevelName == b.LevelName &&
		a.Mode == b.Mode &&
		a.Cheat == b.Cheat &&
		a.GameVersion == b.GameVersion &&
		a.Difficulty == b.Difficulty &&
		a.LastPlayed == b.LastPlayed &&
		a.Time == b.Time &&
		a.Advancements == b.Advancements &&
		a.Seed == b.Seed &&
		a.Path == b.Path &&
		a.InstanceName == b.InstanceName
}

// scanFull mirrors GetInstanceSaves but also reads the level.dat NBT
// to populate the full InstanceSave fields (mode/seed/lastPlayed/…).
func (s *Service) scanFull(instancePath string) ([]contract.InstanceSave, error) {
	dir := filepath.Join(instancePath, savesSubdir)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	instanceName := filepath.Base(instancePath)
	out := make([]contract.InstanceSave, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		savePath := filepath.Join(dir, e.Name())
		header := makeHeader(savePath, instanceName)
		meta, err := gamedata.ReadLevelDat(savePath)
		if err != nil {
			s.host.Logger.Warn("instancesaves: skip save", "path", savePath, "err", err)
			continue
		}
		out = append(out, contract.InstanceSave{
			LevelName:    meta.LevelName,
			Mode:         modeName(meta.Mode),
			Cheat:        meta.Cheat,
			GameVersion:  meta.GameVersion,
			Difficulty:   float64(meta.Difficulty),
			LastPlayed:   float64(meta.LastPlayed),
			Time:         float64(meta.Time),
			Advancements: float64(meta.Advancements),
			Seed:         meta.Seed,
			Path:         header.Path,
			InstanceName: header.InstanceName,
		})
	}
	return out, nil
}

// makeHeader builds the lightweight InstanceSaveHeader for a save dir.
func makeHeader(savePath, instanceName string) contract.InstanceSaveHeader {
	icon := "http://launcher/media?path=" + filepath.ToSlash(filepath.Join(savePath, "icon.png"))
	header := contract.InstanceSaveHeader{
		Path:         savePath,
		InstanceName: instanceName,
		Name:         filepath.Base(savePath),
		Icon:         icon,
	}
	if target, err := os.Readlink(savePath); err == nil {
		header.LinkTo = &target
	}
	return header
}

// modeName maps Mojang's GameType byte → renderer string.
func modeName(mode int) string {
	switch mode {
	case 0:
		return "survival"
	case 1:
		return "creative"
	case 2:
		return "adventure"
	case 3:
		return "spectator"
	}
	return ""
}

// ============================================================
// Mutating ops
// ============================================================

// CloneSave copies a save folder under `srcInstancePath/saves/<saveName>`
// to one or more destination instances. Mirrors the TS reference's
// fan-out semantics — DestInstancePath may be a string or []string.
func (s *Service) CloneSave(_ context.Context, options contract.CloneSaveOptions) error {
	if options.SrcInstancePath == "" || options.SaveName == "" {
		return errors.New("CloneSave: srcInstancePath + saveName required")
	}
	src := filepath.Join(options.SrcInstancePath, savesSubdir, options.SaveName)
	if _, err := os.Stat(src); err != nil {
		return fmt.Errorf("CloneSave: source: %w", err)
	}
	dests := normaliseDest(options.DestInstancePath)
	newName := options.SaveName
	if options.NewSaveName != nil && *options.NewSaveName != "" {
		newName = *options.NewSaveName
	}
	for _, dst := range dests {
		dstPath := filepath.Join(dst, savesSubdir, newName)
		if err := copyTree(src, dstPath); err != nil {
			return err
		}
		s.invalidate(dst)
	}
	return nil
}

// DeleteSave removes the save folder. When InstancePath is nil the
// shared-saves root is used (mirrors TS).
func (s *Service) DeleteSave(_ context.Context, options contract.DeleteSaveOptions) error {
	if options.SaveName == "" {
		return errors.New("DeleteSave: saveName required")
	}
	root := s.host.MinecraftDataPath
	if options.InstancePath != nil && *options.InstancePath != "" {
		root = *options.InstancePath
	}
	target := filepath.Join(root, savesSubdir, options.SaveName)
	if err := os.RemoveAll(target); err != nil {
		return err
	}
	if options.InstancePath != nil {
		s.invalidate(*options.InstancePath)
	}
	return nil
}

// ImportSave imports an external save (folder or zip). Returns the
// imported path.
func (s *Service) ImportSave(_ context.Context, options contract.ImportSaveOptions) (string, error) {
	if options.Path == "" || options.InstancePath == "" {
		return "", errors.New("ImportSave: path + instancePath required")
	}
	saveName := ""
	if options.SaveName != nil {
		saveName = *options.SaveName
	}
	if saveName == "" {
		base := filepath.Base(options.Path)
		saveName = strings.TrimSuffix(base, filepath.Ext(base))
	}
	dst := filepath.Join(options.InstancePath, savesSubdir, saveName)
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return "", err
	}

	srcInfo, err := os.Stat(options.Path)
	if err != nil {
		return "", err
	}
	if srcInfo.IsDir() {
		if err := copyTree(options.Path, dst); err != nil {
			return "", err
		}
	} else {
		if err := unzipInto(options.Path, dst); err != nil {
			return "", err
		}
	}
	s.invalidate(options.InstancePath)
	return dst, nil
}

// ExportSave writes the save to the destination as either a directory
// copy or a zip (default zip=true).
func (s *Service) ExportSave(_ context.Context, options contract.ExportSaveOptions) error {
	if options.InstancePath == "" || options.SaveName == "" || options.Destination == "" {
		return errors.New("ExportSave: instancePath + saveName + destination required")
	}
	src := filepath.Join(options.InstancePath, savesSubdir, options.SaveName)
	if _, err := os.Stat(src); err != nil {
		return err
	}
	zipMode := true
	if options.Zip != nil {
		zipMode = *options.Zip
	}
	if zipMode {
		return zipDir(src, options.Destination)
	}
	return copyTree(src, options.Destination)
}

// ShowDirectory is a renderer affordance — wired to a real shell open
// via the WindowService later.
func (s *Service) ShowDirectory(_ context.Context, _ string) error { return nil }

// ============================================================
// Shared-saves linking
// ============================================================

// LinkSharedSave swaps `<instance>/saves` for a symlink to
// `<gameRoot>/saves`. Existing local saves are migrated up first.
func (s *Service) LinkSharedSave(_ context.Context, instancePath string) error {
	if instancePath == "" {
		return errors.New("LinkSharedSave: instancePath required")
	}
	shared := filepath.Join(s.host.MinecraftDataPath, savesSubdir)
	local := filepath.Join(instancePath, savesSubdir)
	if err := os.MkdirAll(shared, 0o755); err != nil {
		return err
	}
	if entries, err := os.ReadDir(local); err == nil {
		for _, e := range entries {
			from := filepath.Join(local, e.Name())
			to := filepath.Join(shared, e.Name())
			if _, err := os.Stat(to); err == nil {
				continue
			}
			_ = os.Rename(from, to)
		}
	}
	_ = os.RemoveAll(local)
	return os.Symlink(shared, local)
}

// UnlinkSharedSave removes the symlink (no data is moved back).
func (s *Service) UnlinkSharedSave(_ context.Context, instancePath string) error {
	local := filepath.Join(instancePath, savesSubdir)
	info, err := os.Lstat(local)
	if err != nil {
		return nil
	}
	if info.Mode()&os.ModeSymlink == 0 {
		return nil
	}
	return os.Remove(local)
}

// IsSaveLinked reports whether `<instance>/saves` is a symlink to
// the global shared-saves folder.
func (s *Service) IsSaveLinked(_ context.Context, instancePath string) (bool, error) {
	local := filepath.Join(instancePath, savesSubdir)
	target, err := os.Readlink(local)
	if err != nil {
		return false, nil
	}
	shared := filepath.Join(s.host.MinecraftDataPath, savesSubdir)
	return filepath.Clean(target) == filepath.Clean(shared), nil
}

// GetSharedSaves enumerates saves under the global shared-saves dir.
func (s *Service) GetSharedSaves(_ context.Context) ([]contract.InstanceSave, error) {
	return s.scanFull(s.host.MinecraftDataPath)
}

// LinkSaveAsServerWorld points `<instance>/server/world` at a save.
func (s *Service) LinkSaveAsServerWorld(_ context.Context, options contract.LinkSaveAsServerWorldOptions) error {
	if options.InstancePath == "" || options.SaveName == "" {
		return errors.New("LinkSaveAsServerWorld: instancePath + saveName required")
	}
	src := options.SaveName
	if !filepath.IsAbs(src) {
		src = filepath.Join(options.InstancePath, savesSubdir, options.SaveName)
	}
	if _, err := os.Stat(src); err != nil {
		return err
	}
	dst := filepath.Join(options.InstancePath, "server", "world")
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	if info, err := os.Lstat(dst); err == nil {
		if info.Mode()&os.ModeSymlink != 0 {
			_ = os.Remove(dst)
		} else {
			_ = os.Rename(dst, dst+"-backup")
		}
	}
	return os.Symlink(src, dst)
}

// GetLinkedSaveWorld returns the linked save's path (or the raw
// world path), or nil when no world exists.
func (s *Service) GetLinkedSaveWorld(_ context.Context, instancePath string) (*string, error) {
	wp := filepath.Join(instancePath, "server", "world")
	if _, err := os.Stat(wp); err != nil {
		return nil, nil
	}
	if target, err := os.Readlink(wp); err == nil {
		return &target, nil
	}
	return &wp, nil
}

// UpdateSave / ShareSave / GetWorldGenSettings / InstallFromMarket are
// out of scope for the initial G6 cut — TS reference uses NBT writes
// + the Modrinth/CurseForge market for the latter two.
func (s *Service) UpdateSave(_ context.Context, _ contract.UpdateSaveOptions) error {
	return errors.New("UpdateSave: not implemented (NBT writeback pending)")
}
func (s *Service) ShareSave(_ context.Context, _ contract.ShareSaveOptions) error {
	return errors.New("ShareSave: not implemented")
}
func (s *Service) GetWorldGenSettings(_ context.Context, _ string) (map[string]any, error) {
	return nil, nil
}
func (s *Service) InstallFromMarket(_ context.Context, _ map[string]any) (string, error) {
	return "", errors.New("InstallFromMarket: not implemented (pending MarketService)")
}

// ============================================================
// Helpers
// ============================================================

func stateIDFor(instancePath string) string {
	return "instance-saves://" + instancePath
}

func (s *Service) invalidate(instancePath string) {
	s.mu.Lock()
	w, ok := s.watches[instancePath]
	s.mu.Unlock()
	if !ok || w.payload == nil {
		return
	}
	s.diffAndPush(instancePath, w)
}

// normaliseDest accepts either a single string or a []string and
// returns a flat slice. Mirrors the TS union type.
func normaliseDest(v any) []string {
	switch t := v.(type) {
	case string:
		return []string{t}
	case []any:
		out := make([]string, 0, len(t))
		for _, x := range t {
			if s, ok := x.(string); ok {
				out = append(out, s)
			}
		}
		return out
	case []string:
		return t
	}
	return nil
}

// copyTree recursively copies src→dst.
func copyTree(src, dst string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return copyFile(src, dst)
	}
	if err := os.MkdirAll(dst, info.Mode()); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if err := copyTree(filepath.Join(src, e.Name()), filepath.Join(dst, e.Name())); err != nil {
			return err
		}
	}
	return nil
}

func copyFile(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
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

// zipDir writes every file under src into a zip at dst.
func zipDir(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	zw := zip.NewWriter(out)
	defer zw.Close()
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		w, err := zw.Create(filepath.ToSlash(rel))
		if err != nil {
			return err
		}
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(w, f)
		return err
	})
}

// unzipInto extracts every entry in `src` into `dst`. Path traversal
// is blocked.
func unzipInto(src, dst string) error {
	zr, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer zr.Close()
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	dstAbs, err := filepath.Abs(dst)
	if err != nil {
		return err
	}
	for _, f := range zr.File {
		path := filepath.Join(dst, filepath.FromSlash(f.Name))
		absPath, err := filepath.Abs(path)
		if err != nil {
			return err
		}
		if !strings.HasPrefix(absPath, dstAbs+string(os.PathSeparator)) && absPath != dstAbs {
			return fmt.Errorf("unzip: path traversal: %s", f.Name)
		}
		if f.FileInfo().IsDir() {
			_ = os.MkdirAll(path, 0o755)
			continue
		}
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		rc.Close()
		out.Close()
		if err != nil {
			return err
		}
	}
	return nil
}
