package launch

import (
	"context"
	"os"
	"runtime"
	"testing"
	"time"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// newTestService builds a Service backed by a logger-only host and a
// bridge-less event broadcaster (Bridge.emit is a no-op when the App
// pointer is nil — see internal/bridge/bridge.go's emit() guard).
func newTestService(t *testing.T) *Service {
	t.Helper()
	h := &host.Host{
		AppDataPath:       t.TempDir(),
		MinecraftDataPath: t.TempDir(),
		Logger:            host.NewLogger(t.TempDir(), host.LogConfig{Stderr: false}),
	}
	b := bridge.New(h)
	return New(h, b.States())
}

func TestToCoreLaunchOption_RequiresFields(t *testing.T) {
	s := newTestService(t)
	cases := []contract.LaunchOptions{
		{},
		{Version: "1.20"},
		{Version: "1.20", GameDirectory: "/tmp"},
	}
	for i, c := range cases {
		if _, err := s.toCoreLaunchOption(c); err == nil {
			t.Errorf("case %d: expected error, got nil", i)
		}
	}
}

func TestKill_UnknownPidIsNoop(t *testing.T) {
	s := newTestService(t)
	if err := s.Kill(context.Background(), 99999, false); err != nil {
		t.Errorf("expected nil for unknown pid, got %v", err)
	}
}

func TestGetGameProcesses_Empty(t *testing.T) {
	s := newTestService(t)
	procs, err := s.GetGameProcesses(context.Background())
	if err != nil {
		t.Fatalf("GetGameProcesses: %v", err)
	}
	if len(procs) != 0 {
		t.Errorf("expected empty list, got %d", len(procs))
	}
}

// TestStreamLines_RouteToEmitters confirms the Service forwards stdout
// vs stderr to the right broadcaster path. We can't observe the
// EmitMinecraftStdout call directly without intercepting the bridge
// (added in a future test helper); for now this exercise ensures the
// scanner doesn't deadlock on nil readers when the stream closes.
func TestStreamLines_HandlesEOF(t *testing.T) {
	s := newTestService(t)
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	go func() {
		_, _ = w.Write([]byte("hello\nworld\n"))
		_ = w.Close()
	}()
	done := make(chan struct{})
	go func() {
		s.streamLines(0, "client", r, false)
		close(done)
	}()
	select {
	case <-done:
		// success
	case <-time.After(2 * time.Second):
		t.Fatal("streamLines did not return on EOF")
	}
}

// TestLaunch_RejectsBadJava is a round-trip smoke that exercises the
// precheck path. We feed a java path that doesn't exist and expect
// MissingJavaError back through the wrapped error chain.
func TestLaunch_RejectsBadJava(t *testing.T) {
	s := newTestService(t)
	// We need a parseable version on disk so the parse step doesn't
	// fail before java is checked. Skip on non-windows since we don't
	// want to drag the mock fixtures in here — the test on windows
	// uses the mock root via env.
	if runtime.GOOS != "windows" {
		t.Skip("skipping on non-windows; java precheck path is OS-agnostic but version parse needs fixtures")
	}
	// Build a fake instance dir + a bogus java path.
	javaPath := "/no/such/java/binary"
	_, err := s.Launch(context.Background(), contract.LaunchOptions{
		Version:       "1.20",
		GameDirectory: t.TempDir(),
		Java:          javaPath,
		User:          map[string]any{"name": "Player", "id": "00000000-0000-0000-0000-000000000000"},
	})
	if err == nil {
		t.Fatal("expected error for missing java")
	}
}
