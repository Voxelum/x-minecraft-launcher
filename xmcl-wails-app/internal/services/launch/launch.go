// Package launch implements contract.LaunchService — argument
// assembly, JVM spawning, and live process supervision.
//
// G6 shipped GenerateArguments. G5 expands the surface to actually
// spawn the JVM (`os/exec`), capture stdout/stderr line-by-line and
// re-emit them through the Wails bridge as `minecraft-stdout`,
// `minecraft-stderr`, `minecraft-start`, `minecraft-exit` events so
// the renderer's existing log-viewer keeps working without changes.
//
// The supervisor is purely in-memory; persistence (e.g. surviving a
// launcher restart while the JVM is alive) lands in G7.
package launch

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/parsers/core"
)

// Service implements contract.LaunchService.
type Service struct {
	contract.LaunchServiceNotImplemented

	host   *host.Host
	events *contract.LaunchServiceEvents

	mu    sync.RWMutex
	procs map[int]*tracked
}

// tracked carries the live process metadata the renderer asks for via
// GetGameProcess / GetGameProcesses.
type tracked struct {
	cmd     *exec.Cmd
	options contract.LaunchOptions
	side    string
	ready   bool
	startAt time.Time
}

// New constructs a LaunchService. The Bridge accessed via `sm.Bridge()`
// is only needed for the event broadcaster — registering events here
// keeps the registry-gen's two-arg constructor signature unchanged.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{
		host:   h,
		events: contract.NewLaunchServiceEvents(sm.Bridge()),
		procs:  map[int]*tracked{},
	}
}

var _ contract.LaunchService = (*Service)(nil)

// ============================================================
// Argument assembly
// ============================================================

// GenerateArguments is the pure, no-IO precursor every launch step
// uses. Mirrors `@xmcl/core`'s `generateArguments`.
func (s *Service) GenerateArguments(_ context.Context, options contract.LaunchOptions) ([]string, error) {
	opts, err := s.toCoreLaunchOption(options)
	if err != nil {
		return nil, err
	}
	return core.GenerateArguments(opts)
}

// ============================================================
// Launch + supervision
// ============================================================

// Launch starts the JVM using the resolved version + classpath and
// returns the OS pid. The renderer treats `*float64` as "missing"
// when nil — that's how we surface "launch precheck failed". Errors
// that block the launch (missing java, corrupt jars, …) come back as
// the function's `error` return so the renderer's notification
// machinery can react.
func (s *Service) Launch(_ context.Context, options contract.LaunchOptions) (*float64, error) {
	opts, err := s.toCoreLaunchOption(options)
	if err != nil {
		return nil, err
	}
	mc := core.NewMinecraftFolder(s.host.MinecraftDataPath)

	// Resolve version up-front so prechecks don't repeat the parse.
	if opts.ResolvedVersion == nil {
		platform := opts.Platform
		if platform == nil {
			p := core.CurrentPlatform()
			platform = &p
		}
		v, err := core.ParseVersion(mc, opts.Version, *platform)
		if err != nil {
			return nil, fmt.Errorf("Launch: parse version %s: %w", opts.Version, err)
		}
		opts.ResolvedVersion = v
	}

	// Prechecks (skip when explicitly opted out).
	skip := options.SkipAssetsCheck != nil && *options.SkipAssetsCheck
	if !skip {
		if err := core.CheckJava(opts.JavaPath); err != nil {
			return nil, err
		}
		if err := core.CheckVersion(mc, opts.ResolvedVersion); err != nil {
			return nil, err
		}
		if err := core.CheckLibraries(mc, opts.ResolvedVersion); err != nil {
			return nil, err
		}
	}
	// Natives extraction is always needed even when assets are skipped:
	// the JVM literally can't load LWJGL otherwise.
	if err := core.CheckNatives(mc, opts.ResolvedVersion, opts.NativeRoot, opts.Platform); err != nil {
		return nil, fmt.Errorf("Launch: natives: %w", err)
	}
	// Legacy assets staging — best-effort; modern Minecraft versions
	// don't need this and the older ones can fall back to the
	// assetIndex layout the JVM still understands.
	if err := core.LinkAssets(mc, opts.ResolvedVersion); err != nil {
		s.host.Logger.Warn("launch: link assets failed", "err", err)
	}

	args, err := core.GenerateArguments(opts)
	if err != nil {
		return nil, err
	}
	if len(args) < 2 {
		return nil, errors.New("Launch: empty argument list")
	}

	cmd := exec.Command(args[0], args[1:]...)
	cmd.Dir = opts.GamePath
	cmd.Env = mergedEnv(options.Env)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("Launch: stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("Launch: stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("Launch: spawn: %w", err)
	}

	pid := cmd.Process.Pid
	side := "client"
	if options.Side != nil {
		side = *options.Side
	}
	t := &tracked{
		cmd:     cmd,
		options: options,
		side:    side,
		startAt: time.Now(),
	}
	s.mu.Lock()
	s.procs[pid] = t
	s.mu.Unlock()

	s.events.EmitMinecraftStart(map[string]any{
		"pid":     float64(pid),
		"side":    side,
		"options": options,
	})

	go s.streamLines(pid, side, stdout, /*isStderr*/ false)
	go s.streamLines(pid, side, stderr, /*isStderr*/ true)
	go s.waitAndCleanup(pid, t)

	out := float64(pid)
	return &out, nil
}

// Kill sends a graceful signal (SIGINT) when `force` is false, or
// unconditionally terminates the process when `force` is true. Returns
// nil even if the process had already exited so the renderer can call
// this idempotently from a "Stop" button.
func (s *Service) Kill(_ context.Context, pid float64, force bool) error {
	id := int(pid)
	s.mu.RLock()
	t, ok := s.procs[id]
	s.mu.RUnlock()
	if !ok || t.cmd == nil || t.cmd.Process == nil {
		return nil
	}
	if force || runtime.GOOS == "windows" {
		// `os.Process.Signal(os.Interrupt)` is a no-op on Windows;
		// fall back to Kill there.
		return t.cmd.Process.Kill()
	}
	return t.cmd.Process.Signal(os.Interrupt)
}

// GetGameProcess returns metadata for one tracked process, or nil if
// the pid is unknown / has already exited.
func (s *Service) GetGameProcess(_ context.Context, pid float64) (*contract.GameProcess, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.procs[int(pid)]
	if !ok {
		return nil, nil
	}
	return &contract.GameProcess{
		Pid:     pid,
		Ready:   t.ready,
		Side:    t.side,
		Options: t.options,
	}, nil
}

// GetGameProcesses snapshots every currently-tracked JVM. The renderer
// polls this on home-view boot to repopulate its "running" badges.
func (s *Service) GetGameProcesses(_ context.Context) ([]contract.GameProcess, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]contract.GameProcess, 0, len(s.procs))
	for pid, t := range s.procs {
		out = append(out, contract.GameProcess{
			Pid:     float64(pid),
			Ready:   t.ready,
			Side:    t.side,
			Options: t.options,
		})
	}
	return out, nil
}

// ============================================================
// Internals
// ============================================================

// streamLines pumps a JVM stream into the bridge as discrete events.
// Mirrors the Electron preload's per-line broadcast — the renderer's
// log-viewer expects one chunk == one line.
func (s *Service) streamLines(pid int, side string, r io.Reader, isStderr bool) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		payload := map[string]any{
			"pid":  float64(pid),
			"side": side,
			"line": scanner.Text(),
			"time": float64(time.Now().UnixMilli()),
		}
		if isStderr {
			s.events.EmitMinecraftStderr(payload)
		} else {
			s.events.EmitMinecraftStdout(payload)
		}
	}
}

// waitAndCleanup blocks until the JVM exits, emits a final event with
// the exit code, and removes the entry from the supervision map.
func (s *Service) waitAndCleanup(pid int, t *tracked) {
	err := t.cmd.Wait()
	code := 0
	signal := ""
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			code = exitErr.ExitCode()
		} else {
			signal = err.Error()
		}
	}
	duration := time.Since(t.startAt).Milliseconds()

	s.mu.Lock()
	delete(s.procs, pid)
	s.mu.Unlock()

	s.events.EmitMinecraftExit(map[string]any{
		"pid":      float64(pid),
		"side":     t.side,
		"code":     float64(code),
		"signal":   signal,
		"duration": float64(duration),
	})
}

// mergedEnv overlays the renderer-supplied env map onto the parent
// process environment. Returning the parent env intact is critical on
// Windows so PATH / ProgramFiles propagate.
func mergedEnv(extra map[string]string) []string {
	parent := os.Environ()
	if len(extra) == 0 {
		return parent
	}
	out := make([]string, 0, len(parent)+len(extra))
	used := map[string]bool{}
	for k, v := range extra {
		out = append(out, k+"="+v)
		used[k] = true
	}
	for _, kv := range parent {
		// Skip if the renderer already overrode this key.
		eq := strings.IndexByte(kv, '=')
		if eq > 0 && used[kv[:eq]] {
			continue
		}
		out = append(out, kv)
	}
	return out
}

// toCoreLaunchOption translates the wire LaunchOptions into the core
// package's typed LaunchOption. Same shape as the legacy
// xmcl-runtime conversion.
func (s *Service) toCoreLaunchOption(options contract.LaunchOptions) (core.LaunchOption, error) {
	if options.Version == "" {
		return core.LaunchOption{}, errors.New("LaunchOptions: version required")
	}
	if options.GameDirectory == "" {
		return core.LaunchOption{}, errors.New("LaunchOptions: gameDirectory required")
	}
	if options.Java == "" {
		return core.LaunchOption{}, errors.New("LaunchOptions: java required")
	}

	opts := core.LaunchOption{
		Version:      options.Version,
		GamePath:     options.GameDirectory,
		ResourcePath: s.host.MinecraftDataPath,
		JavaPath:     options.Java,
		ExtraJVMArgs: options.VmOptions,
		ExtraMCArgs:  options.McOptions,
	}

	if options.MinMemory != nil {
		opts.MinMemory = int(*options.MinMemory)
	}
	if options.MaxMemory != nil {
		opts.MaxMemory = int(*options.MaxMemory)
	}
	if options.LauncherName != nil {
		opts.LauncherName = *options.LauncherName
	}
	if options.LauncherBrand != nil {
		opts.LauncherBrand = *options.LauncherBrand
	}
	if options.PrependCommand != nil {
		opts.PrependCommand = *options.PrependCommand
	}

	if options.Server != nil {
		host, _ := options.Server["host"].(string)
		port := 0
		if p, ok := options.Server["port"].(float64); ok {
			port = int(p)
		}
		if host != "" {
			opts.Server = &core.Server{IP: host, Port: port}
		}
	}
	if options.Resolution != nil {
		res := &core.Resolution{}
		if w, ok := options.Resolution["width"].(float64); ok {
			res.Width = int(w)
		}
		if h, ok := options.Resolution["height"].(float64); ok {
			res.Height = int(h)
		}
		if f, ok := options.Resolution["fullscreen"].(bool); ok {
			res.Fullscreen = f
		}
		opts.Resolution = res
	}
	if options.YggdrasilAgent != nil {
		jar, _ := options.YggdrasilAgent["jar"].(string)
		server, _ := options.YggdrasilAgent["server"].(string)
		prefetched, _ := options.YggdrasilAgent["prefetched"].(string)
		if jar != "" {
			opts.YggdrasilAgent = &core.YggdrasilAgent{
				Jar:        jar,
				Server:     server,
				Prefetched: prefetched,
			}
		}
	}
	if user, ok := options.User.(map[string]any); ok {
		profile := &core.GameProfile{}
		if v, ok := user["name"].(string); ok {
			profile.Name = v
		}
		if v, ok := user["id"].(string); ok {
			profile.ID = v
		}
		opts.GameProfile = profile
		if v, ok := user["accessToken"].(string); ok {
			opts.AccessToken = v
		}
	}

	return opts, nil
}
