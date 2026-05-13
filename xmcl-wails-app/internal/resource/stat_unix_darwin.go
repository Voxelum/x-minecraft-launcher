//go:build darwin

package resource

import "syscall"

func atimeMillis(s *syscall.Stat_t) int64 {
	return s.Atimespec.Sec*1000 + s.Atimespec.Nsec/1_000_000
}

func ctimeMillis(s *syscall.Stat_t) int64 {
	return s.Ctimespec.Sec*1000 + s.Ctimespec.Nsec/1_000_000
}
