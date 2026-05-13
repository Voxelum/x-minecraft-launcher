// Package instance also handles the top-level `instances.json`
// registry that tracks external instance paths, the active selection,
// and instance groups (folders / orderings used by the sidebar).
package instance

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

// RegistryFile is the on-disk name of the registry under
// `<appDataPath>`.
const RegistryFile = "instances.json"

// Registry is the parsed shape of `instances.json`. Group entries
// can be either a bare path or an object describing a folder with
// children — we keep them as `any` to preserve fidelity for the
// renderer.
type Registry struct {
	Instances        []string `json:"instances"`
	SelectedInstance string   `json:"selectedInstance,omitempty"`
	Groups           []any    `json:"groups,omitempty"`
}

// LoadRegistry reads `<appDataPath>/instances.json`. Returns an
// empty Registry when the file doesn't exist.
func LoadRegistry(appDataPath string) (*Registry, error) {
	path := filepath.Join(appDataPath, RegistryFile)
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return &Registry{Instances: []string{}, Groups: []any{}}, nil
		}
		return nil, err
	}
	r := &Registry{}
	if err := json.Unmarshal(raw, r); err != nil {
		// Corrupt registry → fall back to empty; the renderer will
		// repopulate as instances are discovered.
		return &Registry{Instances: []string{}, Groups: []any{}}, nil
	}
	if r.Instances == nil {
		r.Instances = []string{}
	}
	if r.Groups == nil {
		r.Groups = []any{}
	}
	return r, nil
}

// SaveRegistry atomically writes the registry back to disk.
func SaveRegistry(appDataPath string, r *Registry) error {
	if err := os.MkdirAll(appDataPath, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return err
	}
	target := filepath.Join(appDataPath, RegistryFile)
	tmp := target + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, target)
}
