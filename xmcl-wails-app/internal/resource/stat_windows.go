//go:build windows

// stat_windows.go — Windows fallback. NTFS does expose a "file id"
// (`getFileInformationByHandle`'s nFileIndex), but `os.FileInfo`
// surfaces only `Win32FileAttributeData`, so we synthesise a stable
// surrogate from (size XOR mtime-nanos) instead. Two stat() calls on
// the same file produce the same value, which is all the snapshot
// fast-path needs.
//
// Atime/Ctime are not exposed for the same reason; we mirror Mtime
// into both fields.

package resource

import "os"

func inodeOf(info os.FileInfo) int64 {
	return info.Size() ^ info.ModTime().UnixNano()
}

func fillTimes(info os.FileInfo, fe *FileEntry) {
	fe.Mtime = info.ModTime().UnixMilli()
	fe.Atime = fe.Mtime
	fe.Ctime = fe.Mtime
	fe.Ino = inodeOf(info)
}
