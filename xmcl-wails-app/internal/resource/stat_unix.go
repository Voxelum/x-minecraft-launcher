//go:build !windows

// stat_unix.go — POSIX path. `os.FileInfo.Sys()` returns
// `*syscall.Stat_t` on Linux + macOS, which carries the inode and
// access/change times we want.

package resource

import (
	"os"
	"syscall"
)

func inodeOf(info os.FileInfo) int64 {
	if sys, ok := info.Sys().(*syscall.Stat_t); ok && sys != nil {
		return int64(sys.Ino)
	}
	return info.Size() ^ info.ModTime().UnixNano()
}

func fillTimes(info os.FileInfo, fe *FileEntry) {
	fe.Mtime = info.ModTime().UnixMilli()
	fe.Atime = fe.Mtime
	fe.Ctime = fe.Mtime
	fe.Ino = inodeOf(info)
	if sys, ok := info.Sys().(*syscall.Stat_t); ok && sys != nil {
		// Atim / Ctim are platform-specific (sec/nsec on Linux,
		// Atimespec/Ctimespec on Darwin). Take the seconds field
		// from the timespec helpers.
		fe.Atime = atimeMillis(sys)
		fe.Ctime = ctimeMillis(sys)
	}
}
