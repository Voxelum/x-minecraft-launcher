// schema.go — SQLite tables + idempotent migrations. Mirrors the
// shape declared in packages/resource/schema.ts.

package resource

// Snapshot rows live in the `snapshots` table. DomainedPath is the
// "<domain>/<filename>" key used by the TS reference; we keep the
// same convention so `getSnapshotsUnderDomainedPath('mods')` works
// off a simple LIKE prefix.
type Snapshot struct {
	DomainedPath string
	Ino          int64
	Mtime        int64
	FileType     FileType
	SHA1         string
}

// Stored is the in-memory shape returned by ResourceManager.Get and
// friends. It bundles the snapshot row with the cached metadata,
// icons and uris that the renderer's `Resource` interface expects.
type Stored struct {
	SHA1     string
	Name     string
	FileType FileType
	Mtime    int64
	Ino      int64
	// Metadata is the JSON-decoded blob keyed by domain
	// ("forge", "fabric", "quilt", …). Mirrors the renderer-side
	// `ResourceMetadata` shape so the wire round-trips with no
	// further translation.
	Metadata map[string]any
	Icons    []string
	URIs     []string
	Tags     []string
}

// schemaSQL is the canonical DDL applied by ensureSchema. Each
// statement is idempotent so re-running it during launcher startup
// is cheap and safe. Mirrors the v2.2 schema in the TS reference.
const schemaSQL = `
CREATE TABLE IF NOT EXISTS resources (
    sha1         CHAR(40) PRIMARY KEY,
    sha256       CHAR(64),
    name         VARCHAR NOT NULL DEFAULT '',
    forge        TEXT,
    fabric       TEXT,
    liteloader   TEXT,
    quilt        TEXT,
    neoforge     TEXT,
    resourcepack TEXT,
    save         TEXT,
    shaderpack   TEXT,
    instance     TEXT,
    github       TEXT,
    curseforge   TEXT,
    modrinth     TEXT,
    gitlab       TEXT,
    mmcmodpack   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS resources_sha256_uq
    ON resources(sha256) WHERE sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS uris (
    sha1 CHAR(40) NOT NULL,
    uri  VARCHAR  NOT NULL,
    UNIQUE(sha1, uri)
);
CREATE INDEX IF NOT EXISTS uris_sha1_idx ON uris(sha1);
CREATE INDEX IF NOT EXISTS uris_uri_idx  ON uris(uri);

CREATE TABLE IF NOT EXISTS icons (
    sha1 CHAR(40) NOT NULL,
    icon TEXT     NOT NULL,
    UNIQUE(sha1, icon)
);
CREATE INDEX IF NOT EXISTS icons_sha1_idx ON icons(sha1);

CREATE TABLE IF NOT EXISTS tags (
    sha1 CHAR(40) NOT NULL,
    tag  VARCHAR  NOT NULL,
    UNIQUE(sha1, tag)
);
CREATE INDEX IF NOT EXISTS tags_sha1_idx ON tags(sha1);

CREATE TABLE IF NOT EXISTS snapshots (
    domainedPath VARCHAR PRIMARY KEY,
    ino          INTEGER NOT NULL,
    mtime        INTEGER NOT NULL,
    fileType     VARCHAR NOT NULL,
    sha1         CHAR(40) NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_ino_idx  ON snapshots(ino);
CREATE INDEX IF NOT EXISTS snapshots_sha1_idx ON snapshots(sha1);
`
