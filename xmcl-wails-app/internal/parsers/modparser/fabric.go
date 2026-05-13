package modparser

import (
	"encoding/json"
	"errors"
	"strings"
)

// FabricPerson is the union shape on the `authors` / `contributors`
// fields of `fabric.mod.json`. The schema permits either a bare name
// or an object carrying a contact field; we surface both.
type FabricPerson struct {
	Name    string `json:"name"`
	Contact string `json:"contact,omitempty"`
}

// FabricContact is the contact-info sub-object.
//
// Sources is documented as `string[]` but real-world `fabric.mod.json`
// files frequently set it to a single string (the project's repo URL).
// `StringArray` accepts both shapes transparently.
type FabricContact struct {
	Email    string      `json:"email,omitempty"`
	IRC      string      `json:"irc,omitempty"`
	Homepage string      `json:"homepage,omitempty"`
	Issues   string      `json:"issues,omitempty"`
	Sources  StringArray `json:"sources,omitempty"`
}

// StringArray decodes from either a JSON string ("a") or array of
// strings (["a", "b"]). Used for fields whose schema permits both.
type StringArray []string

// UnmarshalJSON implements the polymorphic decode.
func (s *StringArray) UnmarshalJSON(data []byte) error {
	if len(data) > 0 && data[0] == '"' {
		var v string
		if err := json.Unmarshal(data, &v); err != nil {
			return err
		}
		*s = StringArray{v}
		return nil
	}
	var arr []string
	if err := json.Unmarshal(data, &arr); err != nil {
		return err
	}
	*s = StringArray(arr)
	return nil
}

// FabricMixin handles either a string (mixin path) or an object with
// a per-environment guard.
type FabricMixin struct {
	Config      string `json:"config,omitempty"`
	Environment string `json:"environment,omitempty"`
}

// FabricModMetadata mirrors the TS interface.
type FabricModMetadata struct {
	SchemaVersion int    `json:"schemaVersion"`
	ID            string `json:"id"`
	Version       string `json:"version"`

	Provides    []string `json:"provides,omitempty"`
	Environment string   `json:"environment,omitempty"`

	Entrypoints      any                          `json:"entrypoints,omitempty"`
	Jars             []map[string]string          `json:"jars,omitempty"`
	LanguageAdapters map[string]string            `json:"languageAdapters,omitempty"`
	Mixins           []FabricMixin                `json:"mixins,omitempty"`

	Depends    map[string]any `json:"depends,omitempty"`
	Recommends map[string]any `json:"recommends,omitempty"`
	Suggests   map[string]any `json:"suggests,omitempty"`
	Breaks     map[string]any `json:"breaks,omitempty"`
	Conflicts  map[string]any `json:"conflicts,omitempty"`

	Name         string         `json:"name,omitempty"`
	Description  string         `json:"description,omitempty"`
	Contact      *FabricContact `json:"contact,omitempty"`
	Authors      []FabricPerson `json:"authors,omitempty"`
	Contributors []FabricPerson `json:"contributors,omitempty"`
	License      any            `json:"license,omitempty"` // string | []string
	Icon         any            `json:"icon,omitempty"`    // string | map[string]string
}

// UnmarshalJSON normalises the polymorphic mixin entries (string or
// object). Without this, json.Unmarshal would fail on the `[]string`
// literal entries the TS reference handles transparently.
func (m *FabricMixin) UnmarshalJSON(data []byte) error {
	if len(data) > 0 && data[0] == '"' {
		var s string
		if err := json.Unmarshal(data, &s); err != nil {
			return err
		}
		m.Config = s
		return nil
	}
	type raw FabricMixin
	var r raw
	if err := json.Unmarshal(data, &r); err != nil {
		return err
	}
	*m = FabricMixin(r)
	return nil
}

// UnmarshalJSON normalises the polymorphic person entries.
func (p *FabricPerson) UnmarshalJSON(data []byte) error {
	if len(data) > 0 && data[0] == '"' {
		var s string
		if err := json.Unmarshal(data, &s); err != nil {
			return err
		}
		p.Name = s
		return nil
	}
	type raw FabricPerson
	var r raw
	if err := json.Unmarshal(data, &r); err != nil {
		return err
	}
	*p = FabricPerson(r)
	return nil
}

// ReadFabricMod loads `fabric.mod.json` from the jar. Returns
// `os.ErrNotExist` (wrapped) when the archive doesn't carry one.
//
// The TS reference also strips raw newlines from the JSON body before
// `JSON.parse` (a workaround for malformed mods that embed unescaped
// newlines in string values). We keep the workaround here for parity.
func ReadFabricMod(j *JarSource) (*FabricModMetadata, error) {
	raw, err := j.readEntry("fabric.mod.json")
	if err != nil {
		return nil, err
	}
	cleaned := stripBOM(raw)
	cleaned = []byte(strings.ReplaceAll(string(cleaned), "\n", ""))

	var meta FabricModMetadata
	if err := json.Unmarshal(cleaned, &meta); err != nil {
		return nil, errors.New("modparser: fabric.mod.json: " + err.Error())
	}
	return &meta, nil
}
