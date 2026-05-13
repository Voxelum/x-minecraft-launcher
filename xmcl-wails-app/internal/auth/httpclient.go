// Package auth carries the authentication primitives used by the
// user-facing services (UserService, OfficialUserService,
// LittleSkinUserService, AuthlibInjectorService). The subpackages
// implement individual upstream auth providers; this file only ships
// the shared HTTP client used by all of them.
//
// Until G5 lands the proper net/http pool with origin-aware retries,
// every auth call uses a single package-global client tuned for short
// JSON RPCs (30s timeout, no redirect surprises, system proxy).
package auth

import (
	"net/http"
	"time"
)

// DefaultClient is the HTTP client every auth subpackage uses for
// outbound calls. Replace via SetClient() in tests.
var DefaultClient = &http.Client{
	Timeout: 30 * time.Second,
}

// SetClient installs a custom client. Useful for tests that mock
// transports.
func SetClient(c *http.Client) {
	if c == nil {
		return
	}
	DefaultClient = c
}
