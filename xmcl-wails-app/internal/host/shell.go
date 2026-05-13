package host

import (
	"errors"
	"net/url"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// OpenInFileManager reveals (or opens) `path` in the OS's native
// file manager:
//
//   - Windows: `explorer /select,<file>` (selects the file in its
//     containing folder), or `explorer <dir>` for a directory.
//   - macOS:   `open -R <file>` (reveal) or `open <dir>`.
//   - Linux:   `xdg-open <dir>` (xdg has no "select item" verb).
//
// Empty `path` returns an error so callers don't accidentally open a
// random shell.
func OpenInFileManager(path string) error {
	if path == "" {
		return errors.New("host: OpenInFileManager: empty path")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	switch runtime.GOOS {
	case "windows":
		// Spawn-and-detach so we don't block on the explorer process.
		// `explorer` is the documented way to open a folder; use
		// `/select,` when we can to highlight the target file.
		// Cmd args quoting: filepath.FromSlash + the explorer
		// convention `,<path>` (no space).
		win := filepath.FromSlash(abs)
		cmd := exec.Command("explorer", win)
		// `explorer` returns 1 on success in some scenarios; ignore the exit code.
		_ = cmd.Start()
		return nil
	case "darwin":
		cmd := exec.Command("open", abs)
		return cmd.Start()
	default:
		// xdg-open is the de-facto fallback for Linux + BSDs.
		cmd := exec.Command("xdg-open", abs)
		return cmd.Start()
	}
}

// SelectInFileManager is the "reveal item" variant — opens the OS
// file manager with `target` highlighted in its containing folder.
// Falls back to opening the directory when the platform doesn't
// support reveal.
func SelectInFileManager(target string) error {
	if target == "" {
		return errors.New("host: SelectInFileManager: empty path")
	}
	abs, err := filepath.Abs(target)
	if err != nil {
		return err
	}
	switch runtime.GOOS {
	case "windows":
		cmd := exec.Command("explorer", "/select,"+filepath.FromSlash(abs))
		_ = cmd.Start()
		return nil
	case "darwin":
		cmd := exec.Command("open", "-R", abs)
		return cmd.Start()
	default:
		dir := filepath.Dir(abs)
		cmd := exec.Command("xdg-open", dir)
		return cmd.Start()
	}
}

// PathToFileURL formats `path` as a `file://` URL with the conventional
// triple-slash on Windows. Used when handing a path back to the
// renderer for display in an `<a href="file://…">`.
func PathToFileURL(path string) string {
	abs, err := filepath.Abs(path)
	if err != nil {
		abs = path
	}
	abs = filepath.ToSlash(abs)
	if runtime.GOOS == "windows" && !strings.HasPrefix(abs, "/") {
		abs = "/" + abs
	}
	u := &url.URL{Scheme: "file", Path: abs}
	return u.String()
}
