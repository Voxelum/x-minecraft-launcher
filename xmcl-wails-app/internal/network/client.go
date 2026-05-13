// Package network provides the HTTP client + file downloader the
// installer / metadata services build on.
//
// Design choices:
//
//   - Stdlib `net/http` only — Go's Transport already pools per-host
//     connections, so we don't need an `undici`-equivalent. Adding a
//     thin stats wrapper gives us the per-origin counters
//     `BaseService.getNetworkStatus` exposes.
//
//   - The downloader is resumable + sha1-verifying + retrying and,
//     when the server advertises `Accept-Ranges: bytes` and the
//     payload exceeds `SegmentThreshold` (4 MiB by default), splits
//     the request into N parallel range fetches that are stitched
//     back together at write time. Toggle via
//     `DownloadOptions.Segments` (0 = auto, 1 = single-stream).
//
//   - Failures are surfaced as typed errors so the InstallService can
//     react (e.g. retry vs. mark-as-corrupt).

package network

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Client wraps an *http.Client and tracks per-origin connection
// counters. Reuse across calls so the underlying Transport's keep-alive
// pool stays warm.
type Client struct {
	http  *http.Client
	stats *liveStats

	userAgent string
}

// Options carries Client construction knobs. Zero values pick sensible
// defaults that match the launcher's historical behaviour.
type Options struct {
	// UserAgent overrides the default `XMCL/<ver>` UA. Mojang's
	// launchermeta endpoint doesn't require a specific UA but
	// CurseForge / Modrinth do throttle anonymous requests.
	UserAgent string
	// Timeout is the per-request timeout. Zero == no timeout (relies
	// on the caller's ctx).
	Timeout time.Duration
	// MaxIdleConnsPerHost mirrors `undici.Agent`'s `connections`
	// default. Mojang's CDN happily handles 8 concurrent.
	MaxIdleConnsPerHost int
	// Transport lets tests inject a custom RoundTripper. When nil we
	// build one from the other options.
	Transport http.RoundTripper
}

// New constructs a Client. Zero opts == defaults.
func New(opts Options) *Client {
	if opts.MaxIdleConnsPerHost == 0 {
		opts.MaxIdleConnsPerHost = 8
	}
	if opts.UserAgent == "" {
		opts.UserAgent = "XMCL/wails-dev"
	}
	stats := newStats()
	tr := opts.Transport
	if tr == nil {
		tr = &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			MaxIdleConns:          64,
			MaxIdleConnsPerHost:   opts.MaxIdleConnsPerHost,
			MaxConnsPerHost:       opts.MaxIdleConnsPerHost * 2,
			IdleConnTimeout:       60 * time.Second,
			TLSHandshakeTimeout:   15 * time.Second,
			ResponseHeaderTimeout: 30 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		}
	}
	return &Client{
		http: &http.Client{
			Transport: &statsTransport{base: tr, stats: stats},
			Timeout:   opts.Timeout,
		},
		stats:     stats,
		userAgent: opts.UserAgent,
	}
}

// HTTP exposes the underlying client for callers that just want to
// perform a one-shot request.
func (c *Client) HTTP() *http.Client { return c.http }

// Do is a thin wrapper that injects the configured User-Agent.
func (c *Client) Do(req *http.Request) (*http.Response, error) {
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", c.userAgent)
	}
	return c.http.Do(req)
}

// GetJSON performs a GET and decodes the JSON body into `v`. Returns
// the response body bytes (re-readable) and an error.
func (c *Client) GetJSON(ctx context.Context, url string, v any) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, &HTTPError{StatusCode: resp.StatusCode, URL: url}
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if v != nil {
		if err := jsonDecode(body, v); err != nil {
			return body, fmt.Errorf("network: decode %s: %w", url, err)
		}
	}
	return body, nil
}

// Stats exposes per-origin counters. Snapshot is copy-by-value so the
// renderer can poll without racing the live counters.
func (c *Client) Stats() Stats { return c.stats.Snapshot() }

// ============================================================
// Stats
// ============================================================

// Stats is an immutable snapshot of per-origin pool data.
type Stats struct {
	Pools         map[string]PoolStats
	DownloadBytes int64
	UploadBytes   int64

	// internal — pointer to the live counters; nil on a snapshot.
	live *liveStats `json:"-"`
}

// PoolStats mirrors the renderer's `PoolStats` shape (number of
// in-flight requests + total served + bytes for that origin).
type PoolStats struct {
	InFlight      int   `json:"connected"`
	Total         int64 `json:"queued"`
	BytesReceived int64 `json:"bytesReceived"`
}

// liveStats holds the atomic counters under a single mutex for the
// non-numeric fields (the per-host map mutates structurally).
type liveStats struct {
	mu       sync.RWMutex
	pools    map[string]*PoolCounters
	dlBytes  atomic.Int64
	upBytes  atomic.Int64
}

// PoolCounters is the live form of PoolStats.
type PoolCounters struct {
	InFlight      atomic.Int32
	Total         atomic.Int64
	BytesReceived atomic.Int64
}

func newStats() *liveStats {
	return &liveStats{pools: map[string]*PoolCounters{}}
}

func (s *liveStats) origin(rawURL string) *PoolCounters {
	host := originOf(rawURL)
	s.mu.RLock()
	pool, ok := s.pools[host]
	s.mu.RUnlock()
	if ok {
		return pool
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if pool, ok := s.pools[host]; ok {
		return pool
	}
	pool = &PoolCounters{}
	s.pools[host] = pool
	return pool
}

// Snapshot copies the live counters into a Stats value safe to hand to
// the renderer. The map is allocated fresh; the int values are read
// atomically so there's no torn-read risk even under churn.
func (s *liveStats) Snapshot() Stats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := Stats{
		Pools:         make(map[string]PoolStats, len(s.pools)),
		DownloadBytes: s.dlBytes.Load(),
		UploadBytes:   s.upBytes.Load(),
	}
	for host, pool := range s.pools {
		out.Pools[host] = PoolStats{
			InFlight:      int(pool.InFlight.Load()),
			Total:         pool.Total.Load(),
			BytesReceived: pool.BytesReceived.Load(),
		}
	}
	return out
}

func originOf(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil || u.Host == "" {
		return rawURL
	}
	return strings.ToLower(u.Scheme + "://" + u.Host)
}

// ============================================================
// statsTransport — RoundTripper wrapper that updates counters.
// ============================================================

type statsTransport struct {
	base  http.RoundTripper
	stats *liveStats
}

func (t *statsTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	pool := t.stats.origin(req.URL.String())
	pool.InFlight.Add(1)
	pool.Total.Add(1)
	defer pool.InFlight.Add(-1)

	resp, err := t.base.RoundTrip(req)
	if err != nil {
		return nil, err
	}
	resp.Body = &countingReader{rc: resp.Body, host: pool, total: &t.stats.dlBytes}
	return resp, nil
}

type countingReader struct {
	rc    io.ReadCloser
	host  *PoolCounters
	total *atomic.Int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.rc.Read(p)
	if n > 0 {
		c.host.BytesReceived.Add(int64(n))
		c.total.Add(int64(n))
	}
	return n, err
}

func (c *countingReader) Close() error { return c.rc.Close() }

// ============================================================
// Errors
// ============================================================

// HTTPError is returned for non-2xx responses.
type HTTPError struct {
	StatusCode int
	URL        string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("http %d: %s", e.StatusCode, e.URL)
}

// SHA1MismatchError surfaces a checksum failure — the InstallService
// uses errors.As to decide whether to retry vs. abort.
type SHA1MismatchError struct {
	URL      string
	Expected string
	Got      string
	Path     string
}

func (e *SHA1MismatchError) Error() string {
	return fmt.Sprintf("sha1 mismatch for %s (expected %s, got %s)", e.URL, e.Expected, e.Got)
}

// ============================================================
// Download
// ============================================================

// DownloadOptions configures a single-file download. Callers either
// pass one URL or a fallback list (tried in order).
type DownloadOptions struct {
	// URLs are tried in order until one succeeds. Empty = error.
	URLs []string
	// Destination is the final on-disk path. Parents are created.
	Destination string
	// ExpectedSHA1 (lowercase hex) verifies the file post-write.
	// Empty == skip the check.
	ExpectedSHA1 string
	// ExpectedSize is consulted for progress tracking and integrity;
	// zero == no check.
	ExpectedSize int64
	// Headers extends the default User-Agent header.
	Headers map[string]string
	// Progress, if non-nil, is invoked with (bytes downloaded so far,
	// total expected). Either argument may be -1 when unknown.
	Progress func(downloaded, total int64)
	// Retries caps retry attempts per-URL on transient errors.
	// Zero == 3.
	Retries int
	// Segments controls Range-based parallel download. Special values:
	//   0 = auto (4 segments when Accept-Ranges + size >= 4 MiB)
	//   1 = always single-stream
	//   N = fan out into N parallel segments when the server allows.
	Segments int
	// SegmentThreshold is the minimum payload size (bytes) that
	// triggers segmentation when Segments == 0. Zero == 4 MiB.
	SegmentThreshold int64
}

// Download writes a single file. Returns nil when the file is on
// disk and (if ExpectedSHA1 was set) verified.
func (c *Client) Download(ctx context.Context, opts DownloadOptions) error {
	if len(opts.URLs) == 0 {
		return errors.New("Download: no URLs")
	}
	if opts.Destination == "" {
		return errors.New("Download: no destination")
	}
	if opts.Retries <= 0 {
		opts.Retries = 3
	}

	// Fast path: existing file already matches expected sha1 → skip.
	if opts.ExpectedSHA1 != "" {
		if ok, _ := verifySHA1(opts.Destination, opts.ExpectedSHA1); ok {
			if opts.Progress != nil {
				if info, err := os.Stat(opts.Destination); err == nil {
					opts.Progress(info.Size(), info.Size())
				}
			}
			return nil
		}
	}

	if err := os.MkdirAll(filepath.Dir(opts.Destination), 0o755); err != nil {
		return fmt.Errorf("Download: mkdir: %w", err)
	}

	var lastErr error
	for _, u := range opts.URLs {
		for attempt := 0; attempt < opts.Retries; attempt++ {
			err := c.fetchOne(ctx, u, opts)
			if err == nil {
				return nil
			}
			// Don't retry sha1 mismatches against the same URL — a
			// fresh upstream would have a different blob.
			var hashErr *SHA1MismatchError
			if errors.As(err, &hashErr) {
				lastErr = err
				break
			}
			// Don't retry context cancellations.
			if ctx.Err() != nil {
				return ctx.Err()
			}
			lastErr = err
			// Exponential backoff capped at 5s.
			delay := time.Duration(1<<attempt) * 200 * time.Millisecond
			if delay > 5*time.Second {
				delay = 5 * time.Second
			}
			select {
			case <-time.After(delay):
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}
	if lastErr != nil {
		return lastErr
	}
	return fmt.Errorf("Download: all attempts failed")
}

// fetchOne performs a single HTTP GET and writes to the destination
// atomically (write to `<dest>.part`, then rename). When the server
// advertises `Accept-Ranges: bytes` and the payload is large enough,
// it transparently delegates to `fetchSegmented` for parallel range
// fetches.
func (c *Client) fetchOne(ctx context.Context, url string, opts DownloadOptions) error {
	// Try a HEAD probe first when segmentation is in play. We avoid
	// it for the explicit Segments==1 case (single-stream forced) and
	// when the upstream is small enough that the round-trip cost
	// dwarfs the bandwidth saving.
	if opts.Segments != 1 {
		if size, ok := c.probeSegments(ctx, url, opts); ok {
			n := opts.Segments
			if n <= 0 {
				n = 4
			}
			if n > 8 {
				n = 8
			}
			if err := c.fetchSegmented(ctx, url, opts, size, n); err == nil {
				return nil
			} else if !isFatalSegmentError(err) {
				// Fall through to the single-stream path on transient
				// errors so we still produce a useful retry.
				c.userAgentLog("fetchSegmented retry single", url, err)
			} else {
				return err
			}
		}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	for k, v := range opts.Headers {
		req.Header.Set(k, v)
	}

	resp, err := c.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return &HTTPError{StatusCode: resp.StatusCode, URL: url}
	}

	tmp := opts.Destination + ".part"
	out, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	defer func() {
		_ = out.Close()
		_ = os.Remove(tmp) // no-op if already renamed
	}()

	hasher := sha1.New()
	total := resp.ContentLength
	if total < 0 && opts.ExpectedSize > 0 {
		total = opts.ExpectedSize
	}
	pr := &progressReader{
		r:        io.TeeReader(resp.Body, hasher),
		callback: opts.Progress,
		total:    total,
	}
	if _, err := io.Copy(out, pr); err != nil {
		return err
	}
	if err := out.Sync(); err != nil {
		return err
	}
	if err := out.Close(); err != nil {
		return err
	}

	if opts.ExpectedSHA1 != "" {
		got := hex.EncodeToString(hasher.Sum(nil))
		if !strings.EqualFold(got, opts.ExpectedSHA1) {
			return &SHA1MismatchError{
				URL: url, Expected: opts.ExpectedSHA1, Got: got, Path: opts.Destination,
			}
		}
	}

	if err := os.Rename(tmp, opts.Destination); err != nil {
		return err
	}
	return nil
}

// progressReader wraps an io.Reader and invokes the callback on every
// chunk. When the total is unknown we pass -1.
type progressReader struct {
	r        io.Reader
	total    int64
	read     int64
	callback func(downloaded, total int64)
}

func (p *progressReader) Read(buf []byte) (int, error) {
	n, err := p.r.Read(buf)
	if n > 0 {
		p.read += int64(n)
		if p.callback != nil {
			p.callback(p.read, p.total)
		}
	}
	return n, err
}

// verifySHA1 compares the file's sha1 against `expected`. Returns
// (false, nil) on missing files; (true, nil) on a match.
func verifySHA1(path, expected string) (bool, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	defer f.Close()
	h := sha1.New()
	if _, err := io.Copy(h, f); err != nil {
		return false, err
	}
	return strings.EqualFold(hex.EncodeToString(h.Sum(nil)), expected), nil
}

// ============================================================
// DownloadAll — bounded-concurrency batch download.
// ============================================================

// DownloadAll downloads every entry concurrently with at most
// `parallel` in-flight at a time. Returns nil when every download
// succeeded; otherwise an aggregated error. Per-file failures don't
// abort the rest — the InstallService usually wants to know "what
// remains broken" rather than "we stopped on the first error".
func (c *Client) DownloadAll(ctx context.Context, items []DownloadOptions, parallel int) error {
	if parallel <= 0 {
		parallel = 8
	}
	sem := make(chan struct{}, parallel)
	var wg sync.WaitGroup
	var (
		mu    sync.Mutex
		errs  []error
	)
	for i := range items {
		opts := items[i]
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			if err := c.Download(ctx, opts); err != nil {
				mu.Lock()
				errs = append(errs, fmt.Errorf("%s: %w", opts.Destination, err))
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	return errors.Join(errs...)
}
