package modparser

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/BurntSushi/toml"
)

// ============================================================
// META-INF/MANIFEST.MF (legacy tweak-class metadata)
// ============================================================

// ManifestMetadata is the subset of MANIFEST.MF fields the launcher
// surfaces for old-style tweak-loader mods.
type ManifestMetadata struct {
	Modid       string   `json:"modid"`
	Name        string   `json:"name"`
	Authors     []string `json:"authors"`
	Version     string   `json:"version"`
	Description string   `json:"description"`
	URL         string   `json:"url"`
}

// ReadForgeModManifest parses META-INF/MANIFEST.MF and the optional
// TweakMetaFile pointed at from it. `manifestStore` (when non-nil) is
// populated with every key/value pair from the manifest itself so the
// caller can probe extra attributes (e.g. Implementation-Version
// referenced by mods.toml).
func ReadForgeModManifest(j *JarSource, manifestStore map[string]string) (*ManifestMetadata, error) {
	raw, err := j.readEntry("META-INF/MANIFEST.MF")
	if err != nil {
		return nil, nil
	}
	manifest := parseManifestMF(string(raw))
	if manifestStore != nil {
		for k, v := range manifest {
			manifestStore[k] = v
		}
	}

	out := &ManifestMetadata{Authors: []string{}}
	if v := manifest["TweakName"]; v != "" {
		out.Modid = v
		out.Name = v
	}
	if v := manifest["TweakAuthor"]; v != "" {
		out.Authors = []string{v}
	}
	if v := manifest["TweakVersion"]; v != "" {
		out.Version = v
	}
	if file := manifest["TweakMetaFile"]; file != "" {
		if data, err := j.readEntry("META-INF/" + file); err == nil {
			var m map[string]any
			if jerr := json.Unmarshal(stripBOM(data), &m); jerr == nil {
				if s, ok := m["id"].(string); ok {
					out.Modid = s
				}
				if s, ok := m["name"].(string); ok {
					out.Name = s
				}
				if s, ok := m["version"].(string); ok {
					out.Version = s
				}
				if s, ok := m["description"].(string); ok {
					out.Description = s
				}
				if s, ok := m["url"].(string); ok {
					out.URL = s
				}
				if arr, ok := m["authors"].([]any); ok {
					out.Authors = nil
					for _, a := range arr {
						if s, ok := a.(string); ok {
							out.Authors = append(out.Authors, s)
						}
					}
				}
			}
		}
	}
	return out, nil
}

func parseManifestMF(s string) map[string]string {
	out := map[string]string{}
	// MANIFEST.MF supports continuation lines (a leading space joins to
	// the previous), but tweak-mod manifests almost never use them. The
	// TS reference also doesn't handle continuations; we mirror that.
	for _, line := range strings.Split(s, "\n") {
		line = strings.TrimRight(line, "\r ")
		if line == "" {
			continue
		}
		i := strings.Index(line, ":")
		if i < 0 {
			continue
		}
		key := strings.TrimSpace(line[:i])
		val := strings.TrimSpace(line[i+1:])
		out[key] = val
	}
	return out
}

// ============================================================
// META-INF/mods.toml (Forge / NeoForge)
// ============================================================

// ForgeModTOMLDependency mirrors the per-modid dependency block.
type ForgeModTOMLDependency struct {
	ModId        string `json:"modId" toml:"modId"`
	Mandatory    bool   `json:"mandatory" toml:"mandatory"`
	VersionRange string `json:"versionRange" toml:"versionRange"`
	Ordering     string `json:"ordering" toml:"ordering"`
	Side         string `json:"side" toml:"side"`
}

// ForgeModTOMLData mirrors a single entry in `[[mods]]` (post-merge
// with the loader-level fields).
type ForgeModTOMLData struct {
	Modid           string                   `json:"modid"`
	Version         string                   `json:"version"`
	DisplayName     string                   `json:"displayName"`
	UpdateJSONURL   string                   `json:"updateJSONURL"`
	DisplayURL      string                   `json:"displayURL"`
	LogoFile        string                   `json:"logoFile"`
	Credits         string                   `json:"credits"`
	Authors         string                   `json:"authors"`
	Description     string                   `json:"description"`
	Dependencies    []ForgeModTOMLDependency `json:"dependencies"`
	Provides        []string                 `json:"provides"`
	ModLoader       string                   `json:"modLoader"`
	LoaderVersion   string                   `json:"loaderVersion"`
	IssueTrackerURL string                   `json:"issueTrackerURL"`
	ClientSideOnly  bool                     `json:"clientSideOnly"`
}

// modsTomlRoot is the raw TOML wire shape — it has loader-level fields
// at the top followed by `[[mods]]` arrays. We post-merge the
// loader-level fields onto each mod entry to match the TS shape.
type modsTomlRoot struct {
	ModLoader       string `toml:"modLoader"`
	LoaderVersion   string `toml:"loaderVersion"`
	IssueTrackerURL string `toml:"issueTrackerURL"`
	DisplayURL      string `toml:"displayURL"`
	UpdateJSONURL   string `toml:"updateJSONURL"`
	Authors         string `toml:"authors"`
	ClientSideOnly  bool   `toml:"clientSideOnly"`

	Mods         []map[string]any                    `toml:"mods"`
	Dependencies map[string][]ForgeModTOMLDependency  `toml:"dependencies"`
}

// ReadForgeModToml parses META-INF/{mods,neoforge.mods}.toml.
//
// `manifest` (when non-nil) is consulted to resolve the
// `${file.jarVersion}` placeholder Forge uses for mods that take their
// version from the JAR manifest's `Implementation-Version` attribute.
func ReadForgeModToml(j *JarSource, manifest map[string]string, fileName string) ([]ForgeModTOMLData, error) {
	if fileName == "" {
		fileName = "mods.toml"
	}
	raw, err := j.readEntry("META-INF/" + fileName)
	if err != nil {
		return nil, nil
	}
	var root modsTomlRoot
	if _, err := toml.Decode(string(raw), &root); err != nil {
		return nil, errors.New("modparser: " + fileName + ": " + err.Error())
	}

	out := make([]ForgeModTOMLData, 0, len(root.Mods))
	for _, m := range root.Mods {
		entry := ForgeModTOMLData{
			Modid:           getString(m, "modId"),
			Authors:         coalesceString(getString(m, "authors"), root.Authors),
			Version:         resolveTomlVersion(getString(m, "version"), manifest),
			DisplayName:     getString(m, "displayName"),
			Description:     getString(m, "description"),
			DisplayURL:      coalesceString(getString(m, "displayURL"), root.DisplayURL),
			UpdateJSONURL:   coalesceString(getString(m, "updateJSONURL"), root.UpdateJSONURL),
			Provides:        getStringArray(m, "provides"),
			LogoFile:        getString(m, "logoFile"),
			Credits:         getString(m, "credits"),
			LoaderVersion:   root.LoaderVersion,
			ModLoader:       root.ModLoader,
			IssueTrackerURL: root.IssueTrackerURL,
			ClientSideOnly:  root.ClientSideOnly || getBool(m, "clientSideOnly"),
			Dependencies:    []ForgeModTOMLDependency{},
		}
		if dep, ok := root.Dependencies[entry.Modid]; ok {
			entry.Dependencies = dep
		}
		out = append(out, entry)
	}
	return out, nil
}

func resolveTomlVersion(version string, manifest map[string]string) string {
	if version == "${file.jarVersion}" {
		if manifest != nil {
			if v, ok := manifest["Implementation-Version"]; ok && v != "" {
				return v
			}
		}
	}
	return version
}

// ============================================================
// mcmod.info / cccmod.info / neimod.info (legacy Forge)
// ============================================================

// ForgeModMcmodInfo mirrors `mcmod.info`.
type ForgeModMcmodInfo struct {
	Modid                    string   `json:"modid"`
	Name                     string   `json:"name"`
	Description              string   `json:"description"`
	Version                  string   `json:"version"`
	MCVersion                string   `json:"mcversion"`
	URL                      string   `json:"url"`
	UpdateURL                string   `json:"updateUrl"`
	UpdateJSON               string   `json:"updateJSON"`
	AuthorList               []string `json:"authorList"`
	Credits                  string   `json:"credits"`
	LogoFile                 string   `json:"logoFile"`
	Screenshots              []string `json:"screenshots"`
	Parent                   string   `json:"parent"`
	UseDependencyInformation bool     `json:"useDependencyInformation"`
	RequiredMods             []string `json:"requiredMods"`
	Dependencies             []string `json:"dependencies"`
	Dependants               []string `json:"dependants"`
}

// ReadForgeModJson reads mcmod.info / cccmod.info / neimod.info or
// the first `*.info` file found at the jar root, in that order.
func ReadForgeModJson(j *JarSource) ([]ForgeModMcmodInfo, error) {
	for _, candidate := range []string{"mcmod.info", "cccmod.info", "neimod.info"} {
		if !j.hasEntry(candidate) {
			continue
		}
		raw, err := j.readEntry(candidate)
		if err != nil {
			continue
		}
		text := stripBOM(raw)
		if candidate != "mcmod.info" {
			// CCC/NEI variants are sometimes minified by joining lines —
			// the TS reference replicates this normalisation:
			s := strings.ReplaceAll(string(text), "\n\n", `\n`)
			s = strings.ReplaceAll(s, "\n", "")
			text = []byte(s)
		}
		entries, err := parseMcmodInfo(text)
		if err == nil {
			return entries, nil
		}
	}

	// Fall back to scanning the archive root for any `*.info` file.
	if j == nil || j.Reader == nil {
		return []ForgeModMcmodInfo{}, nil
	}
	for _, f := range j.Reader.File {
		if !strings.HasSuffix(f.Name, ".info") || strings.Contains(f.Name, "/") {
			continue
		}
		raw, err := j.readEntry(f.Name)
		if err != nil {
			continue
		}
		s := strings.ReplaceAll(string(stripBOM(raw)), "\n\n", `\n`)
		s = strings.ReplaceAll(s, "\n", "")
		entries, err := parseMcmodInfo([]byte(s))
		if err == nil {
			return entries, nil
		}
	}
	return []ForgeModMcmodInfo{}, nil
}

// parseMcmodInfo handles the three shapes the format permits at the
// top level: an array, an object with `modList`, or a single mod
// object directly.
func parseMcmodInfo(data []byte) ([]ForgeModMcmodInfo, error) {
	// Try the most permissive shape: an interface{} that we discriminate
	// with a type-switch. The underlying allocator does the heavy lifting.
	var raw any
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	switch v := raw.(type) {
	case []any:
		out := make([]ForgeModMcmodInfo, 0, len(v))
		for _, item := range v {
			if m, ok := item.(map[string]any); ok {
				out = append(out, normaliseMcmodInfo(m))
			}
		}
		return out, nil
	case map[string]any:
		if list, ok := v["modList"].([]any); ok {
			out := make([]ForgeModMcmodInfo, 0, len(list))
			for _, item := range list {
				if m, ok := item.(map[string]any); ok {
					out = append(out, normaliseMcmodInfo(m))
				}
			}
			return out, nil
		}
		if _, ok := v["modid"]; ok {
			return []ForgeModMcmodInfo{normaliseMcmodInfo(v)}, nil
		}
	}
	return []ForgeModMcmodInfo{}, nil
}

func normaliseMcmodInfo(m map[string]any) ForgeModMcmodInfo {
	return ForgeModMcmodInfo{
		Modid:                    getString(m, "modid"),
		Name:                     getString(m, "name"),
		Description:              getString(m, "description"),
		Version:                  getString(m, "version"),
		MCVersion:                getString(m, "mcversion"),
		URL:                      getString(m, "url"),
		UpdateURL:                getString(m, "updateUrl"),
		UpdateJSON:               getString(m, "updateJSON"),
		AuthorList:               getStringArray(m, "authorList"),
		Credits:                  getString(m, "credits"),
		LogoFile:                 getString(m, "logoFile"),
		Screenshots:              getStringArray(m, "screenshots"),
		Parent:                   getString(m, "parent"),
		UseDependencyInformation: getBool(m, "useDependencyInformation"),
		RequiredMods:             getStringArray(m, "requiredMods"),
		Dependencies:             getStringArray(m, "dependencies"),
		Dependants:               getStringArray(m, "dependants"),
	}
}

// ============================================================
// Aggregate
// ============================================================

// ForgeModMetadata bundles every Forge metadata source into one shape.
// The ASM-based scan path is intentionally omitted from the Go port
// (see package doc).
type ForgeModMetadata struct {
	McmodInfo        []ForgeModMcmodInfo `json:"mcmodInfo"`
	Manifest         map[string]string   `json:"manifest"`
	ManifestMetadata *ManifestMetadata   `json:"manifestMetadata,omitempty"`
	ModsToml         []ForgeModTOMLData  `json:"modsToml"`
}

// ReadForgeMod loads every Forge metadata source available in the jar
// and bundles them. Returns nil + nil-error when no metadata at all is
// present (callers can probe `len(...)==0` to recognise non-mod jars).
func ReadForgeMod(j *JarSource) (*ForgeModMetadata, error) {
	manifest := map[string]string{}
	manifestMeta, _ := ReadForgeModManifest(j, manifest)
	tomls, err := ReadForgeModToml(j, manifest, "")
	if err != nil {
		return nil, err
	}
	if len(tomls) == 0 {
		// NeoForge moved to its own filename in newer versions.
		alt, alterr := ReadForgeModToml(j, manifest, "neoforge.mods.toml")
		if alterr == nil {
			tomls = alt
		}
	}
	jsons, _ := ReadForgeModJson(j)

	hasManifestMod := manifestMeta != nil && manifestMeta.Modid != ""
	if len(jsons) == 0 && !hasManifestMod && len(tomls) == 0 {
		return nil, nil
	}
	out := &ForgeModMetadata{
		McmodInfo: jsons,
		Manifest:  manifest,
		ModsToml:  tomls,
	}
	if hasManifestMod {
		out.ManifestMetadata = manifestMeta
	}
	return out, nil
}

// ============================================================
// Tiny coercion helpers (untyped JSON -> typed Go fields)
// ============================================================

func getString(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getBool(m map[string]any, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}

func getStringArray(m map[string]any, key string) []string {
	v, ok := m[key]
	if !ok || v == nil {
		return []string{}
	}
	if arr, ok := v.([]any); ok {
		out := make([]string, 0, len(arr))
		for _, item := range arr {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	}
	if arr, ok := v.([]string); ok {
		return arr
	}
	return []string{}
}

func coalesceString(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
