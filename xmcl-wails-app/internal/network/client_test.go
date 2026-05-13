package network

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// sha1Hex returns the lowercase hex sha1 of the given bytes.
func sha1Hex(b []byte) string {
	h := sha1.New()
	_, _ = io.Copy(h, strings.NewReader(string(b)))
	return hex.EncodeToString(h.Sum(nil))
}

func TestDownload_HappyPath(t *testing.T) {
	body := []byte("hello world")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", fmt.Sprint(len(body)))
		_, _ = w.Write(body)
	}))
	defer srv.Close()

	c := New(Options{Timeout: 5 * time.Second})
	dest := filepath.Join(t.TempDir(), "out.bin")
	err := c.Download(context.Background(), DownloadOptions{
		URLs:         []string{srv.URL},
		Destination:  dest,
		ExpectedSHA1: sha1Hex(body),
		ExpectedSize: int64(len(body)),
	})
	if err != nil {
		t.Fatalf("Download: %v", err)
	}
	got, err := os.ReadFile(dest)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if string(got) != string(body) {
		t.Errorf("body = %q, want %q", got, body)
	}
}

func TestDownload_SkipsWhenSha1Matches(t *testing.T) {
	body := []byte("cached")
	dest := filepath.Join(t.TempDir(), "out.bin")
	if err := os.WriteFile(dest, body, 0o644); err != nil {
		t.Fatal(err)
	}

	var called atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called.Add(1)
		_, _ = w.Write([]byte("DIFFERENT"))
	}))
	defer srv.Close()

	c := New(Options{})
	err := c.Download(context.Background(), DownloadOptions{
		URLs:         []string{srv.URL},
		Destination:  dest,
		ExpectedSHA1: sha1Hex(body),
	})
	if err != nil {
		t.Fatalf("Download: %v", err)
	}
	if called.Load() != 0 {
		t.Error("server should not have been hit when local file already valid")
	}
}

func TestDownload_Sha1Mismatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("bad payload"))
	}))
	defer srv.Close()

	c := New(Options{})
	err := c.Download(context.Background(), DownloadOptions{
		URLs:         []string{srv.URL},
		Destination:  filepath.Join(t.TempDir(), "out.bin"),
		ExpectedSHA1: sha1Hex([]byte("good payload")),
	})
	if err == nil {
		t.Fatal("expected sha1 mismatch error")
	}
	var sm *SHA1MismatchError
	if !errors.As(err, &sm) {
		t.Errorf("expected SHA1MismatchError, got %T", err)
	}
}

func TestDownload_FallbackUrls(t *testing.T) {
	body := []byte("from-second")
	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "no", http.StatusInternalServerError)
	}))
	defer bad.Close()
	good := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(body)
	}))
	defer good.Close()

	c := New(Options{})
	err := c.Download(context.Background(), DownloadOptions{
		URLs:         []string{bad.URL, good.URL},
		Destination:  filepath.Join(t.TempDir(), "out.bin"),
		ExpectedSHA1: sha1Hex(body),
		Retries:      1,
	})
	if err != nil {
		t.Fatalf("Download: %v", err)
	}
}

func TestDownload_HTTPErrorRetries(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) < 3 {
			http.Error(w, "transient", http.StatusInternalServerError)
			return
		}
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	c := New(Options{})
	err := c.Download(context.Background(), DownloadOptions{
		URLs:         []string{srv.URL},
		Destination:  filepath.Join(t.TempDir(), "out.bin"),
		ExpectedSHA1: sha1Hex([]byte("ok")),
		Retries:      4,
	})
	if err != nil {
		t.Fatalf("Download: %v", err)
	}
	if calls.Load() != 3 {
		t.Errorf("expected 3 calls, got %d", calls.Load())
	}
}

func TestStats_TracksRequests(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("body"))
	}))
	defer srv.Close()

	c := New(Options{})
	for i := 0; i < 3; i++ {
		_, err := c.GetJSON(context.Background(), srv.URL, nil)
		if err != nil {
			t.Fatalf("GetJSON: %v", err)
		}
	}
	stats := c.Stats()
	host := strings.TrimPrefix(srv.URL, "http://")
	pool, ok := stats.Pools["http://"+host]
	if !ok {
		t.Fatalf("no pool for host: %+v", stats.Pools)
	}
	if pool.Total < 3 {
		t.Errorf("Total = %d, want >= 3", pool.Total)
	}
	if pool.BytesReceived < int64(len("body"))*3 {
		t.Errorf("BytesReceived = %d, want >= %d", pool.BytesReceived, len("body")*3)
	}
}

func TestDownloadAll_PartialFailure(t *testing.T) {
	good := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	defer good.Close()

	c := New(Options{})
	dir := t.TempDir()
	items := []DownloadOptions{
		{URLs: []string{good.URL}, Destination: filepath.Join(dir, "a"), ExpectedSHA1: sha1Hex([]byte("ok"))},
		{URLs: []string{"http://127.0.0.1:1"}, Destination: filepath.Join(dir, "b"), Retries: 1},
		{URLs: []string{good.URL}, Destination: filepath.Join(dir, "c"), ExpectedSHA1: sha1Hex([]byte("ok"))},
	}
	err := c.DownloadAll(context.Background(), items, 2)
	if err == nil {
		t.Fatal("expected error from broken URL")
	}
	if _, statErr := os.Stat(filepath.Join(dir, "a")); statErr != nil {
		t.Errorf("a should have been written: %v", statErr)
	}
	if _, statErr := os.Stat(filepath.Join(dir, "c")); statErr != nil {
		t.Errorf("c should have been written: %v", statErr)
	}
}
