package host

import "sync"

// MutexManager hands out per-key locks. The keys are arbitrary strings
// (resource paths, instance IDs, etc.) chosen by the caller; this is the
// Go equivalent of `xmcl-runtime/app/MutexManager.ts`, used by the TS
// `@Lock(...)` decorator. Acquired locks must be released by the caller
// (use defer, or wrap with `MutexManager.With`).
type MutexManager struct {
	mu    sync.Mutex
	locks map[string]*sync.Mutex
}

// NewMutexManager returns an empty manager.
func NewMutexManager() *MutexManager {
	return &MutexManager{locks: map[string]*sync.Mutex{}}
}

// Of returns the lock for the given key, creating one on first use.
func (m *MutexManager) Of(key string) *sync.Mutex {
	m.mu.Lock()
	defer m.mu.Unlock()
	if l, ok := m.locks[key]; ok {
		return l
	}
	l := &sync.Mutex{}
	m.locks[key] = l
	return l
}

// With acquires the named lock, runs fn, releases the lock, and returns
// fn's error. Convenience for the common case where callers don't need
// the *Mutex itself.
func (m *MutexManager) With(key string, fn func() error) error {
	l := m.Of(key)
	l.Lock()
	defer l.Unlock()
	return fn()
}

// WithKeys acquires every named lock in stable order (sorted by key) so
// concurrent callers acquiring overlapping subsets cannot deadlock.
func (m *MutexManager) WithKeys(keys []string, fn func() error) error {
	if len(keys) == 0 {
		return fn()
	}
	sorted := append([]string(nil), keys...)
	sortStrings(sorted)
	acquired := make([]*sync.Mutex, 0, len(sorted))
	defer func() {
		for i := len(acquired) - 1; i >= 0; i-- {
			acquired[i].Unlock()
		}
	}()
	for _, k := range sorted {
		l := m.Of(k)
		l.Lock()
		acquired = append(acquired, l)
	}
	return fn()
}

// sortStrings is a local sort to avoid pulling in `sort` everywhere
// (saves a tiny bit on debug binaries; trivial perf impact).
func sortStrings(s []string) {
	// Insertion sort — fine for the small key sets typical in service
	// methods (usually 1–3 keys).
	for i := 1; i < len(s); i++ {
		x, j := s[i], i
		for ; j > 0 && s[j-1] > x; j-- {
			s[j] = s[j-1]
		}
		s[j] = x
	}
}
