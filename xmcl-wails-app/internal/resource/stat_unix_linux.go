//go:build linux

package resource

import "syscall"

func atimeMillis(s *syscall.Stat_t) int64 {
	return s.Atim.Sec*1000 + s.Atim.Nsec/1_000_000
}

func ctimeMillis(s *syscall.Stat_t) int64 {
	return s.Ctim.Sec*1000 + s.Ctim.Nsec/1_000_000
}
