// Package authlibinjector implements contract.AuthlibInjectorService.
//
// The service downloads the latest authlib-injector jar from
// https://authlib-injector.yushi.moe/artifact/latest.json and caches
// the manifest at `<gameDataPath>/authlib-injection.json`. The jar
// itself lands at the Maven-conventional path under
// `<gameDataPath>/libraries/` so the launch pipeline (G5) can hand
// it to `-javaagent:`.
package authlibinjector

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/auth"
	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/parsers/core"
)

const (
	manifestURL    = "https://authlib-injector.yushi.moe/artifact/latest.json"
	manifestFile   = "authlib-injection.json"
	libraryGroup   = "org.to2mbn"
	libraryName    = "authlibinjector"
	libraryOrgName = libraryGroup + ":" + libraryName
)

// Service implements contract.AuthlibInjectorService.
type Service struct {
	contract.AuthlibInjectorServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	mu     sync.Mutex
	cancel context.CancelFunc
}

// New constructs the service.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm}
}

var _ contract.AuthlibInjectorService = (*Service)(nil)

// manifest is the shape of the latest.json reply.
type manifest struct {
	Version     string `json:"version"`
	DownloadURL string `json:"download_url"`
	Checksums   struct {
		SHA256 string `json:"sha256"`
	} `json:"checksums"`
}

// IsAuthlibInjectorReady reports whether a usable authlib-injector jar
// is already on disk for the cached manifest version.
func (s *Service) IsAuthlibInjectorReady(_ context.Context) (bool, error) {
	mf, err := s.readManifest()
	if err != nil {
		return false, nil
	}
	libPath := s.libraryPath(mf.Version)
	hash, err := sha256File(libPath)
	if err != nil {
		return false, nil
	}
	return hash == mf.Checksums.SHA256, nil
}

// AbortAuthlibInjectorInstall cancels the in-flight install, if any.
func (s *Service) AbortAuthlibInjectorInstall(_ context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}
	return nil
}

// GetOrInstallAuthlibInjector returns the on-disk path to the latest
// authlib-injector jar, downloading it if missing or stale.
func (s *Service) GetOrInstallAuthlibInjector(ctx context.Context) (string, error) {
	installCtx, cancel := context.WithCancel(ctx)
	s.mu.Lock()
	if s.cancel != nil {
		s.cancel()
	}
	s.cancel = cancel
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		if s.cancel != nil {
			s.cancel = nil
		}
		s.mu.Unlock()
	}()

	mf, err := s.fetchManifest(installCtx)
	if err != nil {
		// Fall back to cached manifest on network error.
		cached, cacheErr := s.readManifest()
		if cacheErr != nil {
			return "", fmt.Errorf("authlib-injector: fetch manifest: %w", err)
		}
		mf = cached
	} else {
		if err := s.writeManifest(mf); err != nil {
			s.host.Logger.Warn("authlib-injector: persist manifest", "err", err)
		}
	}
	return s.download(installCtx, mf)
}

// ============================================================
// Internals
// ============================================================

func (s *Service) libraryPath(version string) string {
	info := core.ParseLibraryName(libraryOrgName + ":" + version)
	return filepath.Join(s.host.MinecraftDataPath, "libraries", filepath.FromSlash(info.Path))
}

func (s *Service) manifestPath() string {
	return filepath.Join(s.host.MinecraftDataPath, manifestFile)
}

func (s *Service) readManifest() (*manifest, error) {
	raw, err := os.ReadFile(s.manifestPath())
	if err != nil {
		return nil, err
	}
	var mf manifest
	if err := json.Unmarshal(raw, &mf); err != nil {
		return nil, err
	}
	if mf.Version == "" {
		return nil, errors.New("authlib-injector: cached manifest missing version")
	}
	return &mf, nil
}

func (s *Service) writeManifest(mf *manifest) error {
	if err := os.MkdirAll(s.host.MinecraftDataPath, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(mf, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.manifestPath() + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.manifestPath())
}

func (s *Service) fetchManifest(ctx context.Context) (*manifest, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, manifestURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := auth.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("authlib-injector manifest: HTTP %d: %s", resp.StatusCode, string(body))
	}
	var mf manifest
	if err := json.Unmarshal(body, &mf); err != nil {
		return nil, err
	}
	if mf.Version == "" || mf.DownloadURL == "" {
		return nil, errors.New("authlib-injector: malformed manifest")
	}
	return &mf, nil
}

func (s *Service) download(ctx context.Context, mf *manifest) (string, error) {
	libPath := s.libraryPath(mf.Version)

	// Already valid?
	if hash, err := sha256File(libPath); err == nil && hash == mf.Checksums.SHA256 {
		return libPath, nil
	}

	if err := os.MkdirAll(filepath.Dir(libPath), 0o755); err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, mf.DownloadURL, nil)
	if err != nil {
		return "", err
	}
	resp, err := auth.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return "", fmt.Errorf("authlib-injector download: HTTP %d: %s", resp.StatusCode, string(body))
	}
	tmp := libPath + ".tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return "", err
	}
	hasher := sha256.New()
	if _, err := io.Copy(io.MultiWriter(f, hasher), resp.Body); err != nil {
		_ = f.Close()
		_ = os.Remove(tmp)
		return "", err
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(tmp)
		return "", err
	}
	if mf.Checksums.SHA256 != "" {
		got := hex.EncodeToString(hasher.Sum(nil))
		if got != mf.Checksums.SHA256 {
			_ = os.Remove(tmp)
			return "", fmt.Errorf("authlib-injector: sha256 mismatch (want %s, got %s)",
				mf.Checksums.SHA256, got)
		}
	}
	if err := os.Rename(tmp, libPath); err != nil {
		return "", err
	}
	return libPath, nil
}

func sha256File(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
