// Package officialuser implements contract.OfficialUserService — the
// thin HTTP wrapper around the api.minecraftservices.com / api.mojang.com
// surface used by the renderer's "Microsoft account" management dialog.
//
// Each method:
//
//  1. Extracts the user id from the renderer-passed `userProfile` map.
//  2. Looks up the stored bearer token via the shared usertoken store.
//  3. Calls the corresponding mojang.Client method.
//
// The token store is registered by the UserService at startup; calling
// any official-user method before UserService.GetUserState ran returns
// an authentication-required error.
package officialuser

import (
	"context"
	"errors"

	"github.com/voxelum/xmcl/wails/internal/auth/mojang"
	"github.com/voxelum/xmcl/wails/internal/auth/usertoken"
	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// ErrUnauthenticated is returned when no bearer token is on file for
// the requested user. Renderer surfaces it as "please re-login".
var ErrUnauthenticated = errors.New("OfficialUserService: user is not authenticated")

// Service implements contract.OfficialUserService.
type Service struct {
	contract.OfficialUserServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager
	mojang *mojang.Client
}

// New constructs the service.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm, mojang: mojang.NewClient()}
}

var _ contract.OfficialUserService = (*Service)(nil)

// ============================================================
// Helpers
// ============================================================

func (s *Service) tokenFor(userProfile any) (string, error) {
	id, authority := profileIDAuthority(userProfile)
	if id == "" {
		return "", ErrUnauthenticated
	}
	store, ok := host.Get[*usertoken.Store](s.host.Registry)
	if !ok || store == nil {
		return "", ErrUnauthenticated
	}
	tok, err := store.Get(authority, id)
	if err != nil || tok == "" {
		return "", ErrUnauthenticated
	}
	return tok, nil
}

func profileIDAuthority(userProfile any) (id, authority string) {
	m, ok := userProfile.(map[string]any)
	if !ok {
		return "", ""
	}
	id, _ = m["id"].(string)
	authority, _ = m["authority"].(string)
	return id, authority
}

// ============================================================
// Contract methods
// ============================================================

// SetName changes the player's MC services display name.
func (s *Service) SetName(ctx context.Context, userProfile any, name string) error {
	tok, err := s.tokenFor(userProfile)
	if err != nil {
		return err
	}
	return s.mojang.SetName(ctx, name, tok)
}

// GetNameChangeInformation returns the eligibility info for renames.
func (s *Service) GetNameChangeInformation(ctx context.Context, userProfile any) (contract.NameChangeInformation, error) {
	tok, err := s.tokenFor(userProfile)
	if err != nil {
		return contract.NameChangeInformation{}, err
	}
	info, err := s.mojang.GetNameChangeInformation(ctx, tok)
	if err != nil {
		return contract.NameChangeInformation{}, err
	}
	return contract.NameChangeInformation{
		ChangedAt:         info.ChangedAt,
		CreatedAt:         info.CreatedAt,
		NameChangeAllowed: info.NameChangeAllowed,
	}, nil
}

// CheckNameAvailability returns one of "AVAILABLE" / "DUPLICATE" / "NOT_ALLOWED".
func (s *Service) CheckNameAvailability(ctx context.Context, userProfile any, name string) (string, error) {
	tok, err := s.tokenFor(userProfile)
	if err != nil {
		return "", err
	}
	return s.mojang.CheckNameAvailability(ctx, name, tok)
}

// HideCape removes the active cape.
func (s *Service) HideCape(ctx context.Context, userProfile any) error {
	tok, err := s.tokenFor(userProfile)
	if err != nil {
		return err
	}
	return s.mojang.HideCape(ctx, tok)
}

// ShowCape activates the cape with id `capeID`.
func (s *Service) ShowCape(ctx context.Context, userProfile any, capeID string) error {
	tok, err := s.tokenFor(userProfile)
	if err != nil {
		return err
	}
	return s.mojang.ShowCape(ctx, capeID, tok)
}

// VerifySecurityLocation hits the legacy api.mojang.com endpoint.
// Modern accounts always return false (the endpoint 410s).
func (s *Service) VerifySecurityLocation(ctx context.Context, userProfile any) (bool, error) {
	tok, err := s.tokenFor(userProfile)
	if err != nil {
		return false, err
	}
	return s.mojang.VerifySecurityLocation(ctx, tok)
}

// GetSecurityChallenges returns the legacy security challenges. Returns
// an empty list for modern accounts where the endpoint is gone.
func (s *Service) GetSecurityChallenges(ctx context.Context, userProfile any) ([]contract.MojangChallenge, error) {
	tok, err := s.tokenFor(userProfile)
	if err != nil {
		return nil, err
	}
	chs, err := s.mojang.GetSecurityChallenges(ctx, tok)
	if err != nil {
		return nil, err
	}
	out := make([]contract.MojangChallenge, len(chs))
	for i, c := range chs {
		out[i] = contract.MojangChallenge{Answer: c.Answer, Question: c.Question}
	}
	return out, nil
}

// SubmitSecurityChallenges posts back the user's answers.
func (s *Service) SubmitSecurityChallenges(ctx context.Context, userProfile any, answers []contract.MojangChallengeResponse) error {
	tok, err := s.tokenFor(userProfile)
	if err != nil {
		return err
	}
	out := make([]mojang.MojangChallengeResponse, len(answers))
	for i, a := range answers {
		out[i] = mojang.MojangChallengeResponse{ID: a.Id, Answer: a.Answer}
	}
	return s.mojang.SubmitSecurityChallenges(ctx, out, tok)
}
