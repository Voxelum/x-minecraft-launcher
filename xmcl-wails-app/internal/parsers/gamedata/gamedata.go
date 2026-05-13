// Package gamedata parses Minecraft world / server data files.
//
// Surface (narrow on purpose — only what InstanceSavesService /
// InstanceServerInfoService need):
//
//   - ReadLevelDat(path)  → SaveMetadata (level name, seed,
//     difficulty, last-played, version, time,
//     game-mode).
//   - ReadServersDat(p)   → []ServerInfo from servers.dat.
//   - WriteServersDat     → roundtrip-safe writer.
//
// All NBT IO goes through `internal/parsers/nbt`.
package gamedata

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/voxelum/xmcl/wails/internal/parsers/nbt"
)

// ============================================================
// level.dat
// ============================================================

// SaveMetadata mirrors the renderer-facing `SaveMetadata` shape.
type SaveMetadata struct {
	LevelName    string
	Mode         int
	Cheat        bool
	GameVersion  string
	Difficulty   int
	Time         int64
	LastPlayed   int64
	Advancements int
	Seed         string
}

// ReadLevelDat opens `<saveDir>/level.dat`, decodes the top-level
// `Data` compound, and projects out the renderer-relevant fields.
// Returns os.ErrNotExist when the file isn't present.
func ReadLevelDat(saveDir string) (*SaveMetadata, error) {
	raw, err := os.ReadFile(filepath.Join(saveDir, "level.dat"))
	if err != nil {
		return nil, err
	}
	root, err := nbt.Read(raw, nbt.Gzip)
	if err != nil {
		// Some launchers ship raw level.dat (no gzip); try once more.
		var err2 error
		root, err2 = nbt.Read(raw, nbt.None)
		if err2 != nil {
			return nil, fmt.Errorf("gamedata: parse level.dat: %w", err)
		}
	}
	data, _ := root["Data"].(map[string]any)
	if data == nil {
		// Some newer Mojang formats put fields at the root.
		data = root
	}

	m := &SaveMetadata{}
	m.LevelName = stringOf(data["LevelName"])
	m.Mode = intOf(data["GameType"])
	m.Cheat = boolOf(data["allowCommands"])
	m.Difficulty = intOf(data["Difficulty"])
	m.Time = int64Of(data["Time"])
	m.LastPlayed = int64Of(data["LastPlayed"])

	if version, ok := data["Version"].(map[string]any); ok {
		m.GameVersion = stringOf(version["Name"])
	}
	if seed := int64Of(data["RandomSeed"]); seed != 0 {
		m.Seed = fmt.Sprintf("%d", seed)
	} else if wgs, ok := data["WorldGenSettings"].(map[string]any); ok {
		if seed := int64Of(wgs["seed"]); seed != 0 {
			m.Seed = fmt.Sprintf("%d", seed)
		}
	}

	// Advancements: count *.json files in `advancements/`. Fast,
	// avoids the large advancements NBT walk the TS reference does.
	if entries, err := os.ReadDir(filepath.Join(saveDir, "advancements")); err == nil {
		for _, e := range entries {
			if !e.IsDir() && filepath.Ext(e.Name()) == ".json" {
				m.Advancements++
			}
		}
	}
	return m, nil
}

// ============================================================
// servers.dat
// ============================================================

// ServerInfo mirrors the on-wire `ServerInfo` shape the renderer
// expects in `ServerInfoState.serverInfos`.
type ServerInfo struct {
	Icon           string `json:"icon"`
	IP             string `json:"ip"`
	Name           string `json:"name"`
	AcceptTextures int    `json:"acceptTextures"`
}

// ReadServersDat decodes `<dir>/servers.dat`. Returns nil + nil on
// missing file.
func ReadServersDat(path string) ([]ServerInfo, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	// `servers.dat` is uncompressed in vanilla.
	root, err := nbt.Read(raw, nbt.None)
	if err != nil {
		// Try gzip just in case (some third-party tools recompress).
		var err2 error
		root, err2 = nbt.Read(raw, nbt.Gzip)
		if err2 != nil {
			return nil, fmt.Errorf("gamedata: parse servers.dat: %w", err)
		}
	}
	servers, _ := root["servers"].(*nbt.List)
	if servers == nil {
		return []ServerInfo{}, nil
	}
	out := make([]ServerInfo, 0, len(servers.Items))
	for _, item := range servers.Items {
		entry, ok := item.(map[string]any)
		if !ok {
			continue
		}
		out = append(out, ServerInfo{
			Icon:           stringOf(entry["icon"]),
			IP:             stringOf(entry["ip"]),
			Name:           stringOf(entry["name"]),
			AcceptTextures: intOf(entry["acceptTextures"]),
		})
	}
	return out, nil
}

// WriteServersDat re-serialises a `[]ServerInfo` back into the NBT
// shape `vanilla` expects.
func WriteServersDat(path string, servers []ServerInfo) error {
	items := make([]any, 0, len(servers))
	for _, s := range servers {
		items = append(items, map[string]any{
			"icon":           s.Icon,
			"ip":             s.IP,
			"name":           s.Name,
			"acceptTextures": int8(s.AcceptTextures),
		})
	}
	root := map[string]any{
		"servers": nbt.NewList(nbt.TagCompound, items),
	}
	body, err := nbt.Write(root, nbt.None, "")
	if err != nil {
		return err
	}
	return os.WriteFile(path, body, 0o644)
}

// ============================================================
// Coercion helpers — NBT values come through as Go's native types
// (int8, int16, int32, int64, float32, float64, string, bool) but
// the field we care about may have been stored as any of them.
// ============================================================

func stringOf(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func intOf(v any) int {
	switch n := v.(type) {
	case int8:
		return int(n)
	case int16:
		return int(n)
	case int32:
		return int(n)
	case int64:
		return int(n)
	case int:
		return n
	case float32:
		return int(n)
	case float64:
		return int(n)
	}
	return 0
}

func int64Of(v any) int64 {
	switch n := v.(type) {
	case int8:
		return int64(n)
	case int16:
		return int64(n)
	case int32:
		return int64(n)
	case int64:
		return n
	case int:
		return int64(n)
	case float32:
		return int64(n)
	case float64:
		return int64(n)
	}
	return 0
}

func boolOf(v any) bool {
	switch n := v.(type) {
	case bool:
		return n
	case int8:
		return n != 0
	case int16:
		return n != 0
	case int32:
		return n != 0
	case int64:
		return n != 0
	}
	return false
}
