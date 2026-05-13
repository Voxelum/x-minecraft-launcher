package instancemods

import (
	"encoding/json"
	"os"
)

// jsonMarshal / jsonUnmarshal: thin wrappers so the call sites in
// the main package read self-explanatorily without dragging
// `encoding/json` into every import block.
func jsonMarshal(v any) ([]byte, error)        { return json.Marshal(v) }
func jsonUnmarshal(data []byte, v any) error   { return json.Unmarshal(data, v) }

// fileStat carries the platform-stable timestamps we surface on
// `Resource`. Some fields (atime, ctime, ino) aren't portable across
// Windows / Unix — we fall back to mtime for missing ones so the
// renderer never receives zero values it might misinterpret as "set
// to epoch".
type fileStat struct {
	mtime float64
	atime float64
	ctime float64
	ino   float64
}

// osStat fills a fileStat from `os.FileInfo`. Only `mtime` is
// guaranteed by the cross-platform interface; we use it for the
// remaining fields as a sensible fallback. Platform-specific stat
// extractors (via `syscall.Stat_t` on Unix / `Sys()` on Windows) can
// be layered in later if a renderer feature needs accurate ctime/ino.
func osStat(info os.FileInfo) fileStat {
	mt := float64(info.ModTime().UnixMilli())
	return fileStat{mtime: mt, atime: mt, ctime: mt, ino: 0}
}
