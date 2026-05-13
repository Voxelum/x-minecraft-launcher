// Package network — atomic.go
//
// Tiny helper that lets segments.go keep its imports tight.
package network

import "sync/atomic"

func atomicAddInt64(p *int64, delta int64) int64 {
	return atomic.AddInt64(p, delta)
}
