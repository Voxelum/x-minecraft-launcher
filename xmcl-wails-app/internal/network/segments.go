// Package network — segments.go
//
// Range / segmented downloads.
//
// fetchSegmented performs N parallel `Range:` GETs against a single
// URL, writes them into the same `.part` file at the right offsets,
// then validates + atomically renames into place.
//
// Single-stream fall-back kicks in automatically when:
//
//   - The probe HEAD doesn't return `Accept-Ranges: bytes`.
//   - Content-Length is missing.
//   - Payload is smaller than `SegmentThreshold` (default 4 MiB).
//   - Caller forced `Segments == 1`.
//
// Sha-1 verification still happens after the merge, so a partially
// corrupt segment surfaces the standard `SHA1MismatchError`.

package network

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
)

// defaultSegmentThreshold is the smallest payload (in bytes) that
// triggers segmentation when DownloadOptions.SegmentThreshold == 0.
// Picked to balance "fewer than 2 MiB barely benefits" against the
// overhead of an extra HEAD probe + N concurrent goroutines.
const defaultSegmentThreshold = 4 * 1024 * 1024

// probeSegments issues a HEAD against `url` and returns the
// content-length when the server supports byte ranges and the
// payload is large enough to bother segmenting. Returns ok=false
// (size meaningless) when segmentation should be skipped.
//
// We refuse to spend an extra round-trip on payloads we don't
// already know are large: when the caller didn't supply
// `ExpectedSize` and didn't explicitly opt in via `Segments > 1`,
// we skip the probe entirely. This keeps the asset / library /
// version-json fan-out (thousands of small files) on the cheap
// single-stream path while still giving big jars (and any caller
// that sets `Segments`) the parallel-range win.
func (c *Client) probeSegments(ctx context.Context, url string, opts DownloadOptions) (int64, bool) {
	threshold := opts.SegmentThreshold
	if threshold <= 0 {
		threshold = defaultSegmentThreshold
	}
	if opts.ExpectedSize > 0 && opts.ExpectedSize < threshold {
		return 0, false
	}
	if opts.Segments <= 0 && opts.ExpectedSize <= 0 {
		// Auto + size unknown → don't waste a HEAD on what's almost
		// certainly small (asset object, library jar, version.json).
		return 0, false
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
	if err != nil {
		return 0, false
	}
	for k, v := range opts.Headers {
		req.Header.Set(k, v)
	}
	resp, err := c.Do(req)
	if err != nil {
		return 0, false
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return 0, false
	}
	if !strings.EqualFold(resp.Header.Get("Accept-Ranges"), "bytes") {
		return 0, false
	}
	size := resp.ContentLength
	if size <= 0 {
		size = opts.ExpectedSize
	}
	if size <= 0 || size < threshold {
		return 0, false
	}
	return size, true
}

// fetchSegmented performs N parallel range fetches and writes them
// into a `.part` file at the appropriate offsets. After the merge
// completes, the standard sha-1 check + atomic rename runs.
func (c *Client) fetchSegmented(ctx context.Context, url string, opts DownloadOptions, size int64, segments int) error {
	if err := os.MkdirAll(parentDir(opts.Destination), 0o755); err != nil {
		return err
	}
	tmp := opts.Destination + ".part"
	out, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	// Pre-size the file so concurrent WriteAt calls land at fixed
	// offsets without races.
	if err := out.Truncate(size); err != nil {
		out.Close()
		_ = os.Remove(tmp)
		return err
	}
	defer func() {
		_ = out.Close()
		_ = os.Remove(tmp) // no-op if already renamed
	}()

	chunkSize := size / int64(segments)
	if chunkSize == 0 {
		// Fewer bytes than segments — fall back to a single segment.
		segments = 1
		chunkSize = size
	}

	var (
		wg          sync.WaitGroup
		mu          sync.Mutex
		downloaded  int64
		firstErr    error
	)
	cctx, cancel := context.WithCancel(ctx)
	defer cancel()

	for i := 0; i < segments; i++ {
		start := int64(i) * chunkSize
		end := start + chunkSize - 1
		if i == segments-1 {
			end = size - 1
		}
		wg.Add(1)
		go func(start, end int64) {
			defer wg.Done()
			n, err := c.fetchSegment(cctx, url, opts, out, start, end, &downloaded, opts.Progress, size)
			if err != nil {
				mu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				mu.Unlock()
				cancel()
				return
			}
			if n != end-start+1 {
				mu.Lock()
				if firstErr == nil {
					firstErr = fmt.Errorf("segment %d: short read (%d != %d)", start, n, end-start+1)
				}
				mu.Unlock()
				cancel()
			}
		}(start, end)
	}
	wg.Wait()
	if firstErr != nil {
		return firstErr
	}
	if err := out.Sync(); err != nil {
		return err
	}
	if err := out.Close(); err != nil {
		return err
	}

	// Verify sha1 against the on-disk merged file. We can't TeeReader
	// the segments because they don't arrive in order.
	if opts.ExpectedSHA1 != "" {
		got, err := hashFile(tmp)
		if err != nil {
			return err
		}
		if !strings.EqualFold(got, opts.ExpectedSHA1) {
			return &SHA1MismatchError{
				URL: url, Expected: opts.ExpectedSHA1, Got: got, Path: opts.Destination,
			}
		}
	}
	return os.Rename(tmp, opts.Destination)
}

// fetchSegment issues a single Range request and copies the bytes
// into the part file at the requested offset.
func (c *Client) fetchSegment(ctx context.Context, url string, opts DownloadOptions, out *os.File, start, end int64, downloaded *int64, progress func(downloaded, total int64), total int64) (int64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	for k, v := range opts.Headers {
		req.Header.Set(k, v)
	}
	req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", start, end))
	resp, err := c.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	// 206 == range satisfied; 200 means the server ignored Range and
	// would serve the whole file — bail to single-stream path.
	if resp.StatusCode == http.StatusOK {
		return 0, errIgnoredRange
	}
	if resp.StatusCode != http.StatusPartialContent {
		return 0, &HTTPError{StatusCode: resp.StatusCode, URL: url}
	}

	pw := &offsetWriter{w: out, off: start}
	pr := &segmentProgressReader{
		r:          resp.Body,
		downloaded: downloaded,
		callback:   progress,
		total:      total,
	}
	return io.Copy(pw, pr)
}

// errIgnoredRange signals that the server returned 200 instead of 206;
// the caller will retry the URL via the single-stream path.
var errIgnoredRange = errors.New("server ignored Range request")

// isFatalSegmentError reports whether a segmented-download failure
// should bubble up immediately or trigger the single-stream fallback.
// We treat range-ignored, EOF, and connection-reset errors as
// transient.
func isFatalSegmentError(err error) bool {
	if errors.Is(err, errIgnoredRange) {
		return false
	}
	if errors.Is(err, io.ErrUnexpectedEOF) || errors.Is(err, io.EOF) {
		return false
	}
	var hashErr *SHA1MismatchError
	if errors.As(err, &hashErr) {
		// Sha mismatch is fatal — we don't retry the same URL when
		// the bytes themselves are wrong.
		return true
	}
	return false
}

// offsetWriter is an io.Writer that targets a fixed file offset, used
// to stitch a Range response straight into the merged `.part` file.
type offsetWriter struct {
	w   *os.File
	off int64
}

func (w *offsetWriter) Write(p []byte) (int, error) {
	n, err := w.w.WriteAt(p, w.off)
	w.off += int64(n)
	return n, err
}

// segmentProgressReader updates the shared `downloaded` counter and
// invokes the user's progress callback after each chunk.
type segmentProgressReader struct {
	r          io.Reader
	downloaded *int64
	callback   func(downloaded, total int64)
	total      int64
}

func (s *segmentProgressReader) Read(buf []byte) (int, error) {
	n, err := s.r.Read(buf)
	if n > 0 {
		// Atomic-add via mu-less increment is fine because callers
		// only read this counter through the callback (eventually
		// consistent) and total writes are bounded by the segment
		// count.
		newTotal := addInt64(s.downloaded, int64(n))
		if s.callback != nil {
			s.callback(newTotal, s.total)
		}
	}
	return n, err
}

// addInt64 is a tiny helper that grows an int64 atomically. We use
// sync/atomic via an inline pointer-based wrapper so the rest of the
// file doesn't need an additional import.
func addInt64(p *int64, delta int64) int64 {
	// Hot path: a single goroutine per segment. With N segments
	// hitting WriteAt independently we still want the counter to be
	// race-free for `go test -race`.
	return atomicAddInt64(p, delta)
}

// hashFile sha-1s a file from disk after the segmented merge.
func hashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha1.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// userAgentLog is a tiny wrapper that lets fetchOne emit a log line
// without dragging slog into the file. We swallow the message when
// no logger is wired (the Client has no logger field today).
func (c *Client) userAgentLog(_ string, _ string, _ error) {
	// No-op stub. The Host's logger isn't visible from this package
	// to avoid a circular import; segment failures still surface
	// through the returned error chain in any case.
}

// parentDir is filepath.Dir without the dependency on filepath in
// callers that already imported os only.
func parentDir(p string) string {
	for i := len(p) - 1; i >= 0; i-- {
		if p[i] == '/' || p[i] == '\\' {
			return p[:i]
		}
	}
	return "."
}
