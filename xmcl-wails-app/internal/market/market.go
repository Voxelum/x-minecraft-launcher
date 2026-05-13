// Package market wraps the Modrinth v2 and CurseForge v1 REST APIs
// the launcher uses to resolve a marketplace version/file identifier
// into a concrete download URL + hash.
//
// This is the launcher's *bare minimum* market client. The TS port
// has wider surface (search, project metadata, fingerprint matching,
// dependency walks, etc.); we only port the bits the renderer's
// per-domain `installFromMarket` and `installModpackFromMarket`
// invocations actually need.
//
// Conventions:
//
//   - Modrinth: `version-id` → ProjectVersion → primary file (the
//     `.files[]` entry whose `primary == true`, falling back to the
//     first one).
//
//   - CurseForge: `file-id` → File. `downloadUrl` is sometimes nil
//     (the project owner has opted out of the public mirror); fall
//     back to the conventional CDN guess `https://edge.forgecdn.net/files/<head>/<tail>/<name>`.
//
// Both clients accept a `*network.Client` so they share the
// launcher's UA / mirror / retry / segmented-download wiring.
package market

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/network"
)

// File is the resolved-and-normalised file the per-domain installer
// downloads. Both Modrinth and CurseForge file shapes collapse to
// this struct so callers don't have to switch on the source.
type File struct {
	// Filename is the on-disk name (e.g. `sodium-0.4.0.jar`). The
	// caller appends it to `<instance>/<subdir>/`.
	Filename string
	// URLs is the candidate URL chain (primary first, CDN fallbacks
	// after). Pass directly to `network.Client.Download`.
	URLs []string
	// SHA1 / MD5 (lowercase hex). Either may be empty; sha1 is
	// preferred. When both empty the caller should still proceed
	// (best-effort) and rely on size matching.
	SHA1 string
	MD5  string
	// Size is the expected byte length, when published.
	Size int64
	// Icon, if known, is forwarded so the renderer can drop it in
	// the resource icon slot before the post-download metadata
	// scan runs.
	Icon string
	// Provenance fields — surfaced back on the resulting Resource so
	// the renderer can cross-link it to its market page.
	ModrinthProjectID string
	ModrinthVersionID string
	CurseforgeProject int
	CurseforgeFile    int
}

// ============================================================
// Modrinth (v2)
// ============================================================

// DefaultModrinthBaseURL is the launcher's hosted Modrinth proxy.
// The legacy Electron host hits this directly; we keep the hostname
// in case we want to add a mirror later.
const DefaultModrinthBaseURL = "https://api.modrinth.com"

// ModrinthClient is the minimal Modrinth v2 wrapper.
type ModrinthClient struct {
	HTTP    *network.Client
	BaseURL string
}

// NewModrinth constructs a Modrinth client.
func NewModrinth(c *network.Client) *ModrinthClient {
	return &ModrinthClient{HTTP: c, BaseURL: DefaultModrinthBaseURL}
}

// modrinthFileHashes is the polymorphic hash-set on every file entry.
type modrinthFileHashes struct {
	SHA1 string `json:"sha1"`
	MD5  string `json:"md5"`
}

// modrinthFile is one entry in the `files` array.
type modrinthFile struct {
	Hashes   modrinthFileHashes `json:"hashes"`
	URL      string             `json:"url"`
	Filename string             `json:"filename"`
	Primary  bool               `json:"primary"`
	Size     int64              `json:"size"`
}

// modrinthVersion is the relevant subset of `/v2/version/<id>`.
type modrinthVersion struct {
	ID        string         `json:"id"`
	ProjectID string         `json:"project_id"`
	Files     []modrinthFile `json:"files"`
}

// GetVersion fetches a single version by id.
func (c *ModrinthClient) GetVersion(ctx context.Context, id string) (*modrinthVersion, error) {
	if id == "" {
		return nil, errors.New("market: modrinth: empty version id")
	}
	url := c.BaseURL + "/v2/version/" + id
	var v modrinthVersion
	if _, err := c.HTTP.GetJSON(ctx, url, &v); err != nil {
		return nil, fmt.Errorf("modrinth get version %s: %w", id, err)
	}
	return &v, nil
}

// GetVersionsByID is the batch variant: `/v2/versions?ids=[…]`.
func (c *ModrinthClient) GetVersionsByID(ctx context.Context, ids []string) ([]modrinthVersion, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	body, err := json.Marshal(ids)
	if err != nil {
		return nil, err
	}
	url := c.BaseURL + "/v2/versions?ids=" + escape(string(body))
	var out []modrinthVersion
	if _, err := c.HTTP.GetJSON(ctx, url, &out); err != nil {
		return nil, fmt.Errorf("modrinth get versions: %w", err)
	}
	return out, nil
}

// pickModrinthFile mirrors `getModrinthPrimaryFile` from the TS
// reference: prefer the explicit primary file, fall back to the
// first.
func pickModrinthFile(v *modrinthVersion, prefName string) *modrinthFile {
	if v == nil || len(v.Files) == 0 {
		return nil
	}
	if prefName != "" {
		for i := range v.Files {
			if v.Files[i].Filename == prefName {
				return &v.Files[i]
			}
		}
	}
	for i := range v.Files {
		if v.Files[i].Primary {
			return &v.Files[i]
		}
	}
	return &v.Files[0]
}

// ResolveModrinth fetches one version + picks its file. `prefName`
// (optional) is matched against `Filename` first; pass "" to rely on
// the `primary` flag.
func (c *ModrinthClient) ResolveModrinth(ctx context.Context, versionID, prefName, icon string) (*File, error) {
	v, err := c.GetVersion(ctx, versionID)
	if err != nil {
		return nil, err
	}
	f := pickModrinthFile(v, prefName)
	if f == nil {
		return nil, fmt.Errorf("market: modrinth: version %s has no files", versionID)
	}
	return &File{
		Filename:          f.Filename,
		URLs:              []string{f.URL},
		SHA1:              strings.ToLower(f.Hashes.SHA1),
		MD5:               strings.ToLower(f.Hashes.MD5),
		Size:              f.Size,
		Icon:              icon,
		ModrinthProjectID: v.ProjectID,
		ModrinthVersionID: v.ID,
	}, nil
}

// ============================================================
// CurseForge (v1)
// ============================================================

// DefaultCurseforgeBaseURL is the launcher's hosted CurseForge proxy.
const DefaultCurseforgeBaseURL = "https://api.curseforge.com"

// CurseforgeClient wraps the CurseForge v1 API.
type CurseforgeClient struct {
	HTTP    *network.Client
	BaseURL string
	APIKey  string // pass via env (CURSEFORGE_API_KEY) or build-time injection
}

// NewCurseforge constructs a CurseForge client. When `apiKey` is
// empty most endpoints will 401 — the launcher's GitHub Actions
// build pipeline injects the key from a repo secret, the dev build
// reads it from a `.env` file in the same way.
func NewCurseforge(c *network.Client, apiKey string) *CurseforgeClient {
	return &CurseforgeClient{HTTP: c, BaseURL: DefaultCurseforgeBaseURL, APIKey: apiKey}
}

// curseforgeFileHash mirrors `{ algo, value }`. `algo` 1 = sha1,
// 2 = md5.
type curseforgeFileHash struct {
	Value string `json:"value"`
	Algo  int    `json:"algo"`
}

// curseforgeFile is the relevant subset of `/v1/mods/files`.
type curseforgeFile struct {
	ID          int                  `json:"id"`
	ModID       int                  `json:"modId"`
	FileName    string               `json:"fileName"`
	FileLength  int64                `json:"fileLength"`
	DownloadURL string               `json:"downloadUrl"`
	Hashes      []curseforgeFileHash `json:"hashes"`
}

// curseforgeFilesResponse is `{ data: File[] }`.
type curseforgeFilesResponse struct {
	Data []curseforgeFile `json:"data"`
}

// GetFiles batch-loads files by id (`POST /v1/mods/files`).
func (c *CurseforgeClient) GetFiles(ctx context.Context, fileIDs []int) ([]curseforgeFile, error) {
	if len(fileIDs) == 0 {
		return nil, nil
	}
	body, err := json.Marshal(map[string]any{"fileIds": fileIDs})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/v1/mods/files", strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if c.APIKey != "" {
		req.Header.Set("x-api-key", c.APIKey)
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("curseforge get files: %s", resp.Status)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var out curseforgeFilesResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("curseforge get files: %w", err)
	}
	return out.Data, nil
}

// GuessCurseforgeFileURL mirrors the TS `guessCurseforgeFileUrl`
// helper used when a project hides its `downloadUrl`. Splits the file
// id `4500000` into `4500/000/<name>`.
func GuessCurseforgeFileURL(id int, name string) []string {
	s := strconv.Itoa(id)
	if len(s) < 5 {
		// Not enough digits to split — return the conventional CDN
		// path with the full id as the head.
		return []string{
			"https://edge.forgecdn.net/files/" + s + "/" + name,
			"https://mediafiles.forgecdn.net/files/" + s + "/" + name,
		}
	}
	head, tail := s[:4], strings.TrimLeft(s[4:], "0")
	if tail == "" {
		tail = "0"
	}
	return []string{
		"https://edge.forgecdn.net/files/" + head + "/" + tail + "/" + name,
		"https://mediafiles.forgecdn.net/files/" + head + "/" + tail + "/" + name,
	}
}

// ResolveCurseforge fetches a single file by id and normalises it
// into a `*File`.
func (c *CurseforgeClient) ResolveCurseforge(ctx context.Context, fileID int, icon string) (*File, error) {
	files, err := c.GetFiles(ctx, []int{fileID})
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("market: curseforge: no file for id %d", fileID)
	}
	f := files[0]
	urls := []string{}
	if f.DownloadURL != "" {
		urls = append(urls, f.DownloadURL)
	} else {
		urls = append(urls, GuessCurseforgeFileURL(f.ID, f.FileName)...)
	}
	out := &File{
		Filename:          f.FileName,
		URLs:              urls,
		Size:              f.FileLength,
		Icon:              icon,
		CurseforgeProject: f.ModID,
		CurseforgeFile:    f.ID,
	}
	for _, h := range f.Hashes {
		switch h.Algo {
		case 1:
			out.SHA1 = strings.ToLower(h.Value)
		case 2:
			out.MD5 = strings.ToLower(h.Value)
		}
	}
	return out, nil
}

// ============================================================
// Top-level dispatcher
// ============================================================

// Resolver bundles both clients so callers can pass one handle.
type Resolver struct {
	Modrinth   *ModrinthClient
	Curseforge *CurseforgeClient
}

// NewResolver wires both clients off the shared HTTP client. The
// `cfAPIKey` should come from the launcher's runtime config (env
// var `CURSEFORGE_API_KEY`).
func NewResolver(client *network.Client, cfAPIKey string) *Resolver {
	return &Resolver{
		Modrinth:   NewModrinth(client),
		Curseforge: NewCurseforge(client, cfAPIKey),
	}
}

// MarketType mirrors the renderer's enum: 0 = Modrinth, 1 = CurseForge.
const (
	MarketModrinth   = 0
	MarketCurseforge = 1
)

// Resolve unpacks the renderer's `InstallMarketOptions{,WithInstance}`
// payload and turns it into a flat `[]File` (one per requested
// version/file id).
//
// The renderer payload shape (after JSON decode):
//
//	{
//	  "market": 0|1,
//	  "version": <ModrinthVersionIdentifier|[]>,    // when market==0
//	  "file":    <CurseforgeFileIdentifier|[]>,     // when market==1
//	  "instancePath": "..."                         // optional
//	}
func (r *Resolver) Resolve(ctx context.Context, options map[string]any) ([]File, error) {
	market := intOf(options["market"])
	switch market {
	case MarketModrinth:
		entries := normaliseSlice(options["version"])
		out := make([]File, 0, len(entries))
		for _, e := range entries {
			vid := stringOf(e["versionId"])
			if vid == "" {
				continue
			}
			pref := stringOf(e["filename"])
			icon := stringOf(e["icon"])
			f, err := r.Modrinth.ResolveModrinth(ctx, vid, pref, icon)
			if err != nil {
				return out, err
			}
			out = append(out, *f)
		}
		return out, nil
	case MarketCurseforge:
		entries := normaliseSlice(options["file"])
		out := make([]File, 0, len(entries))
		for _, e := range entries {
			id := intOf(e["fileId"])
			if id == 0 {
				continue
			}
			icon := stringOf(e["icon"])
			f, err := r.Curseforge.ResolveCurseforge(ctx, id, icon)
			if err != nil {
				return out, err
			}
			out = append(out, *f)
		}
		return out, nil
	default:
		return nil, fmt.Errorf("market: unknown market type %d", market)
	}
}

// ============================================================
// Tiny helpers
// ============================================================

// normaliseSlice accepts the renderer's polymorphic `T | T[]` shape
// and normalises to `[]map[string]any`.
func normaliseSlice(raw any) []map[string]any {
	switch v := raw.(type) {
	case []any:
		out := make([]map[string]any, 0, len(v))
		for _, item := range v {
			if m, ok := item.(map[string]any); ok {
				out = append(out, m)
			}
		}
		return out
	case map[string]any:
		return []map[string]any{v}
	}
	return nil
}

func intOf(v any) int {
	switch x := v.(type) {
	case int:
		return x
	case int64:
		return int(x)
	case float64:
		return int(x)
	case string:
		if n, err := strconv.Atoi(x); err == nil {
			return n
		}
	}
	return 0
}

func stringOf(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// escape URL-escapes a JSON string literal so it can sit in a query
// param. We handcraft it to avoid pulling in net/url at the top of
// the file (the rest of the package is HTTP-shape-only).
func escape(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch {
		case r == '"' || r == '[' || r == ']' || r == ',' || r == ' ':
			b.WriteByte('%')
			fmt.Fprintf(&b, "%02X", r)
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}
