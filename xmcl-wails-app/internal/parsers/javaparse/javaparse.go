// Package javaparse implements `java -version` output parsing
// (port of `packages/installer/java.ts`'s parseJavaVersion).
//
// The parser is regex-only — it never touches the filesystem. The
// JavaService composes it with `os/exec` calls that actually invoke
// the JDK binary.

package javaparse

import (
	"regexp"
	"strconv"
)

// Info is the structured form of `java -version` output.
type Info struct {
	Version      string
	MajorVersion int
	Patch        int // -1 when unknown (modern major-only releases)
}

// Pre-compile the regexes once. The dotted matcher catches the
// classic `java version "1.8.0_312"` / `openjdk version "11.0.21+9"`
// style; the major-only matcher handles modern major-version-only
// releases (`java version "25"`, `openjdk version "21"`).
var (
	dottedRe    = regexp.MustCompile(`(\d+)\.(\d+)\.(\d+)(_\d+)?`)
	majorOnlyRe = regexp.MustCompile(`(?i)(?:openjdk|java)(?:[ _]version)?[ =]"?(\d+)"?`)
)

// Parse extracts version info from a `java -version` invocation's
// stderr (Java prints version info on stderr, not stdout). Returns
// nil when no version pattern was recognised.
func Parse(versionText string) *Info {
	if m := dottedRe.FindStringSubmatch(versionText); m != nil {
		// The `1.X.Y` legacy form has the major version in capture
		// group 2 and the patch in group 4 (`_NNN`). All later forms
		// (`X.Y.Z`) use group 1 as major + group 3 as patch.
		if m[1] == "1" {
			major, _ := strconv.Atoi(m[2])
			patch := -1
			if len(m[4]) > 1 {
				if v, err := strconv.Atoi(m[4][1:]); err == nil {
					patch = v
				}
			}
			return &Info{Version: m[0], MajorVersion: major, Patch: patch}
		}
		major, _ := strconv.Atoi(m[1])
		patch, _ := strconv.Atoi(m[3])
		return &Info{Version: m[0], MajorVersion: major, Patch: patch}
	}
	if m := majorOnlyRe.FindStringSubmatch(versionText); m != nil {
		major, _ := strconv.Atoi(m[1])
		return &Info{Version: m[1], MajorVersion: major, Patch: -1}
	}
	return nil
}
