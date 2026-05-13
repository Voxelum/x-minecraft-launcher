package gamedata

import (
	"path/filepath"
	"testing"
)

func mockRoot(t *testing.T) string {
	t.Helper()
	// Repo layout: <repo>/xmcl-wails-app/internal/parsers/gamedata/
	// Fixtures live at: <repo>/mock/...
	return filepath.Join("..", "..", "..", "..", "mock")
}

func TestReadLevelDat(t *testing.T) {
	dir := filepath.Join(mockRoot(t), "saves", "sample-map")
	meta, err := ReadLevelDat(dir)
	if err != nil {
		t.Fatalf("ReadLevelDat: %v", err)
	}
	if meta.LevelName == "" {
		t.Fatalf("LevelName empty: %+v", meta)
	}
	t.Logf("level.dat: name=%q version=%q mode=%d difficulty=%d seed=%q",
		meta.LevelName, meta.GameVersion, meta.Mode, meta.Difficulty, meta.Seed)
}

func TestReadServersDat(t *testing.T) {
	infos, err := ReadServersDat(filepath.Join(mockRoot(t), "servers.dat"))
	if err != nil {
		t.Fatalf("ReadServersDat: %v", err)
	}
	if len(infos) == 0 {
		t.Skip("fixture has no servers; treat as smoke check")
	}
	for i, s := range infos {
		t.Logf("server #%d: name=%q ip=%q acceptTextures=%d", i, s.Name, s.IP, s.AcceptTextures)
		if s.IP == "" {
			t.Errorf("entry %d missing ip", i)
		}
	}
}
