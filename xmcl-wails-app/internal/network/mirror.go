// Package network — mirror.go
//
// API-set / mirror system that mirrors the TS launcher's behaviour
// (see `xmcl-runtime/settings/settings.ts`):
//
//	apiSetsPreference  ∈ {"" | "mojang" | "bmcl" | <custom>}
//	apiSets            list of {name,url} entries, ordered by user
//	(BMCL default: https://bmclapi2.bangbang93.com)
//
// At download time we build the candidate URL chain by rewriting the
// host (or path prefix) of every Mojang upstream URL onto each mirror.
// The chain is then handed to `Client.Download`, which tries them in
// order until one succeeds.
//
// Coverage matches the TS reference's `getInstallOptions`:
//
//   - Asset objects   → `<mirror>/assets/<bucket>/<hash>`
//   - Library jars    → `<mirror>/maven/<libpath>`
//   - Forge installer → `<mirror>/maven/<libpath>` (forge maven path)
//   - Version JSON    → host swap on Mojang launchermeta URL
//   - Client jar      → host swap on Mojang piston-data URL
//   - Asset index     → host swap on Mojang launchermeta URL
//   - Manifest        → `<mirror>/mc/game/version_manifest.json`
//   - Fabric meta     → `<mirror>/fabric-meta/<path>`
//   - Quilt meta      → `<mirror>/quilt-meta/<path>`
//   - Neoforge maven  → `<mirror>/maven/<libpath>`
//
// `ShouldOverride` mirrors the TS `shouldOverrideApiSet`: pick the
// mirror first when the user explicitly chose one, otherwise fall
// back to "auto" (heuristic GFW detection — see gfw.go).

package network

import (
	"net/url"
	"strings"
)

// DefaultBMCLAPI is the canonical BMCLAPI host. TS reference uses the
// exact same string.
const DefaultBMCLAPI = "https://bmclapi2.bangbang93.com"

// APISet is one entry in the user's api-set list. Mirror order in the
// resolved chain matches the user's preference.
type APISet struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// MirrorPreference is the resolved view of the user's api-set
// settings. Construct via NewMirrorPreference.
type MirrorPreference struct {
	// Preference is the renderer-side `apiSetsPreference` value.
	// "" == auto, otherwise the name of the desired set.
	Preference string
	// Sets is the user's api-set list. Order is the original
	// settings order.
	Sets []APISet
	// InsideGFW reports whether this user is likely behind the GFW.
	// When Preference == "" it tips the auto path toward the mirror.
	InsideGFW bool
}

// NewMirrorPreference normalises a settings snapshot into a
// MirrorPreference. Callers typically pass values straight off
// `contract.Settings`.
func NewMirrorPreference(preference string, sets []APISet, insideGFW bool) MirrorPreference {
	if len(sets) == 0 {
		// Default to BMCLAPI mirror so users behind the GFW get a
		// working chain even before they touch the settings UI.
		sets = []APISet{{Name: "bmcl", URL: DefaultBMCLAPI}}
	}
	return MirrorPreference{Preference: preference, Sets: sets, InsideGFW: insideGFW}
}

// ShouldOverride reports whether mirror URLs should be tried first
// (true) or last (false). Mirrors `shouldOverrideApiSet`.
func (p MirrorPreference) ShouldOverride() bool {
	switch p.Preference {
	case "mojang":
		return false
	case "":
		return p.InsideGFW
	default:
		return true
	}
}

// preferredSets returns the api-set chain in priority order. The
// preferred entry (when set) lands first; the rest follow in their
// original order.
func (p MirrorPreference) preferredSets() []APISet {
	if p.Preference == "" || p.Preference == "mojang" {
		return append([]APISet(nil), p.Sets...)
	}
	out := make([]APISet, 0, len(p.Sets))
	var preferred *APISet
	for i := range p.Sets {
		if p.Sets[i].Name == p.Preference {
			preferred = &p.Sets[i]
			continue
		}
		out = append(out, p.Sets[i])
	}
	if preferred != nil {
		out = append([]APISet{*preferred}, out...)
	}
	return out
}

// ============================================================
// URL rewriters
// ============================================================

// AssetsURLs returns the candidate URLs for an asset object hash.
// `bucket` is the first two characters of the hash.
//
// `mojangFirst` overrides ShouldOverride for tests.
func (p MirrorPreference) AssetsURLs(bucket, hash string) []string {
	if len(hash) < 2 {
		return nil
	}
	mojang := "https://resources.download.minecraft.net/" + bucket + "/" + hash
	mirror := func(base string) string {
		return strings.TrimRight(base, "/") + "/assets/" + bucket + "/" + hash
	}
	return p.chain(mojang, mirror)
}

// LibraryURLs returns the candidate URLs for a Maven library path.
// The Mojang upstream is `https://libraries.minecraft.net/<path>`.
func (p MirrorPreference) LibraryURLs(libPath, originalURL string) []string {
	upstream := originalURL
	if upstream == "" {
		upstream = "https://libraries.minecraft.net/" + libPath
	}
	mirror := func(base string) string {
		return strings.TrimRight(base, "/") + "/maven/" + libPath
	}
	return p.chain(upstream, mirror)
}

// ForgeMavenURLs returns the candidate URLs for a Forge installer jar
// (or any Forge maven artifact). The default upstream is
// `https://maven.minecraftforge.net/<libpath>`.
func (p MirrorPreference) ForgeMavenURLs(libPath string) []string {
	upstream := "https://maven.minecraftforge.net/" + strings.TrimLeft(libPath, "/")
	mirror := func(base string) string {
		return strings.TrimRight(base, "/") + "/maven/" + strings.TrimLeft(libPath, "/")
	}
	return p.chain(upstream, mirror)
}

// NeoForgeMavenURLs is the equivalent for the NeoForged maven. Path
// is the same shape; the upstream just lives at a different domain.
func (p MirrorPreference) NeoForgeMavenURLs(libPath string) []string {
	upstream := "https://maven.neoforged.net/releases/" + strings.TrimLeft(libPath, "/")
	mirror := func(base string) string {
		return strings.TrimRight(base, "/") + "/maven/" + strings.TrimLeft(libPath, "/")
	}
	return p.chain(upstream, mirror)
}

// MojangHostURLs swaps the host of an arbitrary Mojang URL onto each
// mirror. Used for version JSON, asset index JSON, and the client
// jar (`piston-data.mojang.com`).
func (p MirrorPreference) MojangHostURLs(rawURL string) []string {
	if rawURL == "" {
		return nil
	}
	mirror := func(base string) string {
		return rewriteHost(rawURL, base)
	}
	return p.chain(rawURL, mirror)
}

// VersionManifestURLs returns the candidate URLs for the Mojang
// version manifest endpoint.
func (p MirrorPreference) VersionManifestURLs() []string {
	upstream := "https://launchermeta.mojang.com/mc/game/version_manifest.json"
	mirror := func(base string) string {
		return strings.TrimRight(base, "/") + "/mc/game/version_manifest.json"
	}
	return p.chain(upstream, mirror)
}

// FabricMetaURLs rewrites a fabric-meta path onto each mirror. The
// `metaPath` is the part after `https://meta.fabricmc.net`.
//
// e.g. `/v2/versions/loader/1.20.4/0.16.5/profile/json` →
//
//	[<mirror>/fabric-meta/v2/...,
//	 https://meta.fabricmc.net/v2/...]
func (p MirrorPreference) FabricMetaURLs(metaPath string) []string {
	upstream := "https://meta.fabricmc.net" + ensureLeadingSlash(metaPath)
	mirror := func(base string) string {
		return strings.TrimRight(base, "/") + "/fabric-meta" + ensureLeadingSlash(metaPath)
	}
	return p.chain(upstream, mirror)
}

// QuiltMetaURLs is the quilt-meta equivalent of FabricMetaURLs.
func (p MirrorPreference) QuiltMetaURLs(metaPath string) []string {
	upstream := "https://meta.quiltmc.org" + ensureLeadingSlash(metaPath)
	mirror := func(base string) string {
		return strings.TrimRight(base, "/") + "/quilt-meta" + ensureLeadingSlash(metaPath)
	}
	return p.chain(upstream, mirror)
}

// JavaRuntimesURL is a single best-shot URL for the Mojang Java
// runtimes index (only used for early-fetch + parse, not download).
// We honour ShouldOverride by picking either the upstream or the
// mirror as the head of the chain; the rest of the chain is the
// other way around.
func (p MirrorPreference) JavaRuntimesURL() []string {
	upstream := "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json"
	mirror := func(base string) string {
		return strings.TrimRight(base, "/") + "/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json"
	}
	return p.chain(upstream, mirror)
}

// ============================================================
// Internals
// ============================================================

// chain assembles the final URL list using the supplied per-mirror
// rewriter. The Mojang upstream lands first when ShouldOverride ==
// false, last otherwise; duplicates are dropped while preserving
// order.
func (p MirrorPreference) chain(mojangURL string, mirror func(base string) string) []string {
	out := make([]string, 0, len(p.Sets)+1)
	if !p.ShouldOverride() {
		out = appendUnique(out, mojangURL)
	}
	for _, set := range p.preferredSets() {
		if set.URL == "" {
			continue
		}
		out = appendUnique(out, mirror(set.URL))
	}
	if p.ShouldOverride() {
		out = appendUnique(out, mojangURL)
	}
	return out
}

func rewriteHost(rawURL, mirrorURL string) string {
	target, err := url.Parse(mirrorURL)
	if err != nil {
		return rawURL
	}
	src, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	src.Scheme = target.Scheme
	src.Host = target.Host
	if target.Path != "" && target.Path != "/" {
		src.Path = strings.TrimRight(target.Path, "/") + src.Path
	}
	return src.String()
}

func ensureLeadingSlash(s string) string {
	if s == "" {
		return s
	}
	if s[0] != '/' {
		return "/" + s
	}
	return s
}

func appendUnique(slice []string, val string) []string {
	for _, s := range slice {
		if s == val {
			return slice
		}
	}
	return append(slice, val)
}
