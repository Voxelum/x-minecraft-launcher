package instanceoptions

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

func newTestService(t *testing.T) (*Service, string) {
	t.Helper()
	dir := t.TempDir()
	h := &host.Host{
		AppDataPath: filepath.Join(dir, "appdata"),
		Logger:      slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError + 1})),
		Mutex:       host.NewMutexManager(),
	}
	return New(h, nil), dir
}

func TestGetGameOptionsMissingFile(t *testing.T) {
	s, _ := newTestService(t)
	got, err := s.GetGameOptions(context.Background(), t.TempDir())
	if err != nil {
		t.Fatalf("GetGameOptions: %v", err)
	}
	m, ok := got.(map[string]any)
	if !ok || len(m) != 0 {
		t.Errorf("expected empty map, got %T %v", got, got)
	}
}

func TestEditGameSettingPersists(t *testing.T) {
	s, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")
	if err := os.MkdirAll(inst, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	err := s.EditGameSetting(context.Background(), contract.EditGameSettingOptions{
		InstancePath: inst,
		Extra: map[string]any{
			"fov":            float64(70),
			"renderDistance": float64(16),
			"lang":           "en-US",
		},
	})
	if err != nil {
		t.Fatalf("EditGameSetting: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(inst, "options.txt"))
	if err != nil {
		t.Fatalf("read options.txt: %v", err)
	}
	body := string(data)
	if !strings.Contains(body, "fov:70") {
		t.Errorf("fov missing in %q", body)
	}
	if !strings.Contains(body, "renderDistance:16") {
		t.Errorf("renderDistance missing in %q", body)
	}
	// `lang` should be canonicalised to lower_case with underscores.
	if !strings.Contains(body, "lang:en_us") {
		t.Errorf("lang not canonicalised in %q", body)
	}
}

func TestEditGameSettingMerges(t *testing.T) {
	s, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")
	if err := os.MkdirAll(inst, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	// Pre-seed an options.txt with a value that should be preserved.
	original := "fov:60\nguiScale:2\n"
	if err := os.WriteFile(filepath.Join(inst, "options.txt"), []byte(original), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	err := s.EditGameSetting(context.Background(), contract.EditGameSettingOptions{
		InstancePath: inst,
		Extra: map[string]any{
			"fov": float64(90),
		},
	})
	if err != nil {
		t.Fatalf("EditGameSetting: %v", err)
	}
	data, _ := os.ReadFile(filepath.Join(inst, "options.txt"))
	body := string(data)
	if !strings.Contains(body, "fov:90") {
		t.Errorf("fov not updated: %q", body)
	}
	if !strings.Contains(body, "guiScale:2") {
		t.Errorf("guiScale lost on merge: %q", body)
	}
}

func TestEULA(t *testing.T) {
	s, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")

	got, _ := s.GetEULA(context.Background(), inst)
	if got != false {
		t.Errorf("default EULA = %v, want false", got)
	}

	if err := s.SetEULA(context.Background(), inst, true); err != nil {
		t.Fatalf("SetEULA: %v", err)
	}
	got, _ = s.GetEULA(context.Background(), inst)
	if got != true {
		t.Errorf("after SetEULA(true) = %v", got)
	}

	if err := s.SetEULA(context.Background(), inst, false); err != nil {
		t.Fatalf("SetEULA false: %v", err)
	}
	got, _ = s.GetEULA(context.Background(), inst)
	if got != false {
		t.Errorf("after SetEULA(false) = %v", got)
	}
}

func TestServerProperties(t *testing.T) {
	s, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")

	props, err := s.GetServerProperties(context.Background(), inst)
	if err != nil {
		t.Fatalf("GetServerProperties: %v", err)
	}
	if len(props) != 0 {
		t.Errorf("expected empty map, got %v", props)
	}

	err = s.SetServerProperties(context.Background(), inst, map[string]any{
		"motd":            "Hello",
		"max-players":     20,
		"server-port":     25565,
		"online-mode":     true,
	})
	if err != nil {
		t.Fatalf("SetServerProperties: %v", err)
	}
	props, _ = s.GetServerProperties(context.Background(), inst)
	if props["motd"] != "Hello" {
		t.Errorf("motd = %q", props["motd"])
	}
	if props["max-players"] != "20" {
		t.Errorf("max-players = %q", props["max-players"])
	}
	if props["online-mode"] != "true" {
		t.Errorf("online-mode = %q", props["online-mode"])
	}
}
