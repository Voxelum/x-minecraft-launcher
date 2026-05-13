// parse.go — fan-out from a single file path to the metadata,
// icon URIs, and uri keys produced by the loader-specific parsers.
//
// The dispatcher chooses a parser based on the file extension +
// the requested domain:
//
//   - DomainMods + .jar / .jar.disabled → modparser (forge / fabric /
//                                          quilt / neoforge / liteloader)
//   - DomainResourcePacks + .zip       → resourcepack.ReadPackMetaAndIcon
//   - DomainShaderPacks + .zip         → opaque (presence is enough)
//   - DomainSaves + directory          → gamedata.ReadLevelDat
//   - DomainModpacks + .zip / .mrpack  → not yet wired
//
// Anything outside this set is returned as ParseResult{FileType:
// FileTypeUnknown}, which the manager will still sha1 and persist —
// that lets the URI/sha1 lookups work for arbitrary files.

package resource

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/parsers/modparser"
	"github.com/voxelum/xmcl/wails/internal/parsers/resourcepack"
)

// ParseResult is what Parse returns: enough to populate the
// resources / uris / icons / snapshots tables.
type ParseResult struct {
	FileType FileType
	Name     string
	// Metadata is keyed by the per-domain column names recognised in
	// schema.go's metadataColumns slice ("forge", "fabric", "quilt",
	// "neoforge", "liteloader", "resourcepack", "save", "shaderpack",
	// "instance"). Unrecognised keys are dropped at upsert time.
	Metadata map[string]any
	URIs     []string
	Icons    []string
}

// Parse runs the appropriate loader-specific parser for the given
// file. `domain` chooses the parser family. Unknown extensions
// produce a ParseResult with FileType == FileTypeUnknown.
//
// Returns nil error when no parser applies — callers can safely
// pipeline the result through upsert/snapshot regardless.
func Parse(path string, domain Domain) ParseResult {
	out := ParseResult{
		Name:     defaultName(filepath.Base(path)),
		Metadata: map[string]any{},
		FileType: FileTypeUnknown,
	}
	info, err := os.Stat(path)
	if err == nil && info.IsDir() {
		out.FileType = FileTypeDirectory
		return out
	}
	switch domain {
	case DomainMods, DomainUnclassified, "":
		// Try mod parsers — succeeds for jar files.
		if r := parseMod(path); r != nil {
			r.Name = out.Name
			return *r
		}
	case DomainResourcePacks:
		if r := parseResourcePack(path); r != nil {
			r.Name = out.Name
			return *r
		}
	case DomainShaderPacks:
		if isZipLike(path) {
			out.FileType = FileTypeShaderPack
			out.Metadata["shaderpack"] = map[string]any{}
			return out
		}
	case DomainSaves:
		// Saves are a directory family — handled elsewhere.
		out.FileType = FileTypeSave
		return out
	}
	return out
}

// defaultName turns "Iris-Reforged-1.20.1-1.7.0.jar" into
// "Iris-Reforged-1.20.1-1.7.0" (mirrors the renderer's default
// surface naming).
func defaultName(base string) string {
	base = strings.TrimSuffix(base, ".disabled")
	for _, ext := range []string{".jar", ".zip", ".litemod", ".mrpack"} {
		if strings.HasSuffix(strings.ToLower(base), ext) {
			return base[:len(base)-len(ext)]
		}
	}
	return base
}

// parseMod handles `*.jar` (and `.jar.disabled`).
func parseMod(path string) *ParseResult {
	if !isJarLike(path) {
		return nil
	}
	jar, err := modparser.OpenJar(path)
	if err != nil {
		return nil
	}
	defer jar.Close()

	res := &ParseResult{
		Metadata: map[string]any{},
		FileType: FileTypeUnknown,
	}

	if forge, _ := modparser.ReadForgeMod(jar); forge != nil {
		// `forge` here also catches NeoForge — the actual file kind
		// is decided by the toml entries / file presence below.
		isNeoForge := jar.HasEntry("META-INF/neoforge.mods.toml")
		if isNeoForge && len(forge.ModsToml) > 0 {
			res.FileType = FileTypeNeoforge
			res.Metadata["neoforge"] = forgeToNeo(forge.ModsToml[0], forge.ModsToml[1:])
			for _, t := range forge.ModsToml {
				if t.Modid != "" {
					res.URIs = append(res.URIs,
						"neoforge:"+t.Modid+":"+strDefault(t.Version))
				}
			}
			if logo := forge.ModsToml[0].LogoFile; logo != "" {
				if uri := jarIconAsDataURI(jar, logo); uri != "" {
					res.Icons = append(res.Icons, uri)
				}
			}
			res.Metadata["forge"] = normaliseForge(forge)
			return res
		}
		if len(forge.ModsToml) > 0 || forge.ManifestMetadata != nil || len(forge.McmodInfo) > 0 {
			res.FileType = FileTypeForge
			res.Metadata["forge"] = normaliseForge(forge)
			for _, t := range forge.ModsToml {
				if t.Modid != "" {
					res.URIs = append(res.URIs,
						"forge:"+t.Modid+":"+strDefault(t.Version))
				}
			}
			for _, m := range forge.McmodInfo {
				if m.Modid != "" {
					res.URIs = append(res.URIs,
						"forge:"+m.Modid+":"+m.Version)
				}
			}
			if forge.ManifestMetadata != nil && forge.ManifestMetadata.Modid != "" {
				res.URIs = append(res.URIs,
					"forge:"+forge.ManifestMetadata.Modid+":"+forge.ManifestMetadata.Version)
			}
			// Icon: prefer first mods.toml `logoFile`.
			if len(forge.ModsToml) > 0 && forge.ModsToml[0].LogoFile != "" {
				if uri := jarIconAsDataURI(jar, forge.ModsToml[0].LogoFile); uri != "" {
					res.Icons = append(res.Icons, uri)
				}
			} else {
				for _, m := range forge.McmodInfo {
					if m.LogoFile != "" {
						if uri := jarIconAsDataURI(jar, m.LogoFile); uri != "" {
							res.Icons = append(res.Icons, uri)
							break
						}
					}
				}
			}
		}
	}

	if fabric, err := modparser.ReadFabricMod(jar); err == nil && fabric != nil {
		res.FileType = FileTypeFabric
		res.Metadata["fabric"] = fabric
		if fabric.ID != "" {
			res.URIs = append(res.URIs,
				"fabric:"+fabric.ID+":"+fabric.Version)
		}
		if iconPath, ok := fabricIconPath(fabric.Icon); ok {
			if uri := jarIconAsDataURI(jar, iconPath); uri != "" {
				res.Icons = append(res.Icons, uri)
			}
		}
	}
	if quilt, err := modparser.ReadQuiltMod(jar); err == nil && quilt != nil {
		// Only override the file type if this jar is a pure-Quilt
		// build; mixed Quilt+Fabric jars stay tagged "fabric".
		if res.FileType == FileTypeUnknown {
			res.FileType = FileTypeQuilt
		}
		res.Metadata["quilt"] = quilt
		if id := quilt.QuiltLoader.ID; id != "" {
			res.URIs = append(res.URIs,
				"quilt:"+id+":"+quilt.QuiltLoader.Version)
		}
		if quilt.QuiltLoader.Metadata != nil {
			if iconPath, ok := fabricIconPath(quilt.QuiltLoader.Metadata.Icon); ok {
				if uri := jarIconAsDataURI(jar, iconPath); uri != "" {
					res.Icons = append(res.Icons, uri)
				}
			}
		}
	}

	if res.FileType == FileTypeUnknown && len(res.Metadata) == 0 {
		// Plain non-mod jar (e.g. shaderpack mismatched) — still
		// returns a result so the snapshot is recorded.
	}
	return res
}

// parseResourcePack handles `*.zip` files in the resourcepacks
// domain.
func parseResourcePack(path string) *ParseResult {
	if !isZipLike(path) {
		return nil
	}
	src, err := resourcepack.OpenSource(path)
	if err != nil {
		return nil
	}
	defer src.Close()

	pi, err := resourcepack.ReadPackMetaAndIcon(src)
	if err != nil {
		return nil
	}
	res := &ParseResult{
		FileType: FileTypeResourcePack,
		Metadata: map[string]any{
			"resourcepack": pi.Metadata,
		},
	}
	if len(pi.Icon) > 0 {
		res.Icons = append(res.Icons,
			"data:image/png;base64,"+base64.StdEncoding.EncodeToString(pi.Icon))
	}
	return res
}

// jarIconAsDataURI reads the named entry from the jar (typically a
// `logoFile` or `icon` value pulled from the mod metadata) and
// returns it as a `data:image/png;base64,…` URI. Empty string when
// the entry is missing or unreadable.
func jarIconAsDataURI(jar *modparser.JarSource, entry string) string {
	if entry == "" {
		return ""
	}
	// Entries occasionally start with a leading slash in mods.toml /
	// fabric.mod.json — strip it so the zip lookup matches.
	entry = strings.TrimPrefix(entry, "/")
	data, err := jar.ReadEntry(entry)
	if err != nil || len(data) == 0 {
		return ""
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(data)
}

// fabricIconPath unpacks the polymorphic `icon` field that fabric +
// quilt allow: either a string or `{ "16x16": "path", ... }`.
// Returns the largest-key path when given an object.
func fabricIconPath(icon any) (string, bool) {
	switch v := icon.(type) {
	case nil:
		return "", false
	case string:
		return v, v != ""
	case map[string]any:
		// Pick the highest-resolution entry by string sort
		// (`64x64` > `32x32` > `16x16`).
		best := ""
		bestKey := ""
		for k, raw := range v {
			path, ok := raw.(string)
			if !ok {
				continue
			}
			if path == "" {
				continue
			}
			if k > bestKey {
				bestKey = k
				best = path
			}
		}
		return best, best != ""
	}
	return "", false
}

func forgeToNeo(t modparser.ForgeModTOMLData, children []modparser.ForgeModTOMLData) map[string]any {
	if children == nil {
		children = []modparser.ForgeModTOMLData{}
	}
	// Normalise each child so the renderer can iterate `dependencies`
	// without a nil check.
	normChildren := make([]map[string]any, 0, len(children))
	for _, c := range children {
		normChildren = append(normChildren, neoEntry(c))
	}
	out := neoEntry(t)
	out["children"] = normChildren
	return out
}

// neoEntry builds a single neoforge mod object with every renderer-
// iterable field guaranteed non-nil.
func neoEntry(t modparser.ForgeModTOMLData) map[string]any {
	deps := make([]map[string]any, 0, len(t.Dependencies))
	for _, d := range t.Dependencies {
		deps = append(deps, map[string]any{
			"modId":        d.ModId,
			"versionRange": d.VersionRange,
			"mandatory":    d.Mandatory,
			"side":         d.Side,
			"ordering":     d.Ordering,
		})
	}
	provides := t.Provides
	if provides == nil {
		provides = []string{}
	}
	return map[string]any{
		"modid":           t.Modid,
		"version":         t.Version,
		"displayName":     t.DisplayName,
		"description":     t.Description,
		"updateJSONURL":   t.UpdateJSONURL,
		"displayURL":      t.DisplayURL,
		"logoFile":        t.LogoFile,
		"credits":         t.Credits,
		"authors":         t.Authors,
		"modLoader":       t.ModLoader,
		"loaderVersion":   t.LoaderVersion,
		"issueTrackerURL": t.IssueTrackerURL,
		"clientSideOnly":  t.ClientSideOnly,
		"dependencies":    deps,
		"provides":        provides,
	}
}

// normaliseForge guarantees every renderer-iterated slice on a
// ForgeModMetadata blob is non-nil. The TS reference keeps these as
// empty arrays; Go's `encoding/json` would otherwise emit `null` and
// crash a `for...of` in `getModProvides` / `getLegacyForgeDependencies`.
func normaliseForge(forge *modparser.ForgeModMetadata) map[string]any {
	out := map[string]any{}
	raw, err := jsonRoundtripParse(forge)
	if err == nil {
		out = raw
	}
	if _, ok := out["mcmodInfo"].([]any); !ok {
		out["mcmodInfo"] = []any{}
	}
	if _, ok := out["modsToml"].([]any); !ok {
		out["modsToml"] = []any{}
	}
	// modAnnotations is the ASM scan output the Go port intentionally
	// drops; the renderer iterates it so emit an empty array.
	if _, ok := out["modAnnotations"]; !ok {
		out["modAnnotations"] = []any{}
	}
	if _, ok := out["manifest"].(map[string]any); !ok {
		out["manifest"] = map[string]any{}
	}
	// Ensure each modsToml entry has dependencies + provides arrays.
	if arr, ok := out["modsToml"].([]any); ok {
		for i, raw := range arr {
			if m, ok := raw.(map[string]any); ok {
				if _, ok := m["dependencies"].([]any); !ok {
					m["dependencies"] = []any{}
				}
				if _, ok := m["provides"].([]any); !ok {
					m["provides"] = []any{}
				}
				arr[i] = m
			}
		}
		out["modsToml"] = arr
	}
	// Promote canonical fields so the renderer's
	// `meta.modid` / `meta.version` reads resolve.
	if len(forge.ModsToml) > 0 {
		t := forge.ModsToml[0]
		if out["modid"] == nil || out["modid"] == "" {
			out["modid"] = t.Modid
		}
		if out["version"] == nil || out["version"] == "" {
			out["version"] = t.Version
		}
	} else if len(forge.McmodInfo) > 0 {
		i := forge.McmodInfo[0]
		if out["modid"] == nil || out["modid"] == "" {
			out["modid"] = i.Modid
		}
		if out["version"] == nil || out["version"] == "" {
			out["version"] = i.Version
		}
	} else if forge.ManifestMetadata != nil {
		if out["modid"] == nil || out["modid"] == "" {
			out["modid"] = forge.ManifestMetadata.Modid
		}
		if out["version"] == nil || out["version"] == "" {
			out["version"] = forge.ManifestMetadata.Version
		}
	}
	return out
}

// jsonRoundtripParse marshals + unmarshals via encoding/json so we
// can poke at the dynamic shape with type assertions.
func jsonRoundtripParse(v any) (map[string]any, error) {
	raw, err := jsonEncode(v)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err := jsonDecode(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func strDefault(s string) string {
	if s == "" {
		return "*"
	}
	return s
}

func isJarLike(path string) bool {
	lower := strings.ToLower(path)
	lower = strings.TrimSuffix(lower, ".disabled")
	return strings.HasSuffix(lower, ".jar")
}

func isZipLike(path string) bool {
	lower := strings.ToLower(path)
	lower = strings.TrimSuffix(lower, ".disabled")
	return strings.HasSuffix(lower, ".zip")
}

// jsonEncode / jsonDecode are tiny aliases so the struct-to-map
// round-trip helpers stay consistent in one place.
func jsonEncode(v any) ([]byte, error) { return json.Marshal(v) }
func jsonDecode(b []byte, v any) error { return json.Unmarshal(b, v) }

// NormaliseMetadata patches a (possibly stale) metadata blob loaded
// from the SQLite catalogue so the renderer's iteration helpers
// (`for (const x of meta.children)` etc.) never blow up on a nil /
// missing field.
//
// Idempotent and safe to call on freshly-parsed metadata too — used
// by the per-domain services on every wire emission so the catalogue
// can carry whatever shape it likes without coordinating versions
// with the renderer.
func NormaliseMetadata(in map[string]any) map[string]any {
	if in == nil {
		return nil
	}
	if forge, ok := in["forge"].(map[string]any); ok {
		normaliseForgeMap(forge)
	}
	if neo, ok := in["neoforge"].(map[string]any); ok {
		normaliseNeoMap(neo)
	}
	return in
}

// normaliseForgeMap fills in the iterable fields the renderer
// touches without nil checks (mcmodInfo, modsToml, modAnnotations,
// manifest, plus per-modsToml dependencies / provides).
func normaliseForgeMap(out map[string]any) {
	if _, ok := out["mcmodInfo"].([]any); !ok {
		out["mcmodInfo"] = []any{}
	}
	if _, ok := out["modsToml"].([]any); !ok {
		out["modsToml"] = []any{}
	}
	if _, ok := out["modAnnotations"].([]any); !ok {
		out["modAnnotations"] = []any{}
	}
	if _, ok := out["manifest"].(map[string]any); !ok {
		out["manifest"] = map[string]any{}
	}
	if arr, ok := out["modsToml"].([]any); ok {
		for i, raw := range arr {
			if m, ok := raw.(map[string]any); ok {
				if _, ok := m["dependencies"].([]any); !ok {
					m["dependencies"] = []any{}
				}
				if _, ok := m["provides"].([]any); !ok {
					m["provides"] = []any{}
				}
				arr[i] = m
			}
		}
		out["modsToml"] = arr
	}
}

// normaliseNeoMap fills children + dependencies + provides on a
// stored NeoForge blob.
func normaliseNeoMap(out map[string]any) {
	if _, ok := out["children"].([]any); !ok {
		out["children"] = []any{}
	}
	if _, ok := out["dependencies"].([]any); !ok {
		out["dependencies"] = []any{}
	}
	if _, ok := out["provides"].([]any); !ok {
		out["provides"] = []any{}
	}
	if arr, ok := out["children"].([]any); ok {
		for i, raw := range arr {
			if m, ok := raw.(map[string]any); ok {
				if _, ok := m["dependencies"].([]any); !ok {
					m["dependencies"] = []any{}
				}
				if _, ok := m["provides"].([]any); !ok {
					m["provides"] = []any{}
				}
				arr[i] = m
			}
		}
		out["children"] = arr
	}
}
