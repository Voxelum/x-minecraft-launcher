package host

import (
	"io"
	"log/slog"
	"os"
	"path/filepath"

	"gopkg.in/natefinch/lumberjack.v2"
)

// LogConfig controls log destinations.
type LogConfig struct {
	// Dir is the directory holding the rotating log files. Defaults to
	// `<AppDataPath>/logs`.
	Dir string
	// MaxSizeMB rotates the active file once it grows past this size.
	MaxSizeMB int
	// MaxBackups caps how many compressed older files we keep around.
	MaxBackups int
	// MaxAgeDays caps the age of older files.
	MaxAgeDays int
	// Stderr also tees writes to os.Stderr when true (the default).
	Stderr bool
	// Level is the minimum slog level. Defaults to slog.LevelInfo.
	Level slog.Level
}

// NewLogger constructs an slog.Logger that writes to a rotating file
// under the host's app-data dir and (optionally) tees to stderr. The
// returned logger is wired up by Host.New().
func NewLogger(appDataPath string, cfg LogConfig) *slog.Logger {
	dir := cfg.Dir
	if dir == "" {
		dir = filepath.Join(appDataPath, "logs")
	}
	_ = os.MkdirAll(dir, 0o755)

	var w io.Writer = &lumberjack.Logger{
		Filename:   filepath.Join(dir, "xmcl.log"),
		MaxSize:    coalesceInt(cfg.MaxSizeMB, 10),
		MaxBackups: coalesceInt(cfg.MaxBackups, 5),
		MaxAge:     coalesceInt(cfg.MaxAgeDays, 30),
		Compress:   true,
	}
	if cfg.Stderr {
		w = io.MultiWriter(w, os.Stderr)
	}
	return slog.New(slog.NewTextHandler(w, &slog.HandlerOptions{Level: cfg.Level}))
}

func coalesceInt(v, fallback int) int {
	if v <= 0 {
		return fallback
	}
	return v
}
