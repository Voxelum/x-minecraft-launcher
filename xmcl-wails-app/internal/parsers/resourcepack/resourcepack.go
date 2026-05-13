// Package resourcepack ports the public read surface of
// `@xmcl/resourcepack`. It exposes:
//
//   - `ReadPackMeta`            → pack.mcmeta `pack` block
//   - `ReadIcon`                → pack.png bytes (nil + os.ErrNotExist when absent)
//   - `ReadPackMetaAndIcon`     → both at once
//
// The TS package also ships `ResourcePack` / `ResourceManager` /
// `ModelLoader` for in-game asset resolution. Those are renderer-side
// in keystone-ui (model rendering happens via deepslate / three.js)
// and don't need a Go counterpart.
package resourcepack

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"io"
	"os"
)

// PackMeta is the `pack` block of `pack.mcmeta`. The full file allows
// `texture`, `animation`, `language` blocks too — added on demand.
type PackMeta struct {
	PackFormat  int `json:"pack_format"`
	// Description is `string | object` per the schema. Leave as `any` so
	// the renderer can still narrow it.
	Description any `json:"description"`
}

// PackMetaAndIcon bundles the two read-paths most callers want.
type PackMetaAndIcon struct {
	Metadata PackMeta
	Icon     []byte // nil when absent
}

// Source is a resource-pack archive. Use OpenSource to construct one
// from disk; close with Close.
type Source struct {
	Reader *zip.Reader

	closer io.Closer
}

// OpenSource opens the file at `path` as a zip and returns a Source.
func OpenSource(path string) (*Source, error) {
	r, err := zip.OpenReader(path)
	if err != nil {
		return nil, err
	}
	return &Source{Reader: &r.Reader, closer: r}, nil
}

// Close releases the underlying file handle, if any.
func (s *Source) Close() error {
	if s == nil || s.closer == nil {
		return nil
	}
	err := s.closer.Close()
	s.closer = nil
	return err
}

func (s *Source) readEntry(name string) ([]byte, error) {
	if s == nil || s.Reader == nil {
		return nil, errors.New("resourcepack: nil Source")
	}
	for _, f := range s.Reader.File {
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

// ReadPackMeta loads the `pack` block from `pack.mcmeta`.
func ReadPackMeta(s *Source) (PackMeta, error) {
	raw, err := s.readEntry("pack.mcmeta")
	if err != nil {
		return PackMeta{}, err
	}
	raw = stripBOM(raw)

	var root struct {
		Pack *PackMeta `json:"pack"`
	}
	if err := json.Unmarshal(raw, &root); err != nil {
		return PackMeta{}, errors.New("resourcepack: pack.mcmeta: " + err.Error())
	}
	if root.Pack == nil {
		return PackMeta{}, errors.New("resourcepack: pack.mcmeta missing 'pack' block")
	}
	return *root.Pack, nil
}

// ReadIcon returns the bytes of `pack.png`, or os.ErrNotExist when
// the archive doesn't carry one.
func ReadIcon(s *Source) ([]byte, error) {
	return s.readEntry("pack.png")
}

// ReadPackMetaAndIcon convenience-loads both. A missing icon does NOT
// fail the call; the Icon field is left nil instead.
func ReadPackMetaAndIcon(s *Source) (PackMetaAndIcon, error) {
	meta, err := ReadPackMeta(s)
	if err != nil {
		return PackMetaAndIcon{}, err
	}
	out := PackMetaAndIcon{Metadata: meta}
	if icon, err := ReadIcon(s); err == nil {
		out.Icon = icon
	}
	return out, nil
}

func stripBOM(data []byte) []byte {
	if len(data) >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
		return data[3:]
	}
	return data
}
