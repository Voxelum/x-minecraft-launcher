// Package core — loader detection helpers (port of the TS
// `xmcl-runtime-api/src/entities/version.ts` predicates).
//
// These functions inspect a fully-resolved version (post-inheritance
// merge) and extract the loader-specific version strings the
// renderer's `VersionHeader` carries. They're pure — no IO.

package core

import "strings"

// IsForgeLibrary reports whether `lib` is a Minecraft Forge loader
// library. Mirrors the TS `isForgeLibrary` (group `net.minecraftforge`,
// artifact in `{forge, fmlloader, minecraftforge}`).
func IsForgeLibrary(lib LibraryInfo) bool {
	if lib.GroupID != "net.minecraftforge" {
		return false
	}
	switch lib.ArtifactID {
	case "forge", "fmlloader", "minecraftforge":
		return true
	}
	return false
}

// IsFabricLoaderLibrary identifies the Fabric loader jar.
func IsFabricLoaderLibrary(lib LibraryInfo) bool {
	return lib.GroupID == "net.fabricmc" && lib.ArtifactID == "fabric-loader"
}

// IsQuiltLoaderLibrary identifies the Quilt loader jar.
func IsQuiltLoaderLibrary(lib LibraryInfo) bool {
	return lib.GroupID == "org.quiltmc" && lib.ArtifactID == "quilt-loader"
}

// IsOptifineLibrary identifies the OptiFine library (case differs
// across distributions — the TS reference accepts both spellings).
func IsOptifineLibrary(lib LibraryInfo) bool {
	if lib.GroupID != "optifine" {
		return false
	}
	return lib.ArtifactID == "Optifine" || lib.ArtifactID == "OptiFine"
}

// IsLabyModLibrary identifies the LabyMod loader library.
func IsLabyModLibrary(lib LibraryInfo) bool {
	return lib.GroupID == "net.labymod" && lib.ArtifactID == "LabyMod"
}

// FilterForgeVersion strips the leading `<minecraft>-` prefix Forge
// embeds in its library version, leaving the bare loader version.
// Mirrors the TS `filterForgeVersion`.
func FilterForgeVersion(forgeVersion string) string {
	if forgeVersion == "" {
		return forgeVersion
	}
	if i := strings.Index(forgeVersion, "-"); i >= 0 {
		return forgeVersion[i+1:]
	}
	return forgeVersion
}

// FilterOptifineVersion strips the leading `<minecraft>_` prefix
// OptiFine embeds in its library version. Mirrors the TS
// `filterOptifineVersion`.
func FilterOptifineVersion(optifineVersion string) string {
	if optifineVersion == "" {
		return optifineVersion
	}
	if i := strings.Index(optifineVersion, "_"); i >= 0 {
		return optifineVersion[i+1:]
	}
	return optifineVersion
}

// FindNeoForgedVersion picks the NeoForged loader version out of the
// `--fml.neoForgeVersion`/`--fml.forgeVersion` game-arg pair Mojang's
// pre-merged manifest carries. Mirrors the TS `findNeoForgedVersion`.
func FindNeoForgedVersion(minecraft string, v *ResolvedVersion) string {
	if v == nil {
		return ""
	}
	gameArgs := flatten(v.Arguments.Game)
	if i := indexOf(gameArgs, "--fml.neoForgeVersion"); i != -1 && i+1 < len(gameArgs) {
		return gameArgs[i+1]
	}
	hasNeo := false
	for _, lib := range v.Libraries {
		if lib.GroupID == "net.neoforged.fancymodloader" {
			hasNeo = true
			break
		}
	}
	if !hasNeo {
		return ""
	}
	if i := indexOf(gameArgs, "--fml.forgeVersion"); i != -1 && i+1 < len(gameArgs) {
		return minecraft + "-" + gameArgs[i+1]
	}
	return ""
}

// FindLabyModVersion locates the LabyMod loader's version string.
func FindLabyModVersion(v *ResolvedVersion) string {
	if v == nil {
		return ""
	}
	for _, lib := range v.Libraries {
		if IsLabyModLibrary(lib.LibraryInfo) {
			return lib.Version
		}
	}
	return ""
}

// HeaderLoaders carries the loader versions extracted from a resolved
// version. Mirrors the per-loader fields on the TS `VersionHeader`.
type HeaderLoaders struct {
	Minecraft  string
	Forge      string
	Fabric     string
	Quilt      string
	Optifine   string
	NeoForged  string
	LabyMod    string
	Liteloader string // always empty — LiteLoader port deliberately dropped
}

// ExtractLoaders inspects the resolved version's libraries / args and
// returns every loader version it can identify. The returned values
// are ready to be assigned onto `contract.VersionHeader`.
func ExtractLoaders(v *ResolvedVersion) HeaderLoaders {
	out := HeaderLoaders{}
	if v == nil {
		return out
	}
	out.Minecraft = v.MinecraftVersion
	for _, lib := range v.Libraries {
		switch {
		case IsForgeLibrary(lib.LibraryInfo) && out.Forge == "":
			out.Forge = FilterForgeVersion(lib.Version)
		case IsFabricLoaderLibrary(lib.LibraryInfo) && out.Fabric == "":
			out.Fabric = lib.Version
		case IsQuiltLoaderLibrary(lib.LibraryInfo) && out.Quilt == "":
			out.Quilt = lib.Version
		case IsOptifineLibrary(lib.LibraryInfo) && out.Optifine == "":
			out.Optifine = FilterOptifineVersion(lib.Version)
		case IsLabyModLibrary(lib.LibraryInfo) && out.LabyMod == "":
			out.LabyMod = lib.Version
		}
	}
	out.NeoForged = FindNeoForgedVersion(v.MinecraftVersion, v)
	return out
}

// ============================================================
// helpers
// ============================================================

// flatten reduces a []LaunchArgument to plain strings by ignoring
// rule-gated entries. The renderer's NeoForged / Forge detector only
// looks at the literal arg pairs the manifest carries directly.
func flatten(args []LaunchArgument) []string {
	out := make([]string, 0, len(args))
	for _, a := range args {
		if a.Plain != "" {
			out = append(out, a.Plain)
		}
	}
	return out
}

func indexOf(slice []string, target string) int {
	for i, v := range slice {
		if v == target {
			return i
		}
	}
	return -1
}
