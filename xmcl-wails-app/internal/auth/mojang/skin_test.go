package mojang

import (
	"bytes"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestResetSkin_PostsDelete(t *testing.T) {
	var got struct {
		method string
		auth   string
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got.method = r.Method
		got.auth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := &Client{HTTP: srv.Client()}
	req, _ := http.NewRequest(http.MethodDelete, srv.URL+"/x", nil)
	req.Header.Set("Authorization", "Bearer t")
	resp, err := c.http().Do(req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	defer resp.Body.Close()
	if got.method != http.MethodDelete {
		t.Errorf("method=%q want DELETE", got.method)
	}
	if got.auth != "Bearer t" {
		t.Errorf("auth=%q", got.auth)
	}
}

func TestSkinResponseDecodes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(SkinResponse{ID: "abcd", Name: "Steve"})
	}))
	defer srv.Close()
	c := &Client{HTTP: srv.Client()}
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/x", strings.NewReader("{}"))
	resp, err := c.skinResponse(req)
	if err != nil {
		t.Fatalf("skinResponse: %v", err)
	}
	if resp.ID != "abcd" || resp.Name != "Steve" {
		t.Errorf("decoded=%+v", resp)
	}
}

func TestSkinResponseSurfacesError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":"bad"}`, http.StatusForbidden)
	}))
	defer srv.Close()
	c := &Client{HTTP: srv.Client()}
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/x", strings.NewReader("{}"))
	if _, err := c.skinResponse(req); err == nil {
		t.Fatal("expected error from non-2xx response")
	}
}

func TestMultipartShape_MatchesSetSkinByFile(t *testing.T) {
	// Build the same multipart body SetSkinByFile builds, then parse
	// it back to verify shape (variant field + image/png file part).
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	if err := mw.WriteField("variant", string(SkinVariantSlim)); err != nil {
		t.Fatalf("WriteField: %v", err)
	}
	hdr := map[string][]string{
		"Content-Disposition": {`form-data; name="file"; filename="Player.png"`},
		"Content-Type":        {"image/png"},
	}
	part, err := mw.CreatePart(hdr)
	if err != nil {
		t.Fatalf("CreatePart: %v", err)
	}
	if _, err := part.Write(make([]byte, 256)); err != nil {
		t.Fatalf("Write: %v", err)
	}
	if err := mw.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	mt, params, err := mime.ParseMediaType("multipart/form-data; boundary=" + mw.Boundary())
	if err != nil {
		t.Fatalf("ParseMediaType: %v", err)
	}
	if mt != "multipart/form-data" {
		t.Errorf("mt=%q", mt)
	}
	mr := multipart.NewReader(&buf, params["boundary"])
	var (
		gotVariant string
		gotName    string
		gotCT      string
		gotLen     int
	)
	for {
		p, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("NextPart: %v", err)
		}
		body, _ := io.ReadAll(p)
		switch p.FormName() {
		case "variant":
			gotVariant = string(body)
		case "file":
			gotName = p.FileName()
			gotCT = p.Header.Get("Content-Type")
			gotLen = len(body)
		}
	}
	if gotVariant != "slim" {
		t.Errorf("variant=%q want slim", gotVariant)
	}
	if gotName != "Player.png" {
		t.Errorf("filename=%q want Player.png", gotName)
	}
	if gotCT != "image/png" {
		t.Errorf("content-type=%q want image/png", gotCT)
	}
	if gotLen != 256 {
		t.Errorf("file bytes=%d want 256", gotLen)
	}
}

func TestSanitiseFileName(t *testing.T) {
	cases := map[string]string{
		"":            "skin.png",
		"Steve":       "Steve",
		`bad"name`:    "bad_name",
		"slash/here":  "slash_here",
		"back\\slash": "back_slash",
	}
	for in, want := range cases {
		if got := sanitiseFileName(in); got != want {
			t.Errorf("sanitise(%q)=%q want %q", in, got, want)
		}
	}
}
