// Package instance holds the on-disk model + read/write logic shared by
// every InstanceService method. Mirrors `packages/instance/` from the
// TS side; trimmed to the fields the renderer + downstream Go services
// actually consume.
package instance

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"time"
)

// InstanceFolder is the on-disk directory under `<gameDataPath>`.
const InstanceFolder = "instances"

// InstanceFile is the manifest file written into each instance dir.
const InstanceFile = "instance.json"

// Resolution mirrors the renderer's per-instance resolution override.
type Resolution struct {
	Width      int  `json:"width,omitempty"`
	Height     int  `json:"height,omitempty"`
	Fullscreen bool `json:"fullscreen,omitempty"`
}

// RuntimeVersions captures the loader-version pin per loader. Empty
// strings mean "no requirement". Both the TS schema and the renderer
// use the same set of optional fields.
type RuntimeVersions struct {
	Minecraft    string `json:"minecraft"`
	Forge        string `json:"forge,omitempty"`
	FabricLoader string `json:"fabricLoader,omitempty"`
	Optifine     string `json:"optifine,omitempty"`
	QuiltLoader  string `json:"quiltLoader,omitempty"`
	NeoForged    string `json:"neoForged,omitempty"`
	LabyMod      string `json:"labyMod,omitempty"`
}

// Server is the per-instance direct-connect target.
type Server struct {
	Host string `json:"host"`
	Port int    `json:"port,omitempty"`
}

// Instance is the full per-directory manifest. Embedded under the
// directory as `instance.json`. The Go shape keeps every field the
// renderer reads, but uses `omitempty` on optionals so external
// editors stay sane.
type Instance struct {
	Path string `json:"-"` // filled in by Load*; never serialized

	Name        string `json:"name"`
	Author      string `json:"author,omitempty"`
	Description string `json:"description,omitempty"`
	Version     string `json:"version,omitempty"`

	Runtime RuntimeVersions `json:"runtime"`

	Java       string      `json:"java,omitempty"`
	Resolution *Resolution `json:"resolution,omitempty"`

	MinMemory    int    `json:"minMemory,omitempty"`
	MaxMemory    int    `json:"maxMemory,omitempty"`
	AssignMemory any    `json:"assignMemory,omitempty"`

	VMOptions         []string          `json:"vmOptions,omitempty"`
	McOptions         []string          `json:"mcOptions,omitempty"`
	Env               map[string]string `json:"env,omitempty"`
	PrependCommand    string            `json:"prependCommand,omitempty"`
	PreExecuteCommand string            `json:"preExecuteCommand,omitempty"`

	URL     string `json:"url,omitempty"`
	Icon    string `json:"icon,omitempty"`
	FileAPI string `json:"fileApi,omitempty"`

	Server *Server `json:"server,omitempty"`

	ShowLog                bool   `json:"showLog,omitempty"`
	HideLauncher           bool   `json:"hideLauncher,omitempty"`
	FastLaunch             bool   `json:"fastLaunch,omitempty"`
	DisableElybyAuthlib    bool   `json:"disableElybyAuthlib,omitempty"`
	DisableAuthlibInjector bool   `json:"disableAuthlibInjector,omitempty"`
	UseLatest              string `json:"useLatest,omitempty"`

	Upstream map[string]any `json:"upstream,omitempty"`

	CreationDate   int64 `json:"creationDate"`
	LastAccessDate int64 `json:"lastAccessDate"`
	LastPlayedDate int64 `json:"lastPlayedDate"`
	Playtime       int64 `json:"playtime"`
}

// ErrInvalidInstance is returned by Load when an instance.json is
// present but missing the minimum required fields.
var ErrInvalidInstance = errors.New("instance: invalid instance.json")

// Load reads `<dir>/instance.json` and returns the parsed Instance
// with `Path` populated to `dir`. Returns os.ErrNotExist (wrapped)
// when the file is missing, ErrInvalidInstance when present but
// unparseable.
func Load(dir string) (*Instance, error) {
	path := filepath.Join(dir, InstanceFile)
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var inst Instance
	if err := json.Unmarshal(raw, &inst); err != nil {
		return nil, errors.Join(ErrInvalidInstance, err)
	}
	if inst.Name == "" {
		// An instance without a name is unusable; treat the file as
		// corrupt rather than silently surfacing it.
		return nil, ErrInvalidInstance
	}
	inst.Path = dir
	return &inst, nil
}

// Save atomically writes `inst` to `<inst.Path>/instance.json`,
// creating the directory if it doesn't already exist.
func Save(inst *Instance) error {
	if inst.Path == "" {
		return errors.New("instance: Save called with empty Path")
	}
	if err := os.MkdirAll(inst.Path, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(inst, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(inst.Path, InstanceFile+".tmp")
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(inst.Path, InstanceFile))
}

// New builds an Instance with sensible defaults and timestamps the
// creation event. The caller is expected to populate `Path` (either
// by passing a managed candidate path or an external one).
func New(name string) *Instance {
	now := time.Now().UnixMilli()
	return &Instance{
		Name:           name,
		CreationDate:   now,
		LastAccessDate: now,
	}
}
