// Package instanceserverinfo implements
// contract.InstanceServerInfoService.
//
// Reads `<instance>/servers.dat` (NBT, uncompressed) and exposes the
// list of `ServerInfo` rows the Servers tab renders. The
// `Link`/`Unlink`/`IsLinked` operations hard-link
// `<instance>/servers.dat` ↔ `<gameRoot>/servers.dat` so multiple
// instances can pool their server lists.
package instanceserverinfo

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/parsers/gamedata"
)

const serversDat = "servers.dat"

// Service implements contract.InstanceServerInfoService.
type Service struct {
	contract.InstanceServerInfoServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	mu      sync.Mutex
	watches map[string]*watch
}

type watch struct {
	state   *bridge.SharedState
	payload *payload
	once    sync.Once
}

// payload mirrors the renderer-side `ServerInfoState` shape: a single
// `serverInfos` array of `ServerInfoWithStatus` (the per-row `status`
// field defaults to UNKNOWN_STATUS in the renderer's wrapping class).
type payload struct {
	ServerInfos []serverInfoWithStatus `json:"serverInfos"`
}

type serverInfoWithStatus struct {
	gamedata.ServerInfo
	Status map[string]any `json:"status"`
}

// New constructs an InstanceServerInfoService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm, watches: map[string]*watch{}}
}

var _ contract.InstanceServerInfoService = (*Service)(nil)

// ============================================================
// Watch
// ============================================================

// Watch returns the live ServerInfoState SharedState. State id mirrors
// the TS reference: `instance-server-data://<instancePath>`.
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

func (s *Service) populateWatch(instancePath string, w *watch) error {
	w.payload = &payload{ServerInfos: s.scan(instancePath)}
	w.state = s.states.Register(bridge.StateOpts{
		ID:        stateIDFor(instancePath),
		StateName: "ServerInfoState",
		Payload:   w.payload,
		Mutators: map[string]bridge.Mutator{
			// Renderer-driven `instanceServerInfos` mutator: replace
			// the whole list. We just rebroadcast — the renderer's
			// reducer keeps the local copy in sync.
			"instanceServerInfos": func(raw any) {
				items, ok := raw.([]any)
				if !ok {
					return
				}
				out := make([]serverInfoWithStatus, 0, len(items))
				for _, x := range items {
					m, ok := x.(map[string]any)
					if !ok {
						continue
					}
					info := gamedata.ServerInfo{
						Icon:           toString(m["icon"]),
						IP:             toString(m["ip"]),
						Name:           toString(m["name"]),
						AcceptTextures: toInt(m["acceptTextures"]),
					}
					out = append(out, serverInfoWithStatus{ServerInfo: info})
				}
				w.payload.ServerInfos = out
				s.states.Push(stateIDFor(instancePath), "instanceServerInfos", out)
			},
		},
		// Drop the per-instance cache when the renderer drops its
		// last reference, so the next Watch re-registers a fresh
		// state instead of returning a dead handle.
		Dispose: func() { s.dropWatch(instancePath) },
	})
	return nil
}

func (s *Service) dropWatch(instancePath string) {
	s.mu.Lock()
	delete(s.watches, instancePath)
	s.mu.Unlock()
}

func (s *Service) scan(instancePath string) []serverInfoWithStatus {
	infos, err := gamedata.ReadServersDat(filepath.Join(instancePath, serversDat))
	if err != nil {
		s.host.Logger.Warn("instanceserverinfo: read servers.dat", "path", instancePath, "err", err)
		return []serverInfoWithStatus{}
	}
	out := make([]serverInfoWithStatus, len(infos))
	for i, info := range infos {
		out[i] = serverInfoWithStatus{ServerInfo: info}
	}
	return out
}

// ============================================================
// Link / Unlink / IsLinked
// ============================================================

// IsLinked reports whether the instance's `servers.dat` is the same
// inode as the global one.
func (s *Service) IsLinked(_ context.Context, instancePath string) (bool, error) {
	root := filepath.Join(s.host.MinecraftDataPath, serversDat)
	local := filepath.Join(instancePath, serversDat)
	rs, err := os.Stat(root)
	if err != nil {
		return false, nil
	}
	ls, err := os.Stat(local)
	if err != nil {
		return false, nil
	}
	return os.SameFile(rs, ls), nil
}

// Link hard-links the instance's `servers.dat` to the global one.
// When the global doesn't exist yet, the local copy is moved up.
func (s *Service) Link(_ context.Context, instancePath string) error {
	root := filepath.Join(s.host.MinecraftDataPath, serversDat)
	local := filepath.Join(instancePath, serversDat)

	if _, err := os.Stat(root); err != nil {
		if os.IsNotExist(err) {
			if err := os.MkdirAll(filepath.Dir(root), 0o755); err != nil {
				return err
			}
			if _, err := os.Stat(local); err == nil {
				if err := os.Rename(local, root); err != nil {
					return err
				}
			} else {
				// Create an empty servers.dat so the link target exists.
				if err := os.WriteFile(root, []byte{}, 0o644); err != nil {
					return err
				}
			}
		} else {
			return err
		}
	}
	// Replace any local file with a hard link.
	if _, err := os.Stat(local); err == nil {
		if err := os.Remove(local); err != nil {
			return err
		}
	}
	return os.Link(root, local)
}

// Unlink removes the local hard link (the global file is preserved).
func (s *Service) Unlink(_ context.Context, instancePath string) error {
	local := filepath.Join(instancePath, serversDat)
	if _, err := os.Stat(local); err != nil {
		return nil
	}
	return os.Remove(local)
}

// ============================================================
// Helpers
// ============================================================

func stateIDFor(instancePath string) string {
	return "instance-server-data://" + instancePath
}

func toString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func toInt(v any) int {
	switch n := v.(type) {
	case int:
		return n
	case int32:
		return int(n)
	case int64:
		return int(n)
	case float64:
		return int(n)
	case float32:
		return int(n)
	}
	return 0
}
