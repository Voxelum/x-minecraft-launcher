package market

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/voxelum/xmcl/wails/internal/network"
)

func newClientForTest(t *testing.T) *network.Client {
	t.Helper()
	return network.New(network.Options{})
}

func TestModrinthResolveVersion(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/v2/version/") {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":         "v1",
			"project_id": "p1",
			"files": []map[string]any{
				{
					"hashes":   map[string]any{"sha1": "AABB", "md5": "CCDD"},
					"url":      "https://cdn.example/sodium-0.4.0.jar",
					"filename": "sodium-0.4.0.jar",
					"primary":  true,
					"size":     1234,
				},
				{
					"hashes":   map[string]any{"sha1": "1111"},
					"url":      "https://cdn.example/secondary.jar",
					"filename": "secondary.jar",
					"size":     999,
				},
			},
		})
	}))
	defer srv.Close()

	c := &ModrinthClient{HTTP: newClientForTest(t), BaseURL: srv.URL}
	f, err := c.ResolveModrinth(context.Background(), "v1", "", "icon-url")
	if err != nil {
		t.Fatalf("ResolveModrinth: %v", err)
	}
	if f.Filename != "sodium-0.4.0.jar" {
		t.Fatalf("filename: %q", f.Filename)
	}
	if f.SHA1 != "aabb" {
		t.Fatalf("sha1 lowercased: %q", f.SHA1)
	}
	if f.Size != 1234 {
		t.Fatalf("size: %d", f.Size)
	}
	if f.Icon != "icon-url" || f.ModrinthVersionID != "v1" || f.ModrinthProjectID != "p1" {
		t.Fatalf("provenance: %+v", f)
	}

	// preferred filename overrides primary
	f2, err := c.ResolveModrinth(context.Background(), "v1", "secondary.jar", "")
	if err != nil {
		t.Fatalf("preferred: %v", err)
	}
	if f2.Filename != "secondary.jar" || f2.URLs[0] != "https://cdn.example/secondary.jar" {
		t.Fatalf("preferred picked wrong file: %+v", f2)
	}
}

func TestCurseforgeResolveFile(t *testing.T) {
	got := struct {
		path   string
		hdr    string
		body   string
		method string
	}{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got.path = r.URL.Path
		got.hdr = r.Header.Get("x-api-key")
		got.method = r.Method
		body, _ := io.ReadAll(r.Body)
		got.body = string(body)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{
				{
					"id":          7654321,
					"modId":       42,
					"fileName":    "jei.jar",
					"fileLength":  9999,
					"downloadUrl": "https://cdn.example/jei.jar",
					"hashes": []map[string]any{
						{"value": "BEEF", "algo": 1},
						{"value": "FEED", "algo": 2},
					},
				},
			},
		})
	}))
	defer srv.Close()

	c := &CurseforgeClient{HTTP: newClientForTest(t), BaseURL: srv.URL, APIKey: "secret-key"}
	f, err := c.ResolveCurseforge(context.Background(), 7654321, "")
	if err != nil {
		t.Fatalf("ResolveCurseforge: %v", err)
	}
	if got.path != "/v1/mods/files" || got.method != http.MethodPost {
		t.Fatalf("upstream call: %+v", got)
	}
	if got.hdr != "secret-key" {
		t.Fatalf("api key not forwarded: %q", got.hdr)
	}
	if !strings.Contains(got.body, "7654321") {
		t.Fatalf("body: %q", got.body)
	}
	if f.Filename != "jei.jar" || f.URLs[0] != "https://cdn.example/jei.jar" {
		t.Fatalf("file: %+v", f)
	}
	if f.SHA1 != "beef" || f.MD5 != "feed" {
		t.Fatalf("hashes: sha1=%q md5=%q", f.SHA1, f.MD5)
	}
	if f.CurseforgeProject != 42 || f.CurseforgeFile != 7654321 {
		t.Fatalf("provenance: %+v", f)
	}
}

func TestCurseforgeFallbackURLOnNoDownloadURL(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{
				{
					"id":          4500123,
					"modId":       42,
					"fileName":    "stuff.jar",
					"fileLength":  100,
					"downloadUrl": "",
					"hashes":      []any{},
				},
			},
		})
	}))
	defer srv.Close()
	c := &CurseforgeClient{HTTP: newClientForTest(t), BaseURL: srv.URL}
	f, err := c.ResolveCurseforge(context.Background(), 4500123, "")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	want := []string{
		"https://edge.forgecdn.net/files/4500/123/stuff.jar",
		"https://mediafiles.forgecdn.net/files/4500/123/stuff.jar",
	}
	if len(f.URLs) != 2 || f.URLs[0] != want[0] || f.URLs[1] != want[1] {
		t.Fatalf("fallback urls: %+v", f.URLs)
	}
}

func TestGuessCurseforgeFileURL(t *testing.T) {
	tests := []struct {
		id   int
		name string
		want []string
	}{
		{4500123, "x.jar", []string{
			"https://edge.forgecdn.net/files/4500/123/x.jar",
			"https://mediafiles.forgecdn.net/files/4500/123/x.jar",
		}},
		// trailing zeros in tail get trimmed
		{4500000, "y.jar", []string{
			"https://edge.forgecdn.net/files/4500/0/y.jar",
			"https://mediafiles.forgecdn.net/files/4500/0/y.jar",
		}},
	}
	for _, tt := range tests {
		got := GuessCurseforgeFileURL(tt.id, tt.name)
		if len(got) != 2 || got[0] != tt.want[0] || got[1] != tt.want[1] {
			t.Fatalf("id=%d got=%v want=%v", tt.id, got, tt.want)
		}
	}
}

func TestResolverDispatcher(t *testing.T) {
	mod := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":         "v",
			"project_id": "p",
			"files": []map[string]any{
				{"hashes": map[string]any{"sha1": "abc"}, "url": "https://cdn/x.jar", "filename": "x.jar", "primary": true, "size": 1},
			},
		})
	}))
	defer mod.Close()
	cf := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{
				{"id": 1, "modId": 2, "fileName": "y.jar", "downloadUrl": "https://cdn/y.jar", "fileLength": 3, "hashes": []map[string]any{{"value": "DEAD", "algo": 1}}},
			},
		})
	}))
	defer cf.Close()
	r := &Resolver{
		Modrinth:   &ModrinthClient{HTTP: newClientForTest(t), BaseURL: mod.URL},
		Curseforge: &CurseforgeClient{HTTP: newClientForTest(t), BaseURL: cf.URL},
	}

	// modrinth path
	files, err := r.Resolve(context.Background(), map[string]any{
		"market":  float64(MarketModrinth),
		"version": []any{map[string]any{"versionId": "v"}},
	})
	if err != nil {
		t.Fatalf("modrinth resolve: %v", err)
	}
	if len(files) != 1 || files[0].Filename != "x.jar" {
		t.Fatalf("modrinth files: %+v", files)
	}
	// curseforge path
	files, err = r.Resolve(context.Background(), map[string]any{
		"market": float64(MarketCurseforge),
		"file":   map[string]any{"fileId": float64(1)},
	})
	if err != nil {
		t.Fatalf("curseforge resolve: %v", err)
	}
	if len(files) != 1 || files[0].Filename != "y.jar" {
		t.Fatalf("curseforge files: %+v", files)
	}
	// unknown market
	if _, err := r.Resolve(context.Background(), map[string]any{"market": float64(7)}); err == nil {
		t.Fatalf("expected error on unknown market")
	}
}
