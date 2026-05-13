package host

import (
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/network"
)

const launcherDirName = "xmcl"

// Host bundles environment, paths, and shared singletons used by every
// Go service. Constructed once at startup and passed by pointer to each
// service via `services.RegisterAll`.
//
// Path semantics (mirrors xmcl-runtime/app/LauncherApp.ts):
//
//   - AppDataPath:       OS-default config dir (`%APPDATA%/xmcl` /
//                        `~/Library/Application Support/xmcl` /
//                        `~/.config/xmcl`). Holds settings, logs,
//                        secrets, the SQLite db, and the `root`
//                        pointer file.
//
//   - MinecraftDataPath: the user's chosen game-data root, read from
//                        `<AppDataPath>/root`. Holds `instances/`,
//                        `versions/`, `libraries/`, `assets/`, …
//                        Falls back to AppDataPath when no root file
//                        is set, matching the Electron app's
//                        first-launch handling.
type Host struct {
	AppDataPath       string
	MinecraftDataPath string
	OS                string
	Arch              string
	Build             int
	Version           string

	Logger   *slog.Logger
	Mutex    *MutexManager
	Secrets  SecretStorage
	SQLite   *SQLite
	Registry *Registry
	HTTP     *network.Client

	// CurseforgeAPIKey is the `x-api-key` value injected on every
	// `api.curseforge.com` request. Loaded at startup from the
	// process env or a discovered `.env` file (see dotenv.go).
	// Mirrors the Electron build's esbuild `define`-substitution of
	// `process.env.CURSEFORGE_API_KEY` plus the main-process
	// `protocol.handle('https')` header decoration.
	CurseforgeAPIKey string

	// settingsProvider is set by the BaseService once its settings
	// store is online. Installers / metadata fetchers consult
	// `Host.Mirror()` to honour the user's `apiSetsPreference` (e.g.
	// BMCL). Until the provider is wired we fall back to the GFW
	// heuristic + the BMCL default in `network.NewMirrorPreference`.
	settingsProviderMu sync.RWMutex
	settingsProvider   SettingsProvider
}

// SettingsProvider exposes the renderer's api-set preference to the
// installer / metadata layer. BaseService implements this on top of
// its persisted Settings store; tests can plug in a stub.
type SettingsProvider interface {
	APISet() (preference string, sets []network.APISet)
}

// New constructs the runtime host using OS-default paths and wires up
// every shared singleton. Currently never returns an error; the
// signature reserves room for future bootstrap I/O (e.g. probing for a
// data-root override on the CLI).
func New() *Host {
	appData, _ := os.UserConfigDir()
	appDataPath := filepath.Join(appData, launcherDirName)

	logger := NewLogger(appDataPath, LogConfig{Stderr: true})

	gameDataPath := resolveGameDataPath(appDataPath, logger)

	h := &Host{
		AppDataPath:       appDataPath,
		MinecraftDataPath: gameDataPath,
		OS:                normalizedOS(),
		Arch:              runtime.GOARCH,
		Build:             0,
		Version:           "0.0.0-wails-dev",

		Logger:   logger,
		Mutex:    NewMutexManager(),
		Secrets:  NewSecretStorage(),
		SQLite:   NewSQLite(appDataPath),
		Registry: NewRegistry(),
		HTTP:     network.New(network.Options{}),

		CurseforgeAPIKey: loadDotEnvFor("CURSEFORGE_API_KEY", logger),
	}
	return h
}

// DesktopDir returns the user's Desktop directory, or empty string on error.
func (h *Host) DesktopDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, "Desktop")
}

// SetSettingsProvider registers the renderer-driven settings reader.
// Called by BaseService once its store is online.
func (h *Host) SetSettingsProvider(p SettingsProvider) {
	h.settingsProviderMu.Lock()
	defer h.settingsProviderMu.Unlock()
	h.settingsProvider = p
}

// Mirror returns the resolved MirrorPreference. Always safe to call;
// when the provider hasn't been wired yet we fall back to the BMCL
// default + the GFW heuristic so a fresh launcher install hitting an
// install before the renderer is up still gets sensible behaviour.
func (h *Host) Mirror() network.MirrorPreference {
	h.settingsProviderMu.RLock()
	p := h.settingsProvider
	h.settingsProviderMu.RUnlock()
	if p == nil {
		return network.NewMirrorPreference("", nil, network.IsLikelyChinaUser())
	}
	pref, sets := p.APISet()
	return network.NewMirrorPreference(pref, sets, network.IsLikelyChinaUser())
}

// Close releases every shared resource. Call once on shutdown.
func (h *Host) Close() error {
	if h.SQLite != nil {
		return h.SQLite.Close()
	}
	return nil
}

// resolveGameDataPath mirrors LauncherApp.boot()'s root resolution:
// read `<appDataPath>/root` (a single-line text file containing the
// chosen game-data directory). On any error, fall back to appDataPath
// so a fresh install still has a usable root.
func resolveGameDataPath(appDataPath string, logger *slog.Logger) string {
	rootFile := filepath.Join(appDataPath, "root")
	raw, err := os.ReadFile(rootFile)
	if err != nil {
		if !os.IsNotExist(err) && logger != nil {
			logger.Warn("host: read root pointer", "path", rootFile, "err", err)
		}
		return appDataPath
	}
	candidate := strings.TrimSpace(string(raw))
	if candidate == "" {
		return appDataPath
	}
	if info, err := os.Stat(candidate); err != nil || !info.IsDir() {
		if logger != nil {
			logger.Warn("host: root pointer target invalid, falling back",
				"root", candidate, "err", err)
		}
		return appDataPath
	}
	if logger != nil {
		logger.Info("host: using game data root", "path", candidate)
	}
	return candidate
}

func normalizedOS() string {
	switch runtime.GOOS {
	case "windows":
		return "windows"
	case "darwin":
		return "osx"
	default:
		return "linux"
	}
}
