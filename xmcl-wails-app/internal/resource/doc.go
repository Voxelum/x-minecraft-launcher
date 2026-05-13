// Package resource ports xmcl-runtime/resource + packages/resource to
// Go.
//
// Responsibilities:
//
//   - Persist a SQLite-backed catalogue of every file the launcher
//     has scanned (mods, resourcepacks, shaderpacks, saves, generic
//     resources). The catalogue is keyed by sha1 so the same file
//     installed in multiple instances reuses one parse.
//
//   - Maintain a "snapshot" fast-path: `(domainedPath, ino, mtime) →
//     sha1, fileType`. A subsequent scan that finds an unchanged
//     inode + mtime skips re-hashing and re-parsing entirely.
//
//   - Run the loader-specific parsers (modparser / resourcepack /
//     gamedata) on demand and cache the structured metadata + icon
//     URIs alongside the sha1.
//
//   - Surface keyword search across installed resources for the
//     renderer's `InstanceModsService.searchInstalled`.
//
//   - Surface URI ↔ sha1 reverse-lookups so installers can turn an
//     upstream Modrinth/CurseForge download URL into the on-disk
//     hash without re-hashing.
//
// SQLite schema (see schema.go for the verbatim DDL):
//
//   resources(sha1 PK, name, ... metadata JSON columns ...)
//   uris      (sha1, uri, UNIQUE(sha1, uri))
//   icons     (sha1, icon, UNIQUE(sha1, icon))
//   tags      (sha1, tag, UNIQUE(sha1, tag))
//   snapshots (domainedPath PK, ino, mtime, fileType, sha1)
//
// Mirrors `packages/resource/schema.ts` and the migrations in
// `xmcl-runtime/resource/pluginResourceWorker.ts`.
package resource

// Domain mirrors `packages/resource/ResourceDomain.ts`.
type Domain string

const (
	DomainMods          Domain = "mods"
	DomainResourcePacks Domain = "resourcepacks"
	DomainShaderPacks   Domain = "shaderpacks"
	DomainSaves         Domain = "saves"
	DomainServers       Domain = "servers"
	DomainModpacks      Domain = "modpacks"
	DomainUnclassified  Domain = "unclassified"
)

// FileType is the loader/format classification stored on each
// snapshot row. Mirrors `packages/resource/ResourceType.ts` plus
// `directory` / `archive` / `unknown` for unrecognised entries.
type FileType string

const (
	FileTypeForge        FileType = "forge"
	FileTypeNeoforge     FileType = "neoforge"
	FileTypeFabric       FileType = "fabric"
	FileTypeQuilt        FileType = "quilt"
	FileTypeLiteloader   FileType = "liteloader"
	FileTypeResourcePack FileType = "resourcepack"
	FileTypeShaderPack   FileType = "shaderpack"
	FileTypeSave         FileType = "save"
	FileTypeModpack      FileType = "modpack"
	FileTypeDirectory    FileType = "directory"
	FileTypeUnknown      FileType = "unknown"
)
