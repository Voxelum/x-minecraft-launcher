package authcallback

import (
	"context"
	"net/http"
	"testing"
	"time"
)

func TestStartAndCapture(t *testing.T) {
	listener, err := Start("127.0.0.1:0", "/auth", "expected_state", "")
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer listener.Close()

	addr := listener.Addr()

	// Fire the simulated browser redirect from a goroutine.
	go func() {
		time.Sleep(50 * time.Millisecond)
		_, _ = http.Get("http://" + addr + "/auth?code=auth_code_xyz&state=expected_state")
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	res, err := listener.Wait(ctx)
	if err != nil {
		t.Fatalf("Wait: %v", err)
	}
	if res.Code != "auth_code_xyz" {
		t.Errorf("Code=%q want auth_code_xyz", res.Code)
	}
	if res.State != "expected_state" {
		t.Errorf("State=%q want expected_state", res.State)
	}
}

func TestRejectsStateMismatch(t *testing.T) {
	listener, err := Start("127.0.0.1:0", "/auth", "real_state", "")
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer listener.Close()
	addr := listener.Addr()

	go func() {
		time.Sleep(50 * time.Millisecond)
		_, _ = http.Get("http://" + addr + "/auth?code=abc&state=BOGUS")
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	res, err := listener.Wait(ctx)
	if err == nil {
		t.Fatalf("expected state-mismatch error, got nil; res=%+v", res)
	}
}

func TestPropagatesErrorParams(t *testing.T) {
	listener, err := Start("127.0.0.1:0", "/auth", "", "")
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer listener.Close()
	addr := listener.Addr()

	go func() {
		time.Sleep(50 * time.Millisecond)
		_, _ = http.Get("http://" + addr + "/auth?error=access_denied&error_description=user+cancelled")
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_, err = listener.Wait(ctx)
	if err == nil {
		t.Fatal("expected error from oauth error params, got nil")
	}
}

func TestContextCancellation(t *testing.T) {
	listener, err := Start("127.0.0.1:0", "/auth", "", "")
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer listener.Close()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := listener.Wait(ctx); err == nil {
		t.Fatal("expected ctx error from cancelled context")
	}
}
