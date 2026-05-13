package user

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/voxelum/xmcl/wails/internal/auth/usermodel"
	"github.com/voxelum/xmcl/wails/internal/auth/usertoken"
	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// inMemorySecrets is a SecretStorage backed by a map (avoids touching
// the OS keyring during tests).
type inMemorySecrets struct {
	store map[string]string
}

func newInMemorySecrets() *inMemorySecrets {
	return &inMemorySecrets{store: map[string]string{}}
}

func (s *inMemorySecrets) Get(service, account string) (string, error) {
	v, ok := s.store[service+"/"+account]
	if !ok {
		return "", host.ErrSecretNotFound
	}
	return v, nil
}

func (s *inMemorySecrets) Put(service, account, value string) error {
	s.store[service+"/"+account] = value
	return nil
}

func (s *inMemorySecrets) Delete(service, account string) error {
	delete(s.store, service+"/"+account)
	return nil
}

// newTestService spins up a UserService rooted at a temp dir with
// in-memory secrets. The bridge isn't wired to a Wails app so events
// emitted to the bridge are no-ops — the caller still gets to inspect
// the on-disk state. Callers MUST call svc.Close() (or use t.Cleanup)
// so the embedded yggdrasil server releases its socket before the
// tempdir cleanup runs.
func newTestService(t *testing.T) (*Service, string) {
	t.Helper()
	tmp := t.TempDir()
	h := &host.Host{
		AppDataPath:       tmp,
		MinecraftDataPath: tmp,
		Logger:            slog.New(slog.NewTextHandler(io.Discard, nil)),
		Mutex:             host.NewMutexManager(),
		Secrets:           newInMemorySecrets(),
		Registry:          host.NewRegistry(),
	}
	b := bridge.New(h)
	svc := New(h, b.States())
	t.Cleanup(func() { _ = svc.Close() })
	return svc, tmp
}

func TestLoginOffline_PersistsAndAddsCharacter(t *testing.T) {
	svc, tmp := newTestService(t)
	ctx := context.Background()

	if _, err := svc.Login(ctx, contractLoginOpts("Steve", usertoken.AuthorityDev)); err != nil {
		t.Fatalf("Login: %v", err)
	}

	// Force the debounced saver to flush.
	if err := svc.saver.Flush(); err != nil {
		t.Fatalf("saver flush: %v", err)
	}

	// Disk should have the OFFLINE user with one game profile named Steve.
	raw, err := os.ReadFile(filepath.Join(tmp, "user.json"))
	if err != nil {
		t.Fatalf("read user.json: %v", err)
	}
	if len(raw) == 0 {
		t.Fatalf("user.json empty")
	}
	loaded, err := usermodel.Load(tmp)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	prof, ok := loaded.Users[offlineUserID]
	if !ok {
		t.Fatalf("OFFLINE user missing")
	}
	if prof.Authority != usertoken.AuthorityDev {
		t.Fatalf("authority=%q want %q", prof.Authority, usertoken.AuthorityDev)
	}
	if len(prof.Profiles) != 1 {
		t.Fatalf("expected 1 game profile, got %d", len(prof.Profiles))
	}
	for _, gp := range prof.Profiles {
		if gp.Name != "Steve" {
			t.Errorf("game profile name=%q want Steve", gp.Name)
		}
	}
}

func TestLoginOffline_TwoCharactersOneUser(t *testing.T) {
	svc, _ := newTestService(t)
	ctx := context.Background()

	if _, err := svc.Login(ctx, contractLoginOpts("Steve", usertoken.AuthorityDev)); err != nil {
		t.Fatalf("Login Steve: %v", err)
	}
	if _, err := svc.Login(ctx, contractLoginOpts("Alex", usertoken.AuthorityDev)); err != nil {
		t.Fatalf("Login Alex: %v", err)
	}

	prof := svc.file.Users[offlineUserID]
	if len(prof.Profiles) != 2 {
		t.Fatalf("expected 2 game profiles, got %d", len(prof.Profiles))
	}
}

func TestRemoveUserGameProfile_Offline(t *testing.T) {
	svc, _ := newTestService(t)
	ctx := context.Background()

	if _, err := svc.Login(ctx, contractLoginOpts("Steve", usertoken.AuthorityDev)); err != nil {
		t.Fatalf("Login: %v", err)
	}
	prof := svc.file.Users[offlineUserID]
	var firstGameID string
	for k := range prof.Profiles {
		firstGameID = k
		break
	}
	userMap := profileToMap(prof)
	if err := svc.RemoveUserGameProfile(ctx, userMap, firstGameID); err != nil {
		t.Fatalf("RemoveUserGameProfile: %v", err)
	}
	if _, ok := svc.file.Users[offlineUserID].Profiles[firstGameID]; ok {
		t.Errorf("game profile %s still present", firstGameID)
	}
}

func TestRemoveUserGameProfile_RejectsNonOffline(t *testing.T) {
	svc, _ := newTestService(t)
	ctx := context.Background()
	if _, err := svc.GetUserState(ctx); err != nil {
		t.Fatalf("GetUserState: %v", err)
	}
	bogus := map[string]any{
		"id":        "abc",
		"authority": usertoken.AuthorityMicrosoft,
	}
	err := svc.RemoveUserGameProfile(ctx, bogus, "xyz")
	if err == nil {
		t.Fatal("expected error for non-offline removal, got nil")
	}
}

func TestGetSupportedAuthorityMetadata_Builtins(t *testing.T) {
	svc, _ := newTestService(t)
	ctx := context.Background()
	// Bootstrap so the yggdrasil registry loads (defaults will fail to
	// fetch in offline tests; that's fine — we only assert builtins).
	if _, err := svc.GetUserState(ctx); err != nil {
		t.Fatalf("GetUserState: %v", err)
	}
	metas, err := svc.GetSupportedAuthorityMetadata(ctx)
	if err != nil {
		t.Fatalf("GetSupportedAuthorityMetadata: %v", err)
	}
	if len(metas) < 2 {
		t.Fatalf("want >=2 metadata entries, got %d", len(metas))
	}
	saw := map[string]bool{}
	for _, m := range metas {
		saw[m.Authority] = true
	}
	if !saw[usertoken.AuthorityMicrosoft] {
		t.Error("missing Microsoft authority")
	}
	if !saw[usertoken.AuthorityDev] {
		t.Error("missing Dev authority")
	}
}

// contractLoginOpts builds a contract.LoginOptions with the Properties
// nil so the offline path uses the deterministic UUID.
func contractLoginOpts(username, authority string) contract.LoginOptions {
	return contract.LoginOptions{Username: username, Authority: authority}
}

func TestUploadSkin_OfflineUpdatesTextures(t *testing.T) {
	svc, _ := newTestService(t)
	ctx := context.Background()

	if _, err := svc.Login(ctx, contractLoginOpts("Steve", usertoken.AuthorityDev)); err != nil {
		t.Fatalf("Login: %v", err)
	}
	prof := svc.file.Users[offlineUserID]
	var gameID string
	for k := range prof.Profiles {
		gameID = k
	}

	skinURL := "https://example.com/slim.png"
	cape := "https://example.com/cape.png"
	if err := svc.UploadSkin(ctx, contract.UploadSkinOptions{
		UserId:        offlineUserID,
		GameProfileId: &gameID,
		Skin:          map[string]any{"url": skinURL, "slim": true},
		Cape:          &cape,
	}); err != nil {
		t.Fatalf("UploadSkin: %v", err)
	}

	gp := svc.file.Users[offlineUserID].Profiles[gameID]
	if gp.Textures.SKIN.URL != skinURL {
		t.Errorf("skin url=%q want %q", gp.Textures.SKIN.URL, skinURL)
	}
	if gp.Textures.SKIN.Metadata["model"] != "slim" {
		t.Errorf("expected slim model metadata, got %+v", gp.Textures.SKIN.Metadata)
	}
	if gp.Textures.CAPE == nil || gp.Textures.CAPE.URL != cape {
		t.Errorf("cape=%+v want url=%q", gp.Textures.CAPE, cape)
	}
}

func TestUploadSkin_OfflineResetCape(t *testing.T) {
	svc, _ := newTestService(t)
	ctx := context.Background()

	if _, err := svc.Login(ctx, contractLoginOpts("Steve", usertoken.AuthorityDev)); err != nil {
		t.Fatalf("Login: %v", err)
	}
	prof := svc.file.Users[offlineUserID]
	var gameID string
	for k := range prof.Profiles {
		gameID = k
	}
	// First set a cape so we have something to clear.
	cape := "https://example.com/cape.png"
	if err := svc.UploadSkin(ctx, contract.UploadSkinOptions{
		UserId:        offlineUserID,
		GameProfileId: &gameID,
		Cape:          &cape,
	}); err != nil {
		t.Fatalf("UploadSkin set cape: %v", err)
	}
	// Now reset.
	empty := ""
	if err := svc.UploadSkin(ctx, contract.UploadSkinOptions{
		UserId:        offlineUserID,
		GameProfileId: &gameID,
		Cape:          &empty,
	}); err != nil {
		t.Fatalf("UploadSkin reset cape: %v", err)
	}
	gp := svc.file.Users[offlineUserID].Profiles[gameID]
	if gp.Textures.CAPE != nil {
		t.Errorf("cape should be cleared, got %+v", gp.Textures.CAPE)
	}
}

func TestParseSkinPayload(t *testing.T) {
	cases := []struct {
		name     string
		raw      map[string]any
		wantPres bool
		wantRst  bool
		wantErr  bool
	}{
		{"nil = no change", nil, false, false, false},
		{"empty = reset", map[string]any{}, true, true, false},
		{"happy", map[string]any{"url": "https://x", "slim": true}, true, false, false},
		{"missing url errors", map[string]any{"slim": true}, false, false, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, p, r, err := parseSkinPayload(c.raw)
			if c.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if p != c.wantPres || r != c.wantRst {
				t.Errorf("present=%v reset=%v want %v %v", p, r, c.wantPres, c.wantRst)
			}
		})
	}
}

func TestNormaliseSkinSource(t *testing.T) {
	if _, _, err := normaliseSkinSource(""); err == nil {
		t.Error("empty url should error")
	}
	src, isURL, err := normaliseSkinSource("https://example.com/skin.png")
	if err != nil || !isURL {
		t.Fatalf("https case: err=%v isURL=%v", err, isURL)
	}
	if src.url != "https://example.com/skin.png" {
		t.Errorf("url=%q", src.url)
	}
	if _, _, err := normaliseSkinSource("ftp://nope"); err == nil {
		t.Error("ftp scheme should error")
	}

	// file:// path round-trip
	tmp := filepath.Join(t.TempDir(), "x.png")
	if err := os.WriteFile(tmp, []byte("png-bytes"), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	src, isURL, err = normaliseSkinSource("file://" + tmp)
	if err != nil || isURL {
		t.Fatalf("file case: err=%v isURL=%v", err, isURL)
	}
	if string(src.bytes) != "png-bytes" {
		t.Errorf("bytes=%q", string(src.bytes))
	}
}
