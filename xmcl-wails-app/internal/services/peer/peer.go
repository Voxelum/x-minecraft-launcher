// Package peer implements contract.PeerService.
package peer

import (
	"context"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

const stateID = "PeerService"

// Service implements contract.PeerService.
type Service struct {
	contract.PeerServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	once  sync.Once
	state *bridge.SharedState
}

// New constructs a PeerService bound to the given host & state manager.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm}
}

var _ contract.PeerService = (*Service)(nil)

// GetPeerState returns the live PeerState SharedState. G3 ships an
// empty peer registry; the WebRTC engine + signaling lands in G7
// (renderer-side) and G11 (Go pion port).
func (s *Service) GetPeerState(_ context.Context) (*bridge.SharedState, error) {
	s.once.Do(func() {
		s.state = contract.RegisterPeerState(s.states, stateID, &contract.PeerState{
			Connections:     []any{},
			ValidIceServers: []string{},
			IcsServersPings: map[string]any{},
			Ips:             []string{},
			Turnservers:     map[string]any{},
			Group:           "",
			GroupState:      "",
			NatType:         "unknown",
			ExposedPorts:    [][]any{},
		})
	})
	return s.state, nil
}

// Compile-time assertion that we implement the generated contract.
var _ contract.PeerService = (*Service)(nil)
