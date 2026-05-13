// Package authcallback runs a one-shot localhost HTTP listener that
// receives the OAuth `?code=…` redirect from the user's browser. The
// listener auto-shuts down after the first matching request (or when
// the caller cancels via context).
//
// Used by UserService.loginMicrosoftAuthCode. The same pattern works
// for any future OAuth provider that needs a localhost redirect URI
// (Modrinth, LittleSkin, …).
package authcallback

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"
)

// Result is what a single callback delivered.
type Result struct {
	Code             string
	State            string
	Error            string
	ErrorDescription string
}

// Listener owns the one-shot HTTP server and exposes a single
// channel for the captured callback.
type Listener struct {
	addr   string
	path   string
	expect string // expected `state` for CSRF check; empty disables

	server *http.Server
	listen net.Listener
	once   sync.Once
	done   chan Result
}

// Start binds the listener to host:port (e.g. "127.0.0.1:25555") and
// answers requests on `path` (e.g. "/auth"). The expected `state`
// parameter is checked when non-empty.
//
// `successHTML` is served back to the browser after a successful
// capture so the user sees a "you can close this tab" page.
func Start(addr, path, expectedState, successHTML string) (*Listener, error) {
	if path == "" {
		path = "/"
	}
	l, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("authcallback listen %s: %w", addr, err)
	}
	lst := &Listener{
		addr:   addr,
		path:   path,
		expect: expectedState,
		done:   make(chan Result, 1),
		listen: l,
	}
	mux := http.NewServeMux()
	mux.HandleFunc(path, lst.handle(successHTML))
	lst.server = &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		_ = lst.server.Serve(l)
	}()
	return lst, nil
}

// Addr returns the bound address. Useful when Start used port 0.
func (l *Listener) Addr() string {
	if l.listen == nil {
		return l.addr
	}
	return l.listen.Addr().String()
}

// Wait blocks until either the callback fires or `ctx` is cancelled.
// The listener is shut down before returning.
func (l *Listener) Wait(ctx context.Context) (Result, error) {
	defer l.Close()
	select {
	case res := <-l.done:
		if res.Error != "" {
			return res, fmt.Errorf("oauth callback: %s: %s", res.Error, res.ErrorDescription)
		}
		return res, nil
	case <-ctx.Done():
		return Result{}, ctx.Err()
	}
}

// Close releases the underlying socket. Safe to call multiple times.
func (l *Listener) Close() {
	l.once.Do(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = l.server.Shutdown(ctx)
	})
}

func (l *Listener) handle(successHTML string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		res := Result{
			Code:             q.Get("code"),
			State:            q.Get("state"),
			Error:            q.Get("error"),
			ErrorDescription: q.Get("error_description"),
		}
		if l.expect != "" && res.State != l.expect && res.Error == "" {
			http.Error(w, "state mismatch", http.StatusBadRequest)
			select {
			case l.done <- Result{Error: "invalid_state", ErrorDescription: "state mismatch"}:
			default:
			}
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		if successHTML == "" {
			successHTML = defaultSuccessHTML
		}
		_, _ = w.Write([]byte(successHTML))
		select {
		case l.done <- res:
		default:
		}
	}
}

// ErrTimeout is returned by Wait when the context deadline elapses.
var ErrTimeout = errors.New("authcallback: timeout waiting for callback")

const defaultSuccessHTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Login complete</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif;
           background: #1e1e2e; color: #cdd6f4;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; }
    .card { text-align: center; padding: 2rem 3rem;
            background: #313244; border-radius: 12px; }
    h1 { margin: 0 0 .5rem; font-size: 1.5rem; }
    p { margin: 0; opacity: .8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Login complete</h1>
    <p>You can close this tab and return to XMCL.</p>
  </div>
</body>
</html>`
