// Yggdrasil texture upload + profile lookup endpoints, used by
// `UserService.UploadSkin` for accounts under an authlib-injector
// service. Mirrors the `setTexture` + `lookup` halves of
// `packages/user/yggdrasil.ts` (`YggdrasilThirdPartyClient`).
//
// The base URL points at the authlib-injector root (e.g.
// `https://littleskin.cn/api/yggdrasil`), NOT the `/authserver`
// suffix used for token endpoints. Construct with
// `NewThirdPartyClient(root)`.

package yggdrasil

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/auth"
)

// ThirdPartyClient targets the authlib-injector flavour endpoints
// (texture upload + signed profile lookup).
type ThirdPartyClient struct {
	root string
	HTTP *http.Client
}

// NewThirdPartyClient constructs a client for an authlib-injector root.
func NewThirdPartyClient(root string) *ThirdPartyClient {
	return &ThirdPartyClient{root: strings.TrimRight(root, "/"), HTTP: auth.DefaultClient}
}

func (c *ThirdPartyClient) http() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return auth.DefaultClient
}

// TextureType picks the upload slot.
type TextureType string

const (
	TextureSkin   TextureType = "skin"
	TextureCape   TextureType = "cape"
	TextureElytra TextureType = "elytra"
)

// SetTextureURL points the authlib-injector service at an upstream
// texture URL — Mojang-style "the server fetches it for me".
func (c *ThirdPartyClient) SetTextureURL(ctx context.Context, accessToken, uuid string, t TextureType, textureURL, model string) error {
	u, err := c.textureURL(uuid, t)
	if err != nil {
		return err
	}
	q := u.Query()
	q.Set("model", model)
	q.Set("url", textureURL)
	u.RawQuery = q.Encode()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	return c.discardOK(req, "setTextureURL")
}

// SetTextureFile uploads raw PNG bytes via multipart/form-data.
func (c *ThirdPartyClient) SetTextureFile(ctx context.Context, accessToken, uuid string, t TextureType, png []byte, model string) error {
	u, err := c.textureURL(uuid, t)
	if err != nil {
		return err
	}
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	if model == "" {
		model = "steve"
	}
	if err := mw.WriteField("model", model); err != nil {
		return err
	}
	hdr := textproto.MIMEHeader{}
	hdr.Set("Content-Disposition", `form-data; name="file"; filename="Steve.png"`)
	hdr.Set("Content-Type", "image/png")
	part, err := mw.CreatePart(hdr)
	if err != nil {
		return err
	}
	if _, err := part.Write(png); err != nil {
		return err
	}
	if err := mw.Close(); err != nil {
		return err
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPut, u.String(), &buf)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	return c.discardOK(req, "setTextureFile")
}

// DeleteTexture clears a texture slot.
func (c *ThirdPartyClient) DeleteTexture(ctx context.Context, accessToken, uuid string, t TextureType) error {
	u, err := c.textureURL(uuid, t)
	if err != nil {
		return err
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodDelete, u.String(), nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	return c.discardOK(req, "deleteTexture")
}

// Lookup fetches the (optionally) signed game profile by UUID.
func (c *ThirdPartyClient) Lookup(ctx context.Context, uuid string, unsigned bool) (*GameProfile, error) {
	u := c.root + "/sessionserver/session/minecraft/profile/" + url.PathEscape(uuid)
	if !unsigned {
		u += "?unsigned=false"
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("lookup: HTTP %d: %s", resp.StatusCode, string(body))
	}
	var prof GameProfile
	if err := json.Unmarshal(body, &prof); err != nil {
		return nil, fmt.Errorf("lookup: decode: %w", err)
	}
	return &prof, nil
}

func (c *ThirdPartyClient) textureURL(uuid string, t TextureType) (*url.URL, error) {
	raw := c.root + "/api/user/profile/" + url.PathEscape(uuid) + "/" + string(t)
	return url.Parse(raw)
}

func (c *ThirdPartyClient) discardOK(req *http.Request, op string) error {
	resp, err := c.http().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode/100 == 2 {
		return nil
	}
	return fmt.Errorf("yggdrasil %s: HTTP %d: %s", op, resp.StatusCode, string(body))
}
