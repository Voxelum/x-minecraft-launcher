// Package modparser ports `@xmcl/mod-parser` to Go.
//
// Reads metadata for the major Minecraft mod loader formats:
//
//   - Fabric (`fabric.mod.json`)
//   - Quilt   (`quilt.mod.json`)
//   - Forge / NeoForge (`META-INF/mods.toml`, `META-INF/MANIFEST.MF`,
//     and the legacy `mcmod.info` / `cccmod.info` / `neimod.info`)
//
// The TS reference also handles LiteLoader (`litemod.json`) and runs a
// JVM-bytecode (ASM) scan to recover the `@Mod` annotation when no
// metadata file is present. Both are **deliberately omitted** from the
// Go port:
//
//   - LiteLoader is end-of-life and not surfaced by the renderer.
//   - The ASM scan is far afield from the launcher's core domain;
//     metadata-less mods will surface as "unknown loader" in the UI.
//
// Inputs are accepted as either a file path (on-disk jar) or a
// pre-opened `*zip.Reader`. Loose-on-disk mod folders are not
// supported; no production caller needs them.
package modparser

import (
	"archive/zip"
	"errors"
	"io"
	"os"
)

// ============================================================
// Common helpers
// ============================================================

// JarSource is the read target — either a file path or a pre-opened
// `*zip.Reader`. Use `OpenJar` to construct the latter from disk.
type JarSource struct {
	Path   string
	Reader *zip.Reader

	// closer keeps the underlying file alive while the reader is in use.
	closer io.Closer
}

// OpenJar opens the file at `path` as a zip and returns a JarSource
// the caller is responsible for closing via [JarSource.Close].
func OpenJar(path string) (*JarSource, error) {
	r, err := zip.OpenReader(path)
	if err != nil {
		return nil, err
	}
	return &JarSource{Path: path, Reader: &r.Reader, closer: r}, nil
}

// Close releases the underlying file handle, if any. Safe to call
// on a JarSource that wraps an externally-managed zip.
func (j *JarSource) Close() error {
	if j == nil || j.closer == nil {
		return nil
	}
	err := j.closer.Close()
	j.closer = nil
	return err
}

// readEntry returns the bytes of `name` from j, or os.ErrNotExist
// when the entry is missing.
func (j *JarSource) readEntry(name string) ([]byte, error) {
	return j.ReadEntry(name)
}

// ReadEntry returns the bytes of the file named `name` from the
// archive (e.g. for an in-jar `logo.png` icon). Returns
// `os.ErrNotExist` when the entry is absent.
func (j *JarSource) ReadEntry(name string) ([]byte, error) {
	if j == nil || j.Reader == nil {
		return nil, errors.New("modparser: nil JarSource")
	}
	for _, f := range j.Reader.File {
		if f.Name != name {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		defer rc.Close()
		return io.ReadAll(rc)
	}
	return nil, os.ErrNotExist
}

// hasEntry reports whether the named file exists in the archive.
func (j *JarSource) hasEntry(name string) bool {
	return j.HasEntry(name)
}

// HasEntry reports whether the archive contains an entry with the
// given path. Accepts forward-slash separators (the zip on-disk form).
func (j *JarSource) HasEntry(name string) bool {
	if j == nil || j.Reader == nil {
		return false
	}
	for _, f := range j.Reader.File {
		if f.Name == name {
			return true
		}
	}
	return false
}

// stripBOM trims the leading UTF-8 byte-order mark some Java tooling
// emits at the head of text resources. Mirrors the TS reference's
// `replace(/^\uFEFF/, '')` calls before each JSON.parse.
func stripBOM(data []byte) []byte {
	if len(data) >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
		return data[3:]
	}
	return data
}
