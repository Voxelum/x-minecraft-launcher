package modparser

import (
	"encoding/json"
	"errors"
)

// QuiltLicense is the union shape on `metadata.license`.
type QuiltLicense struct {
	Name        string `json:"name,omitempty"`
	ID          string `json:"id,omitempty"`
	URL         string `json:"url,omitempty"`
	Description string `json:"description,omitempty"`
}

// QuiltMetadata is the inner `metadata` object.
type QuiltMetadata struct {
	Name         string            `json:"name,omitempty"`
	Description  string            `json:"description,omitempty"`
	Contributors map[string]any    `json:"contributors,omitempty"`
	Contact      *FabricContact    `json:"contact,omitempty"`
	License      any               `json:"license,omitempty"` // string | QuiltLicense | []
	Icon         any               `json:"icon,omitempty"`    // string | map[string]string
}

// QuiltLoaderData mirrors the `quilt_loader` block.
type QuiltLoaderData struct {
	Group       string         `json:"group"`
	ID          string         `json:"id"`
	Provides    []any          `json:"provides,omitempty"`
	Version     string         `json:"version"`
	Metadata    *QuiltMetadata `json:"metadata,omitempty"`
	Entrypoints map[string]any `json:"entrypoints,omitempty"`
	Plugins     []any          `json:"plugins,omitempty"`
	Jars        []string       `json:"jars,omitempty"`

	IntermediateMappings string `json:"intermediate_mappings,omitempty"`

	// Dependency-style fields are loosely typed because the schema
	// allows strings, objects, and arrays of either.
	Depends []any `json:"depends,omitempty"`
	Breaks  []any `json:"breaks,omitempty"`

	LoadType string `json:"load_type,omitempty"`
}

// QuiltModMetadata mirrors the TS interface.
type QuiltModMetadata struct {
	SchemaVersion int             `json:"schema_version"`
	QuiltLoader   QuiltLoaderData `json:"quilt_loader"`
	Mixin         any             `json:"mixin,omitempty"` // string | []string
}

// ReadQuiltMod loads `quilt.mod.json` from the jar.
func ReadQuiltMod(j *JarSource) (*QuiltModMetadata, error) {
	raw, err := j.readEntry("quilt.mod.json")
	if err != nil {
		return nil, err
	}
	var meta QuiltModMetadata
	if err := json.Unmarshal(stripBOM(raw), &meta); err != nil {
		return nil, errors.New("modparser: quilt.mod.json: " + err.Error())
	}
	return &meta, nil
}
