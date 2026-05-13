// Package littleskinuser implements contract.LittleSkinUserService.
//
// Auth model:
//
//   - `Authenticate(ctx)` opens the LittleSkin OAuth consent page in
//     the user's browser, listens for the redirect on
//     127.0.0.1:25555/littleskin via the shared `authcallback`
//     package, exchanges the auth code for a bearer token, and
//     persists it under the OS keyring (`xmcl/littleskin.cn/default`).
//   - All character / closet ops then read that token before calling
//     the LittleSkin REST API.
//
// The TS impl (`xmcl-runtime/littleSkin/LittleSkinUserService.ts`)
// also threads tokens through the YggdrasilAccountSystem; that's the
// piece that lets vanilla launches against `littleskin.cn` work.
// We don't ship that yet — the OAuth-for-skin-management half is
// what the renderer's "skin" tab actually consumes.
package littleskinuser

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/pkg/browser"

	"github.com/voxelum/xmcl/wails/internal/auth/authcallback"
	"github.com/voxelum/xmcl/wails/internal/auth/littleskin"
	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

const (
	tokenService     = littleskin.LittleSkinTokenService
	tokenAccount     = littleskin.LittleSkinTokenAccount
	refreshAccount   = "default-refresh"
	callbackAddr     = "127.0.0.1:25555"
	callbackPath     = "/littleskin"
	callbackTimeout  = 5 * time.Minute
)

// ErrNotAuthenticated is returned when no bearer token is on file.
var ErrNotAuthenticated = errors.New("LittleSkinUserService: user is not authenticated; call authenticate() first")

// Service implements contract.LittleSkinUserService.
type Service struct {
	contract.LittleSkinUserServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager
	client *littleskin.Client

	mu sync.Mutex
}

// New constructs the service.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm, client: littleskin.NewClient()}
}

var _ contract.LittleSkinUserService = (*Service)(nil)

// ============================================================
// Authenticate (OAuth code grant)
// ============================================================

// Authenticate opens the LittleSkin browser auth flow and waits for
// the redirect back to localhost. On success the bearer token is
// stored in the OS keyring; subsequent character / closet calls pick
// it up automatically.
func (s *Service) Authenticate(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	state := fmt.Sprintf("xmcl-%d", time.Now().UnixNano())
	listener, err := authcallback.Start(callbackAddr, callbackPath, state, "")
	if err != nil {
		return fmt.Errorf("LittleSkinUserService.authenticate: %w (port %s busy?)", err, callbackAddr)
	}
	defer listener.Close()

	authURL := littleskin.BuildAuthorizeURL(state)
	if err := browser.OpenURL(authURL); err != nil {
		// Non-fatal: surface the URL via the logger so the user
		// can copy it manually.
		s.host.Logger.Warn("littleskin: open browser failed", "url", authURL, "err", err)
	}

	waitCtx, cancel := context.WithTimeout(ctx, callbackTimeout)
	defer cancel()
	res, err := listener.Wait(waitCtx)
	if err != nil {
		return fmt.Errorf("LittleSkinUserService.authenticate: %w", err)
	}
	if res.Code == "" {
		return errors.New("LittleSkinUserService.authenticate: empty code in callback")
	}

	tok, err := s.client.ExchangeCode(ctx, res.Code)
	if err != nil {
		return err
	}
	if err := s.host.Secrets.Put(tokenService, tokenAccount, tok.AccessToken); err != nil {
		return fmt.Errorf("LittleSkinUserService.authenticate: store token: %w", err)
	}
	if tok.RefreshToken != "" {
		_ = s.host.Secrets.Put(tokenService, refreshAccount, tok.RefreshToken)
	}
	return nil
}

func (s *Service) token() (string, error) {
	tok, err := s.host.Secrets.Get(tokenService, tokenAccount)
	if err != nil || tok == "" {
		return "", ErrNotAuthenticated
	}
	return tok, nil
}

// ============================================================
// Closet / character ops
// ============================================================

// GetAllCharacters returns the player's closet contents.
func (s *Service) GetAllCharacters(ctx context.Context) ([]contract.LittleSkinCharacter, error) {
	tok, err := s.token()
	if err != nil {
		return nil, err
	}
	chs, err := s.client.GetAllCharacters(ctx, tok)
	if err != nil {
		return nil, err
	}
	out := make([]contract.LittleSkinCharacter, len(chs))
	for i, c := range chs {
		out[i] = contract.LittleSkinCharacter{
			Pid:           c.PID,
			Uid:           c.UID,
			Name:          c.Name,
			Tid_skin:      c.TIDSkin,
			Tid_cape:      c.TIDCape,
			Last_modified: c.LastModified,
		}
	}
	return out, nil
}

// SetCharacterName renames a character. The contract reuses the
// SetCharacterTextureOptions struct and overloads it with `Name`
// passed via the renderer's properties bag — but our generated
// struct doesn't carry a Name field. The TS contract has the same
// problem (`SetCharacterNameOptions` is distinct upstream). For the
// G7 cut this method errors loudly so the renderer surfaces the gap.
func (s *Service) SetCharacterName(_ context.Context, _ contract.SetCharacterTextureOptions) error {
	return errors.New("LittleSkinUserService.setCharacterName: contract carries no name field; renderer must update")
}

// SetCharacterTexture binds skin/cape ids to a character.
func (s *Service) SetCharacterTexture(ctx context.Context, opts contract.SetCharacterTextureOptions) error {
	tok, err := s.token()
	if err != nil {
		return err
	}
	return s.client.SetCharacterTexture(ctx, littleskin.SetCharacterTextureOptions{
		PID:  opts.Pid,
		Skin: opts.Skin,
		Cape: opts.Cape,
	}, tok)
}

// ListSkins fetches the public skin library page (no auth).
func (s *Service) ListSkins(ctx context.Context, _ contract.ListSkinOptions) (contract.ListSkinResult, error) {
	res, err := s.client.ListSkins(ctx)
	if err != nil {
		return contract.ListSkinResult{}, err
	}
	return contract.ListSkinResult{
		Current_page:   res.CurrentPage,
		Data:           toSkinData(res.Data),
		First_page_url: res.FirstPageURL,
		From:           res.From,
		Last_page:      res.LastPage,
		Last_page_url:  res.LastPageURL,
		Links:          toSkinLinks(res.Links),
		Next_page_url:  res.NextPageURL,
		Path:           res.Path,
		Per_page:       res.PerPage,
		Prev_page_url:  res.PrevPageURL,
		To:             res.To,
		Total:          res.Total,
	}, nil
}

// UploadTexture is deferred — needs multipart upload plumbing.
func (s *Service) UploadTexture(_ context.Context, _ contract.UploadTextureOptions) (contract.UploadTextureResult, error) {
	return contract.UploadTextureResult{}, errors.New("LittleSkinUserService.uploadTexture: not implemented in Wails build yet")
}

func toSkinData(in []any) []contract.SkinData {
	if len(in) == 0 {
		return nil
	}
	out := make([]contract.SkinData, 0, len(in))
	for _, v := range in {
		m, ok := v.(map[string]any)
		if !ok {
			continue
		}
		var s contract.SkinData
		if t, ok := m["tid"].(float64); ok {
			s.Tid = t
		}
		s.Name, _ = m["name"].(string)
		s.Type, _ = m["type"].(string)
		if u, ok := m["uploader"].(float64); ok {
			s.Uploader = u
		}
		s.Public, _ = m["public"].(bool)
		if l, ok := m["likes"].(float64); ok {
			s.Likes = l
		}
		s.Nickname, _ = m["nickname"].(string)
		out = append(out, s)
	}
	return out
}

func toSkinLinks(in []any) []contract.SkinLink {
	if len(in) == 0 {
		return nil
	}
	out := make([]contract.SkinLink, 0, len(in))
	for _, v := range in {
		m, ok := v.(map[string]any)
		if !ok {
			continue
		}
		var l contract.SkinLink
		if u, ok := m["url"].(string); ok {
			l.Url = &u
		}
		if a, ok := m["active"].(bool); ok {
			l.Active = a
		}
		if lab, ok := m["label"].(string); ok {
			l.Label = lab
		}
		out = append(out, l)
	}
	return out
}
