// Package base implements contract.BaseService — the launcher-wide
// info service the renderer always queries first (env, settings,
// network status). G3 wires real settings persistence; the remaining
// methods still defer to the embedded NotImplemented stub.
package base

import (
	"context"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/network"
)

// Service implements contract.BaseService. Methods we haven't ported
// yet inherit "not implemented" behaviour from the embedded stub.
type Service struct {
	contract.BaseServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	settingsOnce sync.Once
	settings     *host.SettingsStore[contract.Settings]
}

// New constructs a BaseService bound to the given host & state manager.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm}
}

// Compile-time assertion that we implement the generated contract.
var _ contract.BaseService = (*Service)(nil)

// ============================================================
// Implemented methods
// ============================================================

func (s *Service) GetEnvironment(_ context.Context) (contract.Environment, error) {
	return contract.Environment{
		Os:        s.host.OS,
		OsRelease: "",
		Arch:      s.host.Arch,
		Env:       "wails",
		Version:   s.host.Version,
		Build:     float64(s.host.Build),
		Region:    "",
		Gfw:       network.IsLikelyChinaUser(),
		Gpu:       true,
	}, nil
}

func (s *Service) GetSettings(_ context.Context) (*bridge.SharedState, error) {
	store := s.ensureSettingsStore()
	state := contract.RegisterSettings(s.states, "settings", store.Get())
	return state, nil
}

func (s *Service) GetNetworkStatus(_ context.Context) (contract.NetworkStatus, error) {
	if s.host == nil || s.host.HTTP == nil {
		return contract.NetworkStatus{Pools: map[string]contract.PoolStats{}}, nil
	}
	stats := s.host.HTTP.Stats()
	pools := make(map[string]contract.PoolStats, len(stats.Pools))
	for host, p := range stats.Pools {
		// The TS PoolStats was modelled on undici.Agent's stats. Map
		// our (simpler) counters into the closest equivalents:
		//   - Connected → in-flight requests
		//   - Running   → same as Connected (no pending/queued
		//                 distinction in net/http's pool)
		//   - Queued    → cumulative request count for this host
		pools[host] = contract.PoolStats{
			Connected: float64(p.InFlight),
			Running:   float64(p.InFlight),
			Queued:    float64(p.Total),
		}
	}
	return contract.NetworkStatus{
		Pools:         pools,
		DownloadSpeed: 0,
	}, nil
}

func (s *Service) GetMemoryStatus(_ context.Context) (map[string]any, error) {
	return map[string]any{"total": 0, "free": 0}, nil
}

func (s *Service) GetSessionId(_ context.Context) (string, error) {
	return "wails-session", nil
}

func (s *Service) GetGameDataDirectory(_ context.Context) (string, error) {
	return s.host.MinecraftDataPath, nil
}

func (s *Service) GetDesktopDirectory(_ context.Context) (string, error) {
	return s.host.DesktopDir(), nil
}

// ShowItemInDirectory reveals a file in the user's native file
// manager. Used by the renderer's "Show file" affordances on the
// resource pack / shader pack / mod / log views.
func (s *Service) ShowItemInDirectory(_ context.Context, path string) error {
	if path == "" {
		return nil
	}
	if err := host.SelectInFileManager(path); err != nil {
		s.host.Logger.Warn("base: ShowItemInDirectory", "path", path, "err", err)
	}
	return nil
}

// OpenDirectory opens a directory in the user's native file manager.
// Returns true on a best-effort basis (matches the TS reference's
// boolean return — the renderer treats a falsy result as "shell
// declined to open").
func (s *Service) OpenDirectory(_ context.Context, path string) (bool, error) {
	if path == "" {
		return false, nil
	}
	if err := host.OpenInFileManager(path); err != nil {
		s.host.Logger.Warn("base: OpenDirectory", "path", path, "err", err)
		return false, nil
	}
	return true, nil
}

// ============================================================
// Settings store: lazily constructed on first GetSettings call so
// the on-disk file is read at most once even when the renderer reloads.
// ============================================================

func (s *Service) ensureSettingsStore() *host.SettingsStore[contract.Settings] {
	s.settingsOnce.Do(func() {
		s.settings = host.NewSettingsStore[contract.Settings](
			s.host.AppDataPath,
			host.SettingsConfig[contract.Settings]{
				Defaults: defaultSettings,
				Logger:   s.host.Logger,
			},
		)
		host.Set(s.host.Registry, s.settings)
		s.host.SetSettingsProvider(&settingsProvider{store: s.settings})
		installSettingsAppliers(s.settings)
	})
	return s.settings
}

// settingsProvider adapts the persisted Settings store to the
// host.SettingsProvider interface so installers can read the user's
// `apiSetsPreference` + `apiSets` without importing the contract
// package (which would cycle).
type settingsProvider struct {
	store *host.SettingsStore[contract.Settings]
}

func (p *settingsProvider) APISet() (string, []network.APISet) {
	cur := p.store.Get()
	if cur == nil {
		return "", nil
	}
	sets := make([]network.APISet, 0, len(cur.ApiSets))
	for _, entry := range cur.ApiSets {
		raw, ok := entry.(map[string]any)
		if !ok {
			continue
		}
		name, _ := raw["name"].(string)
		url, _ := raw["url"].(string)
		if name == "" || url == "" {
			continue
		}
		sets = append(sets, network.APISet{Name: name, URL: url})
	}
	return cur.ApiSetsPreference, sets
}

// defaultSettings mirrors the Zod defaults from
// `xmcl-runtime-api/src/entities/setting.schema.ts`. Anything left as
// the Go zero value (false / 0 / "" / nil) matches the schema's
// implicit defaults.
func defaultSettings() *contract.Settings {
	return &contract.Settings{
		Theme:       "dark",
		MaxSockets:  64,
		MaxAPISockets: 16,
		// `replaceNatives` is a discriminated union in TS; the codegen
		// reduced it to `any`. Go side stores the active variant.
		ReplaceNatives: "legacy-only",
		GlobalHideLauncher: true,
		DiscordPresence: true,
		EnableDedicatedGPUOptimization: true,
		// modernc.org/sqlite is pure-Go and always available, so the
		// renderer's "Database is not opened!" critical-error banner
		// should never trigger in the Wails build.
		DatabaseReady: true,
		Locales: []map[string]any{
			{"locale": "en", "name": "English"},
			{"locale": "zh-CN", "name": "中文"},
		},
		// Mirrors the TS reference's default — BMCLAPI is the only
		// shipped mirror and `apiSetsPreference == ""` lets the GFW
		// heuristic pick whether to prefer it (see network.gfw.go).
		ApiSets: []any{
			map[string]any{"name": "bmcl", "url": "https://bmclapi2.bangbang93.com"},
		},
		ApiSetsPreference: "",
	}
}

// installSettingsAppliers wires every renderer-driven Settings mutator
// to the persisted store. Each Apply<…>Set hook lives as an exported
// `var` in the generated contract package; reassigning it replaces the
// default no-op with one that updates the store and triggers a save.
func installSettingsAppliers(store *host.SettingsStore[contract.Settings]) {
	contract.ApplySettings_Config = func(_ *contract.Settings, value any) {
		// `config(...)` from the renderer sends a partial bag — apply
		// it via JSON round-trip into the persisted struct.
		if m, ok := value.(map[string]any); ok {
			for k, v := range m {
				store.SetField(goField(k), v)
			}
		}
	}
	contract.ApplySettings_DeveloperModeSet = func(_ *contract.Settings, v bool) { store.SetField("DeveloperMode", v) }
	contract.ApplySettings_DiscordPresenceSet = func(_ *contract.Settings, v bool) { store.SetField("DiscordPresence", v) }
	contract.ApplySettings_ThemeSet = func(_ *contract.Settings, v string) { store.SetField("Theme", v) }
	contract.ApplySettings_LocaleSet = func(_ *contract.Settings, v string) { store.SetField("Locale", v) }
	contract.ApplySettings_EnableDedicatedGPUOptimizationSet = func(_ *contract.Settings, v bool) { store.SetField("EnableDedicatedGPUOptimization", v) }
	contract.ApplySettings_LocalesSet = func(_ *contract.Settings, v []map[string]any) { store.SetField("Locales", v) }
	contract.ApplySettings_HttpProxySet = func(_ *contract.Settings, v string) { store.SetField("HttpProxy", v) }
	contract.ApplySettings_HttpProxyEnabledSet = func(_ *contract.Settings, v bool) { store.SetField("HttpProxyEnabled", v) }
	contract.ApplySettings_AllowPrereleaseSet = func(_ *contract.Settings, v bool) { store.SetField("AllowPrerelease", v) }
	contract.ApplySettings_AutoInstallOnAppQuitSet = func(_ *contract.Settings, v bool) { store.SetField("AutoInstallOnAppQuit", v) }
	contract.ApplySettings_UpdateStatusSet = func(_ *contract.Settings, v string) { store.SetField("UpdateStatus", v) }
	contract.ApplySettings_AutoDownloadSet = func(_ *contract.Settings, v bool) { store.SetField("AutoDownload", v) }
	contract.ApplySettings_UpdateInfoSet = func(_ *contract.Settings, v contract.ReleaseInfo) { store.SetField("UpdateInfo", v) }
	contract.ApplySettings_ApiSetsPreferenceSet = func(_ *contract.Settings, v string) { store.SetField("ApiSetsPreference", v) }
	contract.ApplySettings_ApiSetsSet = func(_ *contract.Settings, v []map[string]any) { store.SetField("ApiSets", v) }
	contract.ApplySettings_AllowTurnSet = func(_ *contract.Settings, v bool) { store.SetField("AllowTurn", v) }
	contract.ApplySettings_OnlineSet = func(_ *contract.Settings, v bool) { store.SetField("Online", v) }
	contract.ApplySettings_MaxSocketsSet = func(_ *contract.Settings, v float64) { store.SetField("MaxSockets", v) }
	contract.ApplySettings_MaxAPISocketsSet = func(_ *contract.Settings, v float64) { store.SetField("MaxAPISockets", v) }
	contract.ApplySettings_DisableTelemetrySet = func(_ *contract.Settings, v bool) { store.SetField("DisableTelemetry", v) }
	contract.ApplySettings_LinuxTitlebarSet = func(_ *contract.Settings, v bool) { store.SetField("LinuxTitlebar", v) }
	contract.ApplySettings_WindowTranslucentSet = func(_ *contract.Settings, v bool) { store.SetField("WindowTranslucent", v) }
	contract.ApplySettings_ReplaceNativesSet = func(_ *contract.Settings, v any) { store.SetField("ReplaceNatives", v) }
	contract.ApplySettings_GlobalResolutionSet = func(_ *contract.Settings, v map[string]any) { store.SetField("GlobalResolution", v) }
	contract.ApplySettings_DiskFullErrorSet = func(_ *contract.Settings, v bool) { store.SetField("DiskFullError", v) }
	contract.ApplySettings_DatabaseReadySet = func(_ *contract.Settings, v bool) { store.SetField("DatabaseReady", v) }
	contract.ApplySettings_InvalidGameDataPathSet = func(_ *contract.Settings, v string) { store.SetField("InvalidGameDataPath", v) }
	contract.ApplySettings_GlobalInstanceSetting = func(_ *contract.Settings, v map[string]any) {
		// Bulk update on instance-wide launch defaults — apply each key.
		for k, val := range v {
			store.SetField(goField(k), val)
		}
	}
}

// goField turns a TS-side field name (camelCase) into the Go-exported
// equivalent. Mirrors the codegen's toGoExported (sans underscore strip).
func goField(name string) string {
	if name == "" {
		return name
	}
	// uppercase first rune, leave the rest alone
	r := []rune(name)
	if r[0] >= 'a' && r[0] <= 'z' {
		r[0] -= 'a' - 'A'
	}
	return string(r)
}
