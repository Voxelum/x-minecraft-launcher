// Package serverstatus implements contract.ServerStatusService.
//
// PingServer wraps `internal/mcping` (modern Notchian Server List
// Ping). Failures are translated into the renderer-recognised
// "failure status" shape so the UI can show a typed error instead
// of crashing.
package serverstatus

import (
	"context"
	"errors"
	"net"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/mcping"
)

// Service implements contract.ServerStatusService.
type Service struct {
	contract.ServerStatusServiceNotImplemented

	host *host.Host
}

// New constructs a ServerStatusService.
func New(h *host.Host, _ *bridge.StateManager) *Service {
	return &Service{host: h}
}

var _ contract.ServerStatusService = (*Service)(nil)

// PingServer pings the requested host and returns the decoded status.
// Errors are mapped onto the failure-status shape the renderer's
// `serverStatus.timeout` / `.nohost` / `.refuse` keys read.
func (s *Service) PingServer(ctx context.Context, options contract.PingServerOptions) (contract.Status, error) {
	if options.Host == "" {
		return failure("serverStatus.nohost"), errors.New("PingServer: host required")
	}
	port := 25565
	if options.Port != nil {
		port = int(*options.Port)
	}
	protocol := 47
	if options.Protocol != nil {
		protocol = int(*options.Protocol)
	}
	st, err := mcping.Ping(ctx, mcping.Options{
		Host:     options.Host,
		Port:     port,
		Protocol: protocol,
	})
	if err != nil {
		s.host.Logger.Warn("PingServer", "host", options.Host, "port", port, "err", err)
		return classify(err), nil
	}
	return contract.Status{
		Version:     st.Version,
		Players:     st.Players,
		Description: st.Description,
		Favicon:     st.Favicon,
		Modinfo:     st.Modinfo,
		Ping:        st.Ping,
	}, nil
}

// classify produces a renderer-recognised failure status for the
// supplied error. The renderer's i18n table reads `version.name` for
// the failure label.
func classify(err error) contract.Status {
	switch {
	case isTimeout(err):
		return failure("serverStatus.timeout")
	case isNoHost(err):
		return failure("serverStatus.nohost")
	case isRefused(err):
		return failure("serverStatus.refuse")
	}
	return failure("serverStatus.refuse")
}

func failure(label string) contract.Status {
	return contract.Status{
		Version: map[string]any{"name": label, "protocol": -1},
		Players: map[string]any{"online": -1, "max": -1},
		Description: map[string]any{
			"translate": label,
		},
		Ping: -1,
	}
}

func isTimeout(err error) bool {
	var netErr net.Error
	if errors.As(err, &netErr) {
		return netErr.Timeout()
	}
	return strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "deadline")
}

func isNoHost(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "no such host") || strings.Contains(msg, "lookup")
}

func isRefused(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "refused") || strings.Contains(msg, "reset")
}
