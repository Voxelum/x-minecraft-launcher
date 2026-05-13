package instancemodsgroup

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

func newTestService(t *testing.T) (*Service, string) {
	t.Helper()
	dir := t.TempDir()
	h := &host.Host{
		AppDataPath:       filepath.Join(dir, "appdata"),
		MinecraftDataPath: filepath.Join(dir, "mc"),
		Logger:            slog.New(slog.NewTextHandler(io.Discard, nil)),
		Mutex:             host.NewMutexManager(),
	}
	if err := os.MkdirAll(h.AppDataPath, 0o755); err != nil {
		t.Fatalf("mkdir appdata: %v", err)
	}
	b := bridge.New(h)
	s := New(h, b.States())
	return s, dir
}

func TestGetGroupStateMissingFile(t *testing.T) {
	s, _ := newTestService(t)
	dir := t.TempDir()
	state, err := s.GetGroupState(context.Background(), dir)
	if err != nil {
		t.Fatalf("GetGroupState: %v", err)
	}
	if state == nil {
		t.Fatal("nil SharedState")
	}
	w := s.getWatch(dir)
	if got := w.payload.Groups; len(got) != 0 {
		t.Fatalf("expected empty groups, got %v", got)
	}
}

func TestGetGroupStateLoadsFromDisk(t *testing.T) {
	s, _ := newTestService(t)
	dir := t.TempDir()
	contents := map[string]contract.ModGroupData{
		"perf": {Color: "#abc", Files: []string{"a.jar", "b.jar"}},
	}
	raw, _ := json.Marshal(contents)
	if err := os.WriteFile(filepath.Join(dir, groupsFile), raw, 0o644); err != nil {
		t.Fatalf("seed groups file: %v", err)
	}
	if _, err := s.GetGroupState(context.Background(), dir); err != nil {
		t.Fatalf("GetGroupState: %v", err)
	}
	got := s.getWatch(dir).payload.Groups
	if len(got) != 1 || got["perf"].Color != "#abc" || len(got["perf"].Files) != 2 {
		t.Fatalf("payload not loaded from disk: %+v", got)
	}
}

func TestUpdateModsGroupsWritesAndPropagates(t *testing.T) {
	s, _ := newTestService(t)
	dir := t.TempDir()

	groups := map[string]contract.ModGroupData{
		"a": {Color: "#111", Files: []string{"x.jar"}},
		"b": {Color: "#222", Files: []string{"y.jar", "z.jar"}},
	}
	if err := s.UpdateModsGroups(context.Background(), dir, groups); err != nil {
		t.Fatalf("UpdateModsGroups: %v", err)
	}

	// On-disk content matches.
	data, err := os.ReadFile(filepath.Join(dir, groupsFile))
	if err != nil {
		t.Fatalf("read groups file: %v", err)
	}
	var disk map[string]contract.ModGroupData
	if err := json.Unmarshal(data, &disk); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !groupsEqual(disk, groups) {
		t.Fatalf("disk %+v != input %+v", disk, groups)
	}

	// Live payload reflects the update.
	got := s.getWatch(dir).payload.Groups
	if !groupsEqual(got, groups) {
		t.Fatalf("payload %+v != input %+v", got, groups)
	}
}

func TestSharedGroupRulesRoundTrip(t *testing.T) {
	s, _ := newTestService(t)
	ctx := context.Background()

	// Empty file → empty rules (Extra map present).
	rules, err := s.GetSharedGroupRules(ctx)
	if err != nil {
		t.Fatalf("GetSharedGroupRules: %v", err)
	}
	if rules.Extra == nil {
		t.Fatal("Extra map should be initialised")
	}
	if len(rules.Extra) != 0 {
		t.Fatalf("expected empty rules, got %v", rules.Extra)
	}

	// Update + read-back.
	mapping := contract.ModGroupRules{Extra: map[string]any{
		"perf":  []any{"sodium", "lithium"},
		"qol":   []any{"jei"},
		"empty": []any{},
	}}
	if err := s.UpdateSharedGroupRules(ctx, mapping); err != nil {
		t.Fatalf("UpdateSharedGroupRules: %v", err)
	}
	rules, err = s.GetSharedGroupRules(ctx)
	if err != nil {
		t.Fatalf("GetSharedGroupRules: %v", err)
	}
	if got, _ := toStringSlice(rules.Extra["perf"]); !sliceEqual(got, []string{"sodium", "lithium"}) {
		t.Fatalf("perf rule mismatch: %v", got)
	}
	if got, _ := toStringSlice(rules.Extra["qol"]); !sliceEqual(got, []string{"jei"}) {
		t.Fatalf("qol rule mismatch: %v", got)
	}
}

func TestSharedGroupRulesNewWins(t *testing.T) {
	s, _ := newTestService(t)
	ctx := context.Background()

	// Seed disk with old rules: jei in `qol`, sodium in `perf-old`.
	original := map[string][]string{
		"qol":      {"jei"},
		"perf-old": {"sodium"},
	}
	raw, _ := json.MarshalIndent(original, "", "  ")
	if err := os.WriteFile(filepath.Join(s.host.AppDataPath, rulesFile), raw, 0o644); err != nil {
		t.Fatalf("seed: %v", err)
	}

	// New mapping moves sodium to `perf` and adds lithium.
	mapping := contract.ModGroupRules{Extra: map[string]any{
		"perf": []any{"sodium", "lithium"},
	}}
	if err := s.UpdateSharedGroupRules(ctx, mapping); err != nil {
		t.Fatalf("UpdateSharedGroupRules: %v", err)
	}
	rules, _ := s.GetSharedGroupRules(ctx)

	perf, _ := toStringSlice(rules.Extra["perf"])
	if !sliceEqual(perf, []string{"sodium", "lithium"}) {
		t.Fatalf("perf: %v", perf)
	}
	// `perf-old` was carrying `sodium` which the new rules already
	// re-assigned to `perf`; it should be dropped from `perf-old`.
	if oldPerf, _ := toStringSlice(rules.Extra["perf-old"]); len(oldPerf) != 0 {
		t.Fatalf("perf-old should be empty after sodium migration, got %v", oldPerf)
	}
	// `qol` had no conflict; jei stays.
	if qol, _ := toStringSlice(rules.Extra["qol"]); !sliceEqual(qol, []string{"jei"}) {
		t.Fatalf("qol: %v", qol)
	}
}

func sliceEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
