// Package user implements contract.UserService.
//
// Persistence layout (mirrors xmcl-runtime/user/UserService.ts):
//
//   - `<appDataPath>/user.json`     — user profiles (no secrets)
//   - `<appDataPath>/yggdrasil.json` — registered authlib-injector services
//   - OS keyring (`xmcl/<authority-key>/<userId>`) — auth tokens
//
// Auth flows implemented in this G7 cut:
//
//   - Offline (`x://dev`)              — full
//   - Yggdrasil / authlib-injector     — password grant only
//   - Microsoft (`x://microsoft`)      — device-code grant only
//
// Skin upload, refresh-against-Mojang, Microsoft auth-code flow, and
// LoginModrinth are deferred — they need either multipart upload
// support or the MSAL token cache, neither of which the renderer
// blocks on for first launch.
package user

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/pkg/browser"

	"github.com/voxelum/xmcl/wails/internal/auth"
	"github.com/voxelum/xmcl/wails/internal/auth/authcallback"
	"github.com/voxelum/xmcl/wails/internal/auth/littleskin"
	microauth "github.com/voxelum/xmcl/wails/internal/auth/microsoft"
	modrinthauth "github.com/voxelum/xmcl/wails/internal/auth/modrinth"
	mojangapi "github.com/voxelum/xmcl/wails/internal/auth/mojang"
	"github.com/voxelum/xmcl/wails/internal/auth/offline"
	"github.com/voxelum/xmcl/wails/internal/auth/usermodel"
	"github.com/voxelum/xmcl/wails/internal/auth/usertoken"
	"github.com/voxelum/xmcl/wails/internal/auth/yggdrasil"
	"github.com/voxelum/xmcl/wails/internal/auth/yggregistry"
	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/yggserver"
)

const (
	stateID         = "UserService"
	offlineUserID   = "OFFLINE"
	clientTokenSlot = "_clientToken_"

	// authCodeRedirectAddr is the loopback host:port the launcher's
	// Microsoft OAuth registration whitelists for the auth-code grant.
	// Mirrors xmcl-runtime/user/pluginOfficialUserApi.ts (which falls
	// back to 25555 when app.serverPort is not set).
	authCodeRedirectAddr = "127.0.0.1:25555"
	authCodeRedirectPath = "/auth"
	authCodeRedirectURL  = "http://localhost:25555/auth"
	authCodeTimeout      = 5 * time.Minute

	// Modrinth OAuth — must match the redirect_uri configured for the
	// `GFz0B21y` Modrinth application.
	modrinthRedirectAddr    = "127.0.0.1:25555"
	modrinthRedirectPath    = "/modrinth-auth"
	modrinthRedirectURL     = "http://127.0.0.1:25555/modrinth-auth"
	modrinthCallbackTimeout = 5 * time.Minute
	modrinthSecretService   = "modrinth"
	modrinthSecretAccount   = "MODRINTH_USER"
)

// Service implements contract.UserService.
type Service struct {
	contract.UserServiceNotImplemented

	host      *host.Host
	states    *bridge.StateManager
	events    *contract.UserServiceEvents
	tokens    *usertoken.Store
	yggreg    *yggregistry.Registry
	microsoft *microauth.Client
	mojang    *mojangapi.Client
	modrinth  *modrinthauth.Client

	once    sync.Once
	loadErr error

	mu      sync.Mutex
	state   *bridge.SharedState
	payload *contract.UserState

	saver *usermodel.Saver
	file  *usermodel.File

	ygg *yggserver.Server

	clientToken string

	loginCancel   context.CancelFunc
	refreshCancel context.CancelFunc
}

// New constructs a UserService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	s := &Service{
		host:      h,
		states:    sm,
		events:    contract.NewUserServiceEvents(sm.Bridge()),
		tokens:    usertoken.New(h.Secrets),
		yggreg:    yggregistry.New(h.AppDataPath),
		microsoft: microauth.NewClient(),
		mojang:    mojangapi.NewClient(),
		modrinth:  modrinthauth.NewClient(),
		saver:     usermodel.NewSaver(h.AppDataPath),
	}
	// Stash for reuse from sibling services (OfficialUser/LittleSkin).
	host.Set(h.Registry, s.tokens)
	host.Set(h.Registry, s.yggreg)
	return s
}

var _ contract.UserService = (*Service)(nil)

// ============================================================
// Hooks for renderer-driven mutations on the UserState
// ============================================================

func init() {
	contract.ApplyUserState_UserData = func(p *contract.UserState, value map[string]any) {
		if v, ok := value["users"].(map[string]any); ok {
			p.Users = v
			return
		}
		p.Users = value
	}
	contract.ApplyUserState_UserProfile = func(p *contract.UserState, value any) {
		if value == nil {
			return
		}
		m, ok := value.(map[string]any)
		if !ok {
			return
		}
		id, _ := m["id"].(string)
		if id == "" {
			return
		}
		if p.Users == nil {
			p.Users = map[string]any{}
		}
		p.Users[id] = m
	}
	contract.ApplyUserState_UserProfileRemove = func(p *contract.UserState, id string) {
		if p.Users != nil {
			delete(p.Users, id)
		}
	}
	contract.ApplyUserState_GameProfileUpdate = func(p *contract.UserState, value map[string]any) {
		userID, _ := value["userId"].(string)
		profile, _ := value["profile"].(map[string]any)
		if userID == "" || profile == nil {
			return
		}
		userMap, ok := p.Users[userID].(map[string]any)
		if !ok {
			return
		}
		profiles, _ := userMap["profiles"].(map[string]any)
		if profiles == nil {
			profiles = map[string]any{}
			userMap["profiles"] = profiles
		}
		profID, _ := profile["id"].(string)
		if profID == "" {
			return
		}
		profiles[profID] = profile
	}
}

// ============================================================
// Public contract methods
// ============================================================

// GetUserState returns the live UserState SharedState. Triggers the
// one-shot disk load on first call.
func (s *Service) GetUserState(ctx context.Context) (*bridge.SharedState, error) {
	s.once.Do(func() { s.loadErr = s.bootstrap(ctx) })
	if s.loadErr != nil {
		return nil, s.loadErr
	}
	return s.state, nil
}

func (s *Service) bootstrap(ctx context.Context) error {
	if err := s.yggreg.Load(ctx); err != nil {
		s.host.Logger.Warn("user: load yggdrasil registry", "err", err)
	}
	f, err := usermodel.Load(s.host.AppDataPath)
	if err != nil {
		return fmt.Errorf("user: load user.json: %w", err)
	}
	s.file = f

	// Persist a stable client token across runs (used for Yggdrasil
	// /authenticate). Stored under the dev authority slot, account
	// `_clientToken_` to avoid clashing with real users.
	if tok, _ := s.tokens.Get(usertoken.AuthorityDev, clientTokenSlot); tok != "" {
		s.clientToken = tok
	} else {
		s.clientToken = offline.NewToken()
		_ = s.tokens.Put(usertoken.AuthorityDev, clientTokenSlot, s.clientToken)
	}

	users := map[string]any{}
	for id, p := range f.Users {
		users[id] = profileToMap(p)
	}

	s.payload = &contract.UserState{Users: users}
	s.state = contract.RegisterUserState(s.states, stateID, s.payload)

	// Spin up the embedded Yggdrasil server for offline / peer
	// accounts. The base URL is published via host.Registry so the
	// LaunchService can pass it to authlib-injector via
	// `-Dauthlibinjector.yggdrasil.prefetched`.
	ygg := yggserver.New(s.lookupGameProfile)
	if base, err := ygg.Start("127.0.0.1:0"); err != nil {
		s.host.Logger.Warn("user: yggdrasil server failed to start", "err", err)
	} else {
		s.host.Logger.Info("user: yggdrasil server up", "base", base)
		s.ygg = ygg
		host.Set(s.host.Registry, ygg)
	}
	return nil
}

// Close stops the embedded Yggdrasil server so callers (tests, app
// shutdown) can release the listener cleanly.
func (s *Service) Close() error {
	if s.ygg != nil {
		return s.ygg.Close()
	}
	return nil
}

// lookupGameProfile is the lookup callback passed to the embedded
// yggdrasil server. Searches every stored user (offline first, since
// that's the most common case) for a game profile matching the
// supplied id, dashed UUID, or username.
func (s *Service) lookupGameProfile(_ context.Context, idOrName string) *yggserver.Profile {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.file == nil {
		return nil
	}
	target := strings.ReplaceAll(strings.ToLower(idOrName), "-", "")
	tryUser := func(p usermodel.Profile) *yggserver.Profile {
		for _, gp := range p.Profiles {
			compact := strings.ReplaceAll(strings.ToLower(gp.ID), "-", "")
			if compact == target || strings.EqualFold(gp.Name, idOrName) {
				return gameProfileToYgg(gp)
			}
		}
		return nil
	}
	if off, ok := s.file.Users[offlineUserID]; ok {
		if p := tryUser(off); p != nil {
			return p
		}
	}
	for id, prof := range s.file.Users {
		if id == offlineUserID {
			continue
		}
		if p := tryUser(prof); p != nil {
			return p
		}
	}
	return nil
}

func gameProfileToYgg(gp usermodel.GameProfile) *yggserver.Profile {
	out := &yggserver.Profile{
		ID:   strings.ReplaceAll(gp.ID, "-", ""),
		Name: gp.Name,
	}
	if gp.Textures.SKIN.URL != "" {
		out.Textures.SKIN = &yggserver.Texture{
			URL:      gp.Textures.SKIN.URL,
			Metadata: gp.Textures.SKIN.Metadata,
		}
	}
	if gp.Textures.CAPE != nil && gp.Textures.CAPE.URL != "" {
		out.Textures.CAPE = &yggserver.Texture{
			URL:      gp.Textures.CAPE.URL,
			Metadata: gp.Textures.CAPE.Metadata,
		}
	}
	if gp.Textures.ELYTRA != nil && gp.Textures.ELYTRA.URL != "" {
		out.Textures.ELYTRA = &yggserver.Texture{
			URL:      gp.Textures.ELYTRA.URL,
			Metadata: gp.Textures.ELYTRA.Metadata,
		}
	}
	return out
}

// HasModrinthToken reports whether a non-expired Modrinth OAuth
// token is on file. Mirrors `getModrinthAccessToken` in the TS
// reference: tokens are stored as `Token` JSON under
// keyring `(modrinth, MODRINTH_USER)`. Tokens missing the issuance
// stamp are treated as still-valid (let the API call fail naturally).
func (s *Service) HasModrinthToken(_ context.Context) (bool, error) {
	tok, ok, err := s.modrinthToken()
	if err != nil {
		return false, nil
	}
	if !ok {
		return false, nil
	}
	return tok.Valid(time.Now().UnixMilli()), nil
}

// modrinthToken loads + decodes the persisted Modrinth token. Returns
// `(zero, false, nil)` when no token has been stored yet.
func (s *Service) modrinthToken() (modrinthauth.Token, bool, error) {
	raw, err := s.host.Secrets.Get(modrinthSecretService, modrinthSecretAccount)
	if err != nil || raw == "" {
		return modrinthauth.Token{}, false, nil
	}
	var tok modrinthauth.Token
	if err := json.Unmarshal([]byte(raw), &tok); err != nil {
		return modrinthauth.Token{}, false, fmt.Errorf("decode modrinth token: %w", err)
	}
	return tok, true, nil
}

// LoginModrinth runs the OAuth code-grant flow against Modrinth.
// `invalidate=true` forces a fresh consent page even when a valid
// token is on disk (matches the TS impl).
func (s *Service) LoginModrinth(ctx context.Context, invalidate bool) error {
	if !invalidate {
		if tok, ok, _ := s.modrinthToken(); ok && tok.Valid(time.Now().UnixMilli()) {
			return nil
		}
	}

	listener, err := authcallback.Start(modrinthRedirectAddr, modrinthRedirectPath, "", "")
	if err != nil {
		return fmt.Errorf("LoginModrinth: %w (port %s busy?)", err, modrinthRedirectAddr)
	}
	defer listener.Close()

	authURL := modrinthauth.BuildAuthorizeURL(modrinthRedirectURL, modrinthauth.DefaultScopes)
	s.events.EmitMicrosoftAuthorizeUrl(authURL) // renderer reuses the same channel for the URL display
	if err := browser.OpenURL(authURL); err != nil {
		s.host.Logger.Warn("LoginModrinth: open browser failed", "url", authURL, "err", err)
	}

	waitCtx, cancel := context.WithTimeout(ctx, modrinthCallbackTimeout)
	defer cancel()
	res, err := listener.Wait(waitCtx)
	if err != nil {
		return fmt.Errorf("LoginModrinth: %w", err)
	}
	if res.Code == "" {
		return errors.New("LoginModrinth: empty code in callback")
	}

	tok, err := s.modrinth.Exchange(ctx, res.Code, modrinthRedirectURL)
	if err != nil {
		return err
	}
	tok.IssuedAt = time.Now().UnixMilli()
	raw, err := json.Marshal(tok)
	if err != nil {
		return fmt.Errorf("LoginModrinth: marshal token: %w", err)
	}
	if err := s.host.Secrets.Put(modrinthSecretService, modrinthSecretAccount, string(raw)); err != nil {
		return fmt.Errorf("LoginModrinth: store token: %w", err)
	}
	return nil
}

// AddYggdrasilService adds an authlib-injector service to the registry.
func (s *Service) AddYggdrasilService(ctx context.Context, url string) error {
	return s.yggreg.Add(ctx, url)
}

// RemoveYggdrasilService removes an entry by exact URL match.
func (s *Service) RemoveYggdrasilService(_ context.Context, url string) error {
	return s.yggreg.Remove(url)
}

// GetSupportedAuthorityMetadata returns the merged builtin + Yggdrasil
// authorities the renderer can show as login options.
func (s *Service) GetSupportedAuthorityMetadata(_ context.Context) ([]contract.AuthorityMetadata, error) {
	out := []contract.AuthorityMetadata{
		{
			Authority: usertoken.AuthorityMicrosoft,
			Kind:      "builtin",
			Flow:      []string{"device-code"},
		},
		{
			Authority: usertoken.AuthorityDev,
			Kind:      "builtin",
			Flow:      []string{"anonymous"},
		},
	}
	for _, y := range s.yggreg.List() {
		flow := []string{"password"}
		if y.OCIDConfig != nil {
			flow = []string{"device-code", "password"}
		}
		var faviconPtr *string
		if y.Favicon != "" {
			f := y.Favicon
			faviconPtr = &f
		}
		var emailOnlyPtr *bool
		if y.AuthlibInjector != nil && !y.AuthlibInjector.Meta.FeatureNonEmailLogin {
			eo := true
			emailOnlyPtr = &eo
		}
		var inj any
		if y.AuthlibInjector != nil {
			inj = y.AuthlibInjector
		}
		out = append(out, contract.AuthorityMetadata{
			Authority:       y.URL,
			Kind:            "yggdrasil",
			AuthlibInjector: inj,
			Favicon:         faviconPtr,
			Flow:            flow,
			EmailOnly:       emailOnlyPtr,
		})
	}
	return out, nil
}

// ============================================================
// Login dispatch
// ============================================================

// Login dispatches to the correct backing auth system. Returns the
// freshly-stored UserProfile as a map (the contract type is `any`).
func (s *Service) Login(ctx context.Context, opts contract.LoginOptions) (any, error) {
	if _, err := s.GetUserState(ctx); err != nil {
		return nil, err
	}

	loginCtx, cancel := context.WithCancel(ctx)
	s.mu.Lock()
	if s.loginCancel != nil {
		s.loginCancel()
	}
	s.loginCancel = cancel
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		if s.loginCancel != nil {
			s.loginCancel = nil
		}
		s.mu.Unlock()
	}()

	s.events.EmitUserLogin(opts.Authority)

	switch opts.Authority {
	case usertoken.AuthorityDev:
		p, err := s.loginOffline(loginCtx, opts)
		if err != nil {
			return nil, err
		}
		return profileToMap(p), nil
	case usertoken.AuthorityMicrosoft:
		// `mode=device` opts into the device-code flow; otherwise the
		// auth-code grant via a localhost callback runs (matches the
		// renderer's UserLoginForm.vue behaviour).
		var (
			p   usermodel.Profile
			err error
		)
		if opts.Properties["mode"] == "device" {
			p, err = s.loginMicrosoftDeviceCode(loginCtx, opts)
		} else {
			p, err = s.loginMicrosoftAuthCode(loginCtx, opts)
		}
		if err != nil {
			return nil, err
		}
		return profileToMap(p), nil
	}
	// Treat anything else as a Yggdrasil URL — renderer pre-validates
	// against `getSupportedAuthorityMetadata`.
	p, err := s.loginYggdrasil(loginCtx, opts)
	if err != nil {
		return nil, err
	}
	return profileToMap(p), nil
}

// AbortLogin cancels the in-flight Login call, if any.
func (s *Service) AbortLogin(_ context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.loginCancel != nil {
		s.loginCancel()
		s.loginCancel = nil
	}
	return nil
}

// AbortRefresh cancels the in-flight RefreshUser call.
func (s *Service) AbortRefresh(_ context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.refreshCancel != nil {
		s.refreshCancel()
		s.refreshCancel = nil
	}
	return nil
}

// ============================================================
// Offline auth
// ============================================================

func (s *Service) loginOffline(_ context.Context, opts contract.LoginOptions) (usermodel.Profile, error) {
	uname := strings.TrimSpace(opts.Username)
	if uname == "" {
		return usermodel.Profile{}, errors.New("UserService.loginOffline: username required")
	}
	uuid := offline.GetOfflineUUID(uname)
	if v, ok := opts.Properties["uuid"]; ok && v != "" {
		uuid = v
	}

	gp := usermodel.GameProfile{
		ID:         uuid,
		Name:       uname,
		Uploadable: []string{"cape", "skin"},
		Textures:   usermodel.Textures{SKIN: usermodel.Texture{Metadata: map[string]string{}}},
	}

	// Merge into the existing OFFLINE profile (carries multiple
	// in-game characters) rather than replacing it.
	existing, ok := s.file.Users[offlineUserID]
	if !ok {
		existing = usermodel.Profile{
			ID:        offlineUserID,
			Username:  offlineUserID,
			Authority: usertoken.AuthorityDev,
			ExpiredAt: usermodel.MaxSafeInteger95(),
			Profiles:  map[string]usermodel.GameProfile{},
		}
	}
	existing.Profiles[gp.ID] = gp
	existing.SelectedProfile = gp.ID
	existing.Invalidated = false
	s.commitProfile(existing)

	if err := s.tokens.Put(usertoken.AuthorityDev, offlineUserID, offline.NewToken()); err != nil {
		s.host.Logger.Warn("user: store offline token", "err", err)
	}
	return existing, nil
}

// ============================================================
// Yggdrasil (authlib-injector) auth
// ============================================================

func (s *Service) loginYggdrasil(ctx context.Context, opts contract.LoginOptions) (usermodel.Profile, error) {
	authority := opts.Authority
	api, ok := s.yggreg.Find(authority)
	if !ok {
		// Best-effort: try treating the authority as an authlib-injector
		// root so renderers built before the registry refresh still work.
		api = yggdrasil.LoadAPIProfile(ctx, authority)
		if err := s.yggreg.Add(ctx, authority); err != nil {
			s.host.Logger.Warn("user: register implicit yggdrasil", "url", authority, "err", err)
		}
	}
	password := ""
	if opts.Password != nil {
		password = *opts.Password
	}
	client := yggdrasil.NewAuthlibInjectorClient(api.URL)
	resp, err := client.Login(ctx, opts.Username, password, s.clientToken, true)
	if err != nil {
		return usermodel.Profile{}, fmt.Errorf("yggdrasil login: %w", err)
	}
	if resp.SelectedProfile == nil && len(resp.AvailableProfiles) > 0 {
		first := resp.AvailableProfiles[0]
		resp.SelectedProfile = &first
	}
	userID := opts.Username + ":" + authority
	if resp.User != nil {
		if id, ok := resp.User["id"].(string); ok && id != "" {
			userID = id + ":" + authority
		}
	}
	profiles := map[string]usermodel.GameProfile{}
	for _, gp := range resp.AvailableProfiles {
		profiles[gp.ID] = usermodel.GameProfile{
			ID:       gp.ID,
			Name:     gp.Name,
			Textures: usermodel.Textures{SKIN: usermodel.Texture{}},
		}
	}
	prof := usermodel.Profile{
		ID:              userID,
		Username:        opts.Username,
		Invalidated:     false,
		Authority:       authority,
		ExpiredAt:       time.Now().UnixMilli() + 86_400_000,
		Profiles:        profiles,
		SelectedProfile: profileIDOrEmpty(resp.SelectedProfile),
	}
	if err := s.tokens.Put(authority, prof.ID, resp.AccessToken); err != nil {
		s.host.Logger.Warn("user: store yggdrasil token", "err", err)
	}
	s.commitProfile(prof)
	return prof, nil
}

// ============================================================
// Microsoft (device-code) auth
// ============================================================

func (s *Service) loginMicrosoftDeviceCode(ctx context.Context, opts contract.LoginOptions) (usermodel.Profile, error) {
	dc, err := s.microsoft.StartDeviceCode(ctx, microauth.MinecraftScope)
	if err != nil {
		return usermodel.Profile{}, fmt.Errorf("microsoft devicecode start: %w", err)
	}
	// Surface the device-code prompt to the renderer.
	s.events.EmitDeviceCode(map[string]any{
		"userCode":        dc.UserCode,
		"deviceCode":      dc.DeviceCode,
		"verificationUri": dc.VerificationURI,
		"expiresIn":       dc.ExpiresIn,
		"interval":        dc.Interval,
		"message":         dc.Message,
	})
	s.events.EmitMicrosoftAuthorizeUrl(dc.VerificationURI)

	tok, err := s.microsoft.AcquireDeviceCodeToken(ctx, dc)
	if err != nil {
		return usermodel.Profile{}, fmt.Errorf("microsoft devicecode poll: %w", err)
	}

	prof, err := s.completeMicrosoftLogin(ctx, opts, tok)
	if err != nil {
		return usermodel.Profile{}, err
	}
	return prof, nil
}

// ============================================================
// Microsoft (auth-code) auth — interactive browser flow
// ============================================================
//
// Flow: bind localhost:25555/auth, open the consent URL in the user's
// default browser, wait for the redirect to deliver `?code=...`,
// exchange the code (+ PKCE verifier) for a token, then run the same
// Xbox / Minecraft chain as the device-code branch.
//
// Errors fall through to the renderer's standard "login failed" UX.
// AbortLogin cancels in-flight callbacks via the parent context.
func (s *Service) loginMicrosoftAuthCode(ctx context.Context, opts contract.LoginOptions) (usermodel.Profile, error) {
	pkce, err := microauth.NewPKCE()
	if err != nil {
		return usermodel.Profile{}, fmt.Errorf("microsoft authcode: pkce: %w", err)
	}
	state, err := microauth.NewState()
	if err != nil {
		return usermodel.Profile{}, fmt.Errorf("microsoft authcode: state: %w", err)
	}
	listener, err := authcallback.Start(authCodeRedirectAddr, authCodeRedirectPath, state, "")
	if err != nil {
		return usermodel.Profile{}, fmt.Errorf("microsoft authcode: %w (port %s busy?)", err, authCodeRedirectAddr)
	}
	defer listener.Close()

	authURL := s.microsoft.BuildAuthCodeURL(microauth.MinecraftScope,
		authCodeRedirectURL, pkce.Challenge, state, opts.Username)
	s.events.EmitMicrosoftAuthorizeUrl(authURL)
	if err := browser.OpenURL(authURL); err != nil {
		// Non-fatal: the renderer can show the URL via the
		// `microsoft-authorize-url` event so the user copies it manually.
		s.host.Logger.Warn("microsoft authcode: open browser failed", "err", err)
	}

	waitCtx, cancel := context.WithTimeout(ctx, authCodeTimeout)
	defer cancel()
	res, err := listener.Wait(waitCtx)
	if err != nil {
		return usermodel.Profile{}, fmt.Errorf("microsoft authcode wait: %w", err)
	}
	if res.Code == "" {
		return usermodel.Profile{}, errors.New("microsoft authcode: empty code in callback")
	}
	tok, err := s.microsoft.ExchangeAuthCode(ctx, res.Code, pkce.Verifier,
		authCodeRedirectURL, microauth.MinecraftScope)
	if err != nil {
		return usermodel.Profile{}, fmt.Errorf("microsoft authcode exchange: %w", err)
	}
	return s.completeMicrosoftLogin(ctx, opts, tok)
}

func (s *Service) completeMicrosoftLogin(ctx context.Context, opts contract.LoginOptions, tok *microauth.TokenResponse) (usermodel.Profile, error) {
	xbl, err := s.microsoft.AuthenticateXboxLive(ctx, tok.AccessToken)
	if err != nil {
		return usermodel.Profile{}, fmt.Errorf("xbox auth: %w", err)
	}
	xsts, err := s.microsoft.AuthorizeXboxLive(ctx, xbl.Token, "rp://api.minecraftservices.com/")
	if err != nil {
		return usermodel.Profile{}, fmt.Errorf("xsts auth: %w", err)
	}
	if len(xsts.DisplayClaims.Xui) == 0 {
		return usermodel.Profile{}, errors.New("xsts: empty display claims")
	}
	uhs := xsts.DisplayClaims.Xui[0].Uhs
	mc, err := s.microsoft.LoginMinecraftWithXbox(ctx, uhs, xsts.Token)
	if err != nil {
		return usermodel.Profile{}, fmt.Errorf("login_with_xbox: %w", err)
	}
	mcProfile, err := s.microsoft.GetMinecraftProfile(ctx, mc.AccessToken)
	if err != nil {
		return usermodel.Profile{}, fmt.Errorf("get mc profile: %w", err)
	}

	id := normaliseUUID(mcProfile.ID)
	gp := usermodel.GameProfile{
		ID:   id,
		Name: mcProfile.Name,
		Textures: usermodel.Textures{
			SKIN: pickActiveSkin(mcProfile),
		},
		Uploadable: []string{"skin", "cape"},
	}
	if cape := pickActiveCape(mcProfile); cape != nil {
		gp.Textures.CAPE = cape
	}
	for _, sk := range mcProfile.Skins {
		gp.Skins = append(gp.Skins, usermodel.SkinInfo{ID: sk.ID, State: sk.State, URL: sk.URL, Variant: sk.Variant})
	}
	for _, cp := range mcProfile.Capes {
		gp.Capes = append(gp.Capes, usermodel.CapeInfo{ID: cp.ID, State: cp.State, URL: cp.URL, Alias: cp.Alias})
	}

	prof := usermodel.Profile{
		ID:              id,
		Username:        firstNonEmpty(opts.Username, mcProfile.Name),
		Invalidated:     false,
		Authority:       usertoken.AuthorityMicrosoft,
		ExpiredAt:       time.Now().UnixMilli() + int64(mc.ExpiresIn)*1000,
		Profiles:        map[string]usermodel.GameProfile{id: gp},
		SelectedProfile: id,
	}
	if err := s.tokens.Put(usertoken.AuthorityMicrosoft, id, mc.AccessToken); err != nil {
		s.host.Logger.Warn("user: store microsoft token", "err", err)
	}
	if tok.RefreshToken != "" {
		// Stash the refresh token under a distinct slot so we can
		// reissue MC tokens silently in RefreshUser without re-prompting.
		if err := s.host.Secrets.Put("xmcl/microsoft-refresh", id, tok.RefreshToken); err != nil {
			s.host.Logger.Warn("user: store microsoft refresh", "err", err)
		}
	}
	s.commitProfile(prof)
	s.events.EmitAuthProfileAdded(prof.ID)
	return prof, nil
}

// ============================================================
// Profile mutation helpers
// ============================================================

// RemoveUser drops a stored profile and its tokens.
func (s *Service) RemoveUser(ctx context.Context, userProfile any) error {
	if _, err := s.GetUserState(ctx); err != nil {
		return err
	}
	id, authority := extractIDAuthority(userProfile)
	if id == "" {
		return errors.New("RemoveUser: missing id")
	}
	s.mu.Lock()
	delete(s.file.Users, id)
	delete(s.payload.Users, id)
	s.mu.Unlock()
	s.states.Push(stateID, "userProfileRemove", id)
	s.saver.Schedule(s.snapshotFile())
	if authority != "" {
		_ = s.tokens.Delete(authority, id)
	}
	if authority == usertoken.AuthorityMicrosoft {
		_ = s.host.Secrets.Delete("xmcl/microsoft-refresh", id)
	}
	return nil
}

// SelectUserGameProfile changes the active in-game character for a user.
func (s *Service) SelectUserGameProfile(ctx context.Context, userProfile any, gameProfileID string) error {
	if _, err := s.GetUserState(ctx); err != nil {
		return err
	}
	id, _ := extractIDAuthority(userProfile)
	if id == "" {
		return errors.New("SelectUserGameProfile: missing id")
	}
	s.mu.Lock()
	prof, ok := s.file.Users[id]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("SelectUserGameProfile: %s: not found", id)
	}
	if _, ok := prof.Profiles[gameProfileID]; !ok {
		s.mu.Unlock()
		return fmt.Errorf("SelectUserGameProfile: %s: unknown game profile", gameProfileID)
	}
	prof.SelectedProfile = gameProfileID
	s.file.Users[id] = prof
	s.payload.Users[id] = profileToMap(prof)
	s.mu.Unlock()
	s.states.Push(stateID, "userProfile", profileToMap(prof))
	s.saver.Schedule(s.snapshotFile())
	return nil
}

// RemoveUserGameProfile drops a single in-game character. Only allowed
// for offline users — the upstream service rejects deletion of Yggdrasil
// / Microsoft profiles since the auth server owns them.
func (s *Service) RemoveUserGameProfile(ctx context.Context, userProfile any, gameProfileID string) error {
	if _, err := s.GetUserState(ctx); err != nil {
		return err
	}
	id, authority := extractIDAuthority(userProfile)
	if id == "" {
		return errors.New("RemoveUserGameProfile: missing id")
	}
	if authority != usertoken.AuthorityDev {
		return errors.New("RemoveUserGameProfile: only supported for offline users")
	}
	s.mu.Lock()
	prof, ok := s.file.Users[id]
	if !ok {
		s.mu.Unlock()
		return nil
	}
	delete(prof.Profiles, gameProfileID)
	if prof.SelectedProfile == gameProfileID {
		prof.SelectedProfile = ""
		for k := range prof.Profiles {
			prof.SelectedProfile = k
			break
		}
	}
	s.file.Users[id] = prof
	s.payload.Users[id] = profileToMap(prof)
	s.mu.Unlock()
	s.states.Push(stateID, "userProfile", profileToMap(prof))
	s.saver.Schedule(s.snapshotFile())
	return nil
}

// RefreshUser is a thin shim for now: it returns the stored profile
// unchanged for offline accounts (which never expire) and validates
// Yggdrasil tokens against the authserver. Microsoft refresh via
// stored refresh-token will land in a follow-up.
func (s *Service) RefreshUser(ctx context.Context, userID string, options contract.RefreshUserOptions) (any, error) {
	if _, err := s.GetUserState(ctx); err != nil {
		return nil, err
	}
	refreshCtx, cancel := context.WithCancel(ctx)
	s.mu.Lock()
	if s.refreshCancel != nil {
		s.refreshCancel()
	}
	s.refreshCancel = cancel
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		if s.refreshCancel != nil {
			s.refreshCancel = nil
		}
		s.mu.Unlock()
	}()

	s.mu.Lock()
	prof, ok := s.file.Users[userID]
	s.mu.Unlock()
	if !ok {
		return nil, fmt.Errorf("RefreshUser: %s: unknown user", userID)
	}
	if prof.Authority == usertoken.AuthorityDev {
		return profileToMap(prof), nil
	}
	if prof.Authority == usertoken.AuthorityMicrosoft {
		// Best-effort silent refresh via stored refresh-token.
		refresh, _ := s.host.Secrets.Get("xmcl/microsoft-refresh", prof.ID)
		if refresh == "" {
			return profileToMap(prof), nil
		}
		tok, err := s.microsoft.RefreshToken(refreshCtx, refresh, microauth.MinecraftScope)
		if err != nil {
			s.host.Logger.Warn("user: refresh microsoft", "err", err)
			prof.Invalidated = true
			s.commitProfile(prof)
			return profileToMap(prof), nil
		}
		updated, err := s.completeMicrosoftLogin(refreshCtx, contract.LoginOptions{
			Username:  prof.Username,
			Authority: usertoken.AuthorityMicrosoft,
		}, tok)
		if err != nil {
			s.host.Logger.Warn("user: complete microsoft refresh", "err", err)
			return profileToMap(prof), nil
		}
		return profileToMap(updated), nil
	}
	// Yggdrasil: validate, then refresh if invalid.
	api, found := s.yggreg.Find(prof.Authority)
	if !found {
		return profileToMap(prof), nil
	}
	tok, _ := s.tokens.Get(prof.Authority, prof.ID)
	if tok == "" {
		prof.Invalidated = true
		s.commitProfile(prof)
		return profileToMap(prof), nil
	}
	client := yggdrasil.NewAuthlibInjectorClient(api.URL)
	valid, _ := client.Validate(refreshCtx, tok, s.clientToken)
	force := false
	if options.Force != nil && *options.Force {
		force = true
	}
	if !valid || force {
		newAuth, err := client.Refresh(refreshCtx, tok, s.clientToken, true)
		if err != nil {
			s.host.Logger.Warn("user: refresh yggdrasil", "err", err)
			prof.Invalidated = true
			s.commitProfile(prof)
			return profileToMap(prof), nil
		}
		_ = s.tokens.Put(prof.Authority, prof.ID, newAuth.AccessToken)
		prof.Invalidated = false
		prof.ExpiredAt = time.Now().UnixMilli() + 86_400_000
	} else {
		prof.Invalidated = false
		prof.ExpiredAt = time.Now().UnixMilli() + 86_400_000
	}
	s.commitProfile(prof)
	return profileToMap(prof), nil
}

// SaveSkin downloads `options.Url` (http(s)) into `options.Path` —
// straightforward stream-to-file. The renderer uses this to mirror a
// remote skin into the cache so it can be uploaded back later.
func (s *Service) SaveSkin(ctx context.Context, options contract.SaveSkinOptions) error {
	if !strings.HasPrefix(options.Url, "http://") && !strings.HasPrefix(options.Url, "https://") {
		return fmt.Errorf("SaveSkin: only http/https URLs supported, got %q", options.Url)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, options.Url, nil)
	if err != nil {
		return err
	}
	resp, err := auth.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("SaveSkin: HTTP %d", resp.StatusCode)
	}
	if err := os.MkdirAll(filepath.Dir(options.Path), 0o755); err != nil {
		return err
	}
	tmp := options.Path + ".tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, resp.Body); err != nil {
		_ = f.Close()
		_ = os.Remove(tmp)
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, options.Path)
}

// UploadSkin dispatches a skin / cape change to the right backing
// authority — Microsoft accounts go through the Mojang services API,
// Yggdrasil / authlib-injector accounts (incl. LittleSkin login)
// go through the texture endpoint, and offline accounts apply the
// change locally. The renderer's payload mirrors `UploadSkinOptions`
// in `xmcl-runtime-api`:
//
//   - skin == nil          → no change to the skin
//   - skin == map{}        → reset to default (`null` in TS)
//   - skin == map{url, slim} → upload the texture
//   - cape == nil          → no change to the cape
//   - cape == ""           → reset cape
//   - cape == "<url>"      → activate the cape with that URL
//
// The contract type uses `Skin map[string]any`; the renderer hands
// us either a populated map (upload), an empty map (reset), or
// omits the key entirely (no change). We treat a nil map as "omit".
func (s *Service) UploadSkin(ctx context.Context, options contract.UploadSkinOptions) error {
	if _, err := s.GetUserState(ctx); err != nil {
		return err
	}
	if options.UserId == "" {
		return errors.New("UploadSkin: userId required")
	}

	s.mu.Lock()
	prof, ok := s.file.Users[options.UserId]
	s.mu.Unlock()
	if !ok {
		return fmt.Errorf("UploadSkin: %s: unknown user", options.UserId)
	}

	gameProfileID := prof.SelectedProfile
	if options.GameProfileId != nil && *options.GameProfileId != "" {
		gameProfileID = *options.GameProfileId
	}
	gp, ok := prof.Profiles[gameProfileID]
	if !ok {
		return fmt.Errorf("UploadSkin: %s: unknown game profile", gameProfileID)
	}

	skin, hasSkin, resetSkin, err := parseSkinPayload(options.Skin)
	if err != nil {
		return err
	}
	cape, hasCape, resetCape := parseCapePayload(options.Cape)

	switch prof.Authority {
	case usertoken.AuthorityDev:
		s.applySkinOffline(&gp, hasSkin, resetSkin, skin, hasCape, resetCape, cape)
		prof.Profiles[gameProfileID] = gp
		s.commitProfile(prof)
		return nil
	case usertoken.AuthorityMicrosoft:
		return s.uploadSkinMicrosoft(ctx, &prof, gameProfileID, gp, hasSkin, resetSkin, skin, hasCape, resetCape, cape)
	default:
		return s.uploadSkinYggdrasil(ctx, &prof, gameProfileID, gp, hasSkin, resetSkin, skin, hasCape, resetCape, cape)
	}
}

// skinPayload is the parsed renderer payload for the `skin` field.
type skinPayload struct {
	URL  string
	Slim bool
}

func parseSkinPayload(raw map[string]any) (sp skinPayload, present bool, reset bool, err error) {
	if raw == nil {
		return sp, false, false, nil
	}
	if len(raw) == 0 {
		// Renderer sent the explicit "reset" sentinel (`null` upstream).
		return sp, true, true, nil
	}
	url, _ := raw["url"].(string)
	slim, _ := raw["slim"].(bool)
	if url == "" {
		return sp, false, false, errors.New("UploadSkin: skin.url is required when skin is set")
	}
	return skinPayload{URL: url, Slim: slim}, true, false, nil
}

func parseCapePayload(raw *string) (cape string, present bool, reset bool) {
	if raw == nil {
		return "", false, false
	}
	if *raw == "" {
		return "", true, true
	}
	return *raw, true, false
}

// ============================================================
// Microsoft skin upload
// ============================================================

func (s *Service) uploadSkinMicrosoft(ctx context.Context, prof *usermodel.Profile, gameProfileID string, gp usermodel.GameProfile, hasSkin, resetSkin bool, skin skinPayload, hasCape, resetCape bool, cape string) error {
	tok, _ := s.tokens.Get(prof.Authority, prof.ID)
	if tok == "" {
		prof.Invalidated = true
		s.commitProfile(*prof)
		return errors.New("UploadSkin: microsoft account is not authenticated")
	}

	var newProfile *mojangapi.SkinResponse

	if hasCape {
		if resetCape {
			if err := s.mojang.HideCape(ctx, tok); err != nil {
				return err
			}
		} else {
			// Match the cape URL against the player's known capes to
			// find the right capeId — Mojang's API takes the id, not
			// the URL.
			var capeID string
			for _, c := range gp.Capes {
				if c.URL == cape {
					capeID = c.ID
					break
				}
			}
			if capeID == "" {
				return fmt.Errorf("UploadSkin: unknown cape URL for %s", gp.Name)
			}
			if err := s.mojang.ShowCape(ctx, capeID, tok); err != nil {
				return err
			}
		}
	}

	if hasSkin {
		if resetSkin {
			if err := s.mojang.ResetSkin(ctx, tok); err != nil {
				return err
			}
		} else {
			variant := mojangapi.SkinVariantClassic
			if skin.Slim {
				variant = mojangapi.SkinVariantSlim
			}
			data, isURL, err := normaliseSkinSource(skin.URL)
			if err != nil {
				return err
			}
			if isURL {
				newProfile, err = s.mojang.SetSkinByURL(ctx, data.url, variant, tok)
			} else {
				newProfile, err = s.mojang.SetSkinByFile(ctx, gp.Name+".png", data.bytes, variant, tok)
			}
			if err != nil {
				return err
			}
		}
	}

	if newProfile != nil {
		gp.ID = newProfile.ID
		gp.Name = newProfile.Name
		if len(newProfile.Skins) > 0 {
			s := newProfile.Skins[0]
			gp.Textures.SKIN = usermodel.Texture{URL: s.URL}
			if s.Variant == "SLIM" {
				gp.Textures.SKIN.Metadata = map[string]string{"model": "slim"}
			}
		}
		if len(newProfile.Capes) > 0 {
			gp.Textures.CAPE = &usermodel.Texture{URL: newProfile.Capes[0].URL}
		} else {
			gp.Textures.CAPE = nil
		}
	}
	gp.Uploadable = []string{"skin", "cape"}
	prof.Profiles[gameProfileID] = gp
	s.commitProfile(*prof)
	return nil
}

// ============================================================
// Yggdrasil skin upload (incl. LittleSkin)
// ============================================================

func (s *Service) uploadSkinYggdrasil(ctx context.Context, prof *usermodel.Profile, gameProfileID string, gp usermodel.GameProfile, hasSkin, resetSkin bool, skin skinPayload, hasCape, resetCape bool, cape string) error {
	tok, _ := s.tokens.Get(prof.Authority, prof.ID)
	if tok == "" {
		// LittleSkin separately stashes a token under the OAuth slot
		// when the user logged in through `LittleSkinUserService`.
		if litTok, _ := s.host.Secrets.Get(littleskin.LittleSkinTokenService, littleskin.LittleSkinTokenAccount); litTok != "" {
			tok = litTok
		}
	}
	if tok == "" {
		prof.Invalidated = true
		s.commitProfile(*prof)
		return errors.New("UploadSkin: yggdrasil account is not authenticated")
	}

	root := s.yggdrasilRoot(prof.Authority)
	if root == "" {
		return fmt.Errorf("UploadSkin: unknown yggdrasil authority %q", prof.Authority)
	}
	tp := yggdrasil.NewThirdPartyClient(root)

	if hasCape && contains(gp.Uploadable, "cape") {
		if resetCape {
			if err := tp.DeleteTexture(ctx, tok, gp.ID, yggdrasil.TextureCape); err != nil {
				return err
			}
		} else {
			data, isURL, err := normaliseSkinSource(cape)
			if err != nil {
				return err
			}
			if isURL {
				if err := tp.SetTextureURL(ctx, tok, gp.ID, yggdrasil.TextureCape, data.url, ""); err != nil {
					return err
				}
			} else {
				if err := tp.SetTextureFile(ctx, tok, gp.ID, yggdrasil.TextureCape, data.bytes, ""); err != nil {
					return err
				}
			}
		}
	}

	if hasSkin && contains(gp.Uploadable, "skin") {
		if resetSkin {
			if err := tp.DeleteTexture(ctx, tok, gp.ID, yggdrasil.TextureSkin); err != nil {
				return err
			}
		} else {
			model := "steve"
			if skin.Slim {
				model = "slim"
			}
			data, isURL, err := normaliseSkinSource(skin.URL)
			if err != nil {
				return err
			}
			if isURL {
				if err := tp.SetTextureURL(ctx, tok, gp.ID, yggdrasil.TextureSkin, data.url, model); err != nil {
					return err
				}
			} else {
				if err := tp.SetTextureFile(ctx, tok, gp.ID, yggdrasil.TextureSkin, data.bytes, model); err != nil {
					return err
				}
			}
		}
	}

	// Refresh the game profile to pick up the new texture URLs.
	if updated, err := tp.Lookup(ctx, gp.ID, true); err == nil && updated != nil {
		gp.Name = updated.Name
		// Property "textures" carries a base64-encoded JSON blob; the
		// renderer doesn't strictly need it parsed here — it just
		// needs the URL. Leaving the existing Textures alone is safe;
		// the renderer re-fetches from the upstream texture URL.
	}
	prof.Profiles[gameProfileID] = gp
	s.commitProfile(*prof)
	return nil
}

// yggdrasilRoot returns the API root (without `/authserver`) for the
// given authority. Falls back to the authority URL itself when the
// registry doesn't know the entry — the legacy YggdrasilSeriveRegistry
// bootstrap path is permissive about that.
func (s *Service) yggdrasilRoot(authority string) string {
	if api, ok := s.yggreg.Find(authority); ok {
		return api.URL
	}
	return authority
}

// ============================================================
// Offline skin update (in-memory only)
// ============================================================

func (s *Service) applySkinOffline(gp *usermodel.GameProfile, hasSkin, resetSkin bool, skin skinPayload, hasCape, resetCape bool, cape string) {
	if hasSkin {
		if resetSkin {
			gp.Textures.SKIN = usermodel.Texture{}
		} else {
			meta := map[string]string{"model": "steve"}
			if skin.Slim {
				meta["model"] = "slim"
			}
			gp.Textures.SKIN = usermodel.Texture{URL: skin.URL, Metadata: meta}
		}
	}
	if hasCape {
		if resetCape {
			gp.Textures.CAPE = nil
		} else {
			gp.Textures.CAPE = &usermodel.Texture{URL: cape}
		}
	}
}

// ============================================================
// Skin source normalisation
// ============================================================

// skinSource carries either an https URL or raw image bytes.
type skinSource struct {
	url   string
	bytes []byte
}

// normaliseSkinSource handles the renderer-side URL conventions:
//
//   - https?://… → handed to the upstream "fetch from URL" endpoint
//   - file://     → local file read into memory for multipart upload
//   - image://    → ditto (legacy launcher convention; same as file)
//
// Any other scheme is rejected.
func normaliseSkinSource(raw string) (skinSource, bool, error) {
	if raw == "" {
		return skinSource{}, false, errors.New("normaliseSkinSource: empty url")
	}
	switch {
	case strings.HasPrefix(raw, "http://"), strings.HasPrefix(raw, "https://"):
		return skinSource{url: raw}, true, nil
	case strings.HasPrefix(raw, "file://"):
		path := strings.TrimPrefix(raw, "file://")
		buf, err := os.ReadFile(path)
		if err != nil {
			return skinSource{}, false, err
		}
		return skinSource{bytes: buf}, false, nil
	case strings.HasPrefix(raw, "image://"):
		path := strings.TrimPrefix(raw, "image://")
		buf, err := os.ReadFile(path)
		if err != nil {
			return skinSource{}, false, err
		}
		return skinSource{bytes: buf}, false, nil
	default:
		return skinSource{}, false, fmt.Errorf("normaliseSkinSource: unsupported scheme: %s", raw)
	}
}

func contains(s []string, v string) bool {
	for _, x := range s {
		if x == v {
			return true
		}
	}
	return false
}

// ============================================================
// Helpers
// ============================================================

func (s *Service) snapshotFile() *usermodel.File {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := &usermodel.File{Users: make(map[string]usermodel.Profile, len(s.file.Users))}
	for k, v := range s.file.Users {
		out.Users[k] = v
	}
	return out
}

func (s *Service) commitProfile(p usermodel.Profile) {
	m := profileToMap(p)
	s.mu.Lock()
	s.file.Users[p.ID] = p
	if s.payload.Users == nil {
		s.payload.Users = map[string]any{}
	}
	s.payload.Users[p.ID] = m
	s.mu.Unlock()
	s.states.Push(stateID, "userProfile", m)
	s.saver.Schedule(s.snapshotFile())
}

func profileToMap(p usermodel.Profile) map[string]any {
	raw, _ := json.Marshal(p)
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return out
}

func extractIDAuthority(userProfile any) (id, authority string) {
	m, ok := userProfile.(map[string]any)
	if !ok {
		return "", ""
	}
	id, _ = m["id"].(string)
	authority, _ = m["authority"].(string)
	return id, authority
}

func profileIDOrEmpty(p *yggdrasil.GameProfile) string {
	if p == nil {
		return ""
	}
	return p.ID
}

func pickActiveSkin(p *microauth.MinecraftProfile) usermodel.Texture {
	for _, sk := range p.Skins {
		if sk.State == "ACTIVE" {
			t := usermodel.Texture{URL: sk.URL}
			if sk.Variant == "SLIM" {
				t.Metadata = map[string]string{"model": "slim"}
			}
			return t
		}
	}
	return usermodel.Texture{}
}

func pickActiveCape(p *microauth.MinecraftProfile) *usermodel.Texture {
	for _, c := range p.Capes {
		if c.State == "ACTIVE" {
			return &usermodel.Texture{URL: c.URL}
		}
	}
	return nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

// normaliseUUID inserts dashes into Mojang's compact UUID form.
func normaliseUUID(id string) string {
	if len(id) != 32 {
		return id
	}
	return id[0:8] + "-" + id[8:12] + "-" + id[12:16] + "-" + id[16:20] + "-" + id[20:32]
}
