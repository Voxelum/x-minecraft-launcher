// Package yggdrasil — service-side helpers for fetching authlib-injector
// API metadata. The TS port lives in xmcl-runtime/user/user.ts under
// `loadYggdrasilApiProfile`; this file ports the same surface.
package yggdrasil

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/auth"
)

// AuthlibInjectorMeta mirrors xmcl-runtime-api/AuthlibInjectorMetaSchema.
type AuthlibInjectorMeta struct {
	ServerName            string                  `json:"serverName"`
	ImplementationName    string                  `json:"implementationName"`
	ImplementationVersion string                  `json:"implementationVersion"`
	Links                 AuthlibInjectorLinks    `json:"links"`
	FeatureNonEmailLogin  bool                    `json:"feature.non_email_login"`
	OpenIDConfig          string                  `json:"feature.openid_configuration_url,omitempty"`
}

// AuthlibInjectorLinks mirrors xmcl-runtime-api/AuthlibInjectorLinksSchema.
type AuthlibInjectorLinks struct {
	Homepage string `json:"homepage"`
	Register string `json:"register"`
}

// AuthlibInjectorAPIProfile mirrors AuthlibInjectorApiProfileSchema.
type AuthlibInjectorAPIProfile struct {
	Meta             AuthlibInjectorMeta `json:"meta"`
	SkinDomains      []string            `json:"skinDomains"`
	SignaturePublicKey string            `json:"signaturePublickey"`
}

// OpenIDConfig mirrors OICDLikeConfigSchema.
type OpenIDConfig struct {
	Issuer                            string   `json:"issuer"`
	JwksURI                           string   `json:"jwks_uri"`
	SubjectTypesSupported             []string `json:"subject_types_supported"`
	IDTokenSigningAlgValuesSupported  []string `json:"id_token_signing_alg_values_supported"`
	ScopesSupported                   []string `json:"scopes_supported"`
	TokenEndpoint                     string   `json:"token_endpoint"`
	UserinfoEndpoint                  string   `json:"userinfo_endpoint"`
	SharedClientID                    string   `json:"shared_client_id,omitempty"`
	DeviceAuthorizationEndpoint       string   `json:"device_authorization_endpoint,omitempty"`
	AuthorizationEndpoint             string   `json:"authorization_endpoint,omitempty"`
}

// APIProfile mirrors YggdrasilApiSchema (the cached copy stored in
// `<appDataPath>/yggdrasil.json`).
type APIProfile struct {
	URL              string                     `json:"url"`
	Profile          string                     `json:"profile,omitempty"`
	Texture          string                     `json:"texture,omitempty"`
	Auth             string                     `json:"auth,omitempty"`
	AuthlibInjector  *AuthlibInjectorAPIProfile `json:"authlibInjector,omitempty"`
	OCIDConfig       *OpenIDConfig              `json:"ocidConfig,omitempty"`
	Favicon          string                     `json:"favicon,omitempty"`
}

var faviconHrefRe = regexp.MustCompile(`<link rel="shortcut icon" href="([^"]+)"\s*/?>`)

// LoadAPIProfile fetches metadata for an authlib-injector / Yggdrasil
// service URL. Mirrors `loadYggdrasilApiProfile` in user.ts. The profile
// is best-effort: a network error on metadata or favicon doesn't fail
// the whole call (the renderer still gets a usable URL entry).
func LoadAPIProfile(ctx context.Context, apiURL string) APIProfile {
	api := APIProfile{URL: apiURL}

	loadFavicon := func() {
		parsed, err := url.Parse(apiURL)
		if err != nil {
			return
		}
		base := parsed.Scheme + "://" + parsed.Host
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"/favicon.ico", nil)
		resp, err := auth.DefaultClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			_, _ = io.Copy(io.Discard, resp.Body)
			if resp.StatusCode == 200 {
				api.Favicon = base + "/favicon.ico"
				return
			}
		}
		// Fallback: scrape the homepage for `<link rel="shortcut icon" …>`.
		req2, _ := http.NewRequestWithContext(ctx, http.MethodGet, base, nil)
		resp2, err := auth.DefaultClient.Do(req2)
		if err != nil {
			return
		}
		defer resp2.Body.Close()
		body, _ := io.ReadAll(io.LimitReader(resp2.Body, 1024*1024))
		if m := faviconHrefRe.FindStringSubmatch(string(body)); len(m) >= 2 {
			api.Favicon = m[1]
		}
	}

	loadMeta := func() {
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
		resp, err := auth.DefaultClient.Do(req)
		if err != nil {
			return
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024))
		if err != nil {
			return
		}
		var inj AuthlibInjectorAPIProfile
		if err := json.Unmarshal(body, &inj); err != nil {
			return
		}
		api.AuthlibInjector = &inj
		if inj.Meta.OpenIDConfig != "" {
			oReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, inj.Meta.OpenIDConfig, nil)
			oResp, err := auth.DefaultClient.Do(oReq)
			if err == nil {
				defer oResp.Body.Close()
				oBody, _ := io.ReadAll(io.LimitReader(oResp.Body, 1024*1024))
				var cfg OpenIDConfig
				if err := json.Unmarshal(oBody, &cfg); err == nil {
					api.OCIDConfig = &cfg
				}
			}
		}
	}

	// TS does these in parallel. We do them serially for simplicity;
	// neither call is hot, both are 30s-bounded by the shared HTTP
	// client, and the Go side never blocks more than the renderer
	// would.
	loadFavicon()
	loadMeta()
	return api
}

// HostOf returns the host portion of an API URL, or the URL itself
// when parse fails. Used for de-duping registry entries.
func HostOf(apiURL string) string {
	u, err := url.Parse(apiURL)
	if err != nil {
		return apiURL
	}
	return strings.ToLower(u.Host)
}
