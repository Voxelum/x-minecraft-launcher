package network

import (
	"context"
	"crypto/rand"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
)

// fixture creates a 5 MiB random blob — large enough to clear the
// 4 MiB segmentation threshold so probeSegments fires.
func makeFixture(t *testing.T, size int) ([]byte, string) {
	t.Helper()
	body := make([]byte, size)
	if _, err := rand.Read(body); err != nil {
		t.Fatalf("rand: %v", err)
	}
	h := sha1.New()
	h.Write(body)
	return body, hex.EncodeToString(h.Sum(nil))
}

// rangeServer serves the body with full Range support + counts how
// many GETs vs HEADs vs partial requests it received.
type rangeServer struct {
	body     []byte
	heads    int32
	getsFull int32
	gets206  int32
}

func (s *rangeServer) handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Accept-Ranges", "bytes")
		w.Header().Set("Content-Length", strconv.Itoa(len(s.body)))
		if r.Method == http.MethodHead {
			atomic.AddInt32(&s.heads, 1)
			w.WriteHeader(http.StatusOK)
			return
		}
		rng := r.Header.Get("Range")
		if rng == "" {
			atomic.AddInt32(&s.getsFull, 1)
			w.WriteHeader(http.StatusOK)
			w.Write(s.body)
			return
		}
		// parse "bytes=START-END"
		var start, end int64
		if _, err := fmt.Sscanf(rng, "bytes=%d-%d", &start, &end); err != nil {
			http.Error(w, "bad range", http.StatusRequestedRangeNotSatisfiable)
			return
		}
		atomic.AddInt32(&s.gets206, 1)
		w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, len(s.body)))
		w.Header().Set("Content-Length", strconv.Itoa(int(end-start+1)))
		w.WriteHeader(http.StatusPartialContent)
		w.Write(s.body[start : end+1])
	}
}

func TestSegmentedDownload_ParallelRange(t *testing.T) {
	const size = 5 * 1024 * 1024
	body, sum := makeFixture(t, size)
	srv := &rangeServer{body: body}
	ts := httptest.NewServer(srv.handler())
	defer ts.Close()

	dst := filepath.Join(t.TempDir(), "blob.bin")
	c := New(Options{})
	if err := c.Download(context.Background(), DownloadOptions{
		URLs:         []string{ts.URL + "/blob"},
		Destination:  dst,
		ExpectedSHA1: sum,
		Segments:     4,
	}); err != nil {
		t.Fatalf("Download: %v", err)
	}

	got, err := os.ReadFile(dst)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if len(got) != size {
		t.Fatalf("size: got %d want %d", len(got), size)
	}
	if hex.EncodeToString(sha1Sum(got)) != sum {
		t.Fatalf("sha1 mismatch")
	}
	heads := atomic.LoadInt32(&srv.heads)
	gets206 := atomic.LoadInt32(&srv.gets206)
	getsFull := atomic.LoadInt32(&srv.getsFull)
	if heads < 1 {
		t.Errorf("expected at least one HEAD probe; got %d", heads)
	}
	if gets206 != 4 {
		t.Errorf("expected 4 partial GETs; got %d", gets206)
	}
	if getsFull != 0 {
		t.Errorf("did not expect a full GET; got %d", getsFull)
	}
}

func TestSegmentedDownload_FallsBackWhenServerIgnoresRange(t *testing.T) {
	const size = 5 * 1024 * 1024
	body, sum := makeFixture(t, size)
	// Server advertises Accept-Ranges but actually responds with 200
	// to ranged GETs. The downloader should retry as single-stream.
	var heads, gets int32
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Accept-Ranges", "bytes")
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		if r.Method == http.MethodHead {
			atomic.AddInt32(&heads, 1)
			w.WriteHeader(http.StatusOK)
			return
		}
		atomic.AddInt32(&gets, 1)
		w.WriteHeader(http.StatusOK)
		w.Write(body)
	}))
	defer ts.Close()

	dst := filepath.Join(t.TempDir(), "blob.bin")
	c := New(Options{})
	if err := c.Download(context.Background(), DownloadOptions{
		URLs:         []string{ts.URL + "/blob"},
		Destination:  dst,
		ExpectedSHA1: sum,
		Segments:     4,
	}); err != nil {
		t.Fatalf("Download: %v", err)
	}
	if got, _ := os.ReadFile(dst); hex.EncodeToString(sha1Sum(got)) != sum {
		t.Fatalf("sha1 mismatch on fallback")
	}
}

func TestSegmentedDownload_SmallFileSkipsSegmentation(t *testing.T) {
	body, sum := makeFixture(t, 1024) // well below threshold
	srv := &rangeServer{body: body}
	ts := httptest.NewServer(srv.handler())
	defer ts.Close()

	dst := filepath.Join(t.TempDir(), "blob.bin")
	c := New(Options{})
	if err := c.Download(context.Background(), DownloadOptions{
		URLs:         []string{ts.URL + "/blob"},
		Destination:  dst,
		ExpectedSHA1: sum,
	}); err != nil {
		t.Fatalf("Download: %v", err)
	}
	if atomic.LoadInt32(&srv.gets206) != 0 {
		t.Errorf("did not expect a partial GET for a small file")
	}
	if atomic.LoadInt32(&srv.getsFull) != 1 {
		t.Errorf("expected exactly 1 full GET; got %d", srv.getsFull)
	}
}

func TestSegmentedDownload_SegmentsOneForcesSingleStream(t *testing.T) {
	body, sum := makeFixture(t, 5*1024*1024)
	srv := &rangeServer{body: body}
	ts := httptest.NewServer(srv.handler())
	defer ts.Close()

	dst := filepath.Join(t.TempDir(), "blob.bin")
	c := New(Options{})
	if err := c.Download(context.Background(), DownloadOptions{
		URLs:         []string{ts.URL + "/blob"},
		Destination:  dst,
		ExpectedSHA1: sum,
		Segments:     1,
	}); err != nil {
		t.Fatalf("Download: %v", err)
	}
	if atomic.LoadInt32(&srv.gets206) != 0 {
		t.Errorf("Segments=1 should never fan out; got %d ranged GETs", srv.gets206)
	}
}

func TestDownload_FallbackBetweenURLs(t *testing.T) {
	body, sum := makeFixture(t, 1024)
	failing := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "no", http.StatusInternalServerError)
	}))
	defer failing.Close()
	working := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Write(body)
	}))
	defer working.Close()

	dst := filepath.Join(t.TempDir(), "blob.bin")
	c := New(Options{})
	err := c.Download(context.Background(), DownloadOptions{
		URLs: []string{
			failing.URL + "/x",
			working.URL + "/x",
		},
		Destination:  dst,
		ExpectedSHA1: sum,
		Retries:      1, // don't retry the failing URL forever
	})
	if err != nil {
		t.Fatalf("Download: %v", err)
	}
}

// sha1Sum is a tiny test helper so we don't pull in crypto/sha1 every
// time at the call site.
func sha1Sum(b []byte) []byte {
	h := sha1.New()
	h.Write(b)
	return h.Sum(nil)
}

// stripScheme is a no-op kept as documentation for what's needed when
// porting these tests against TLS in a follow-up.
var _ = strings.HasPrefix
var _ = io.EOF
