package core

import (
	"path/filepath"
	"regexp"
	"strings"
)

// LibraryInfo is the parsed form of a Maven coordinate (the standard
// `groupId:artifactId:version[:classifier][@type]` notation Mojang
// uses for `Library.name`).
type LibraryInfo struct {
	GroupID    string
	ArtifactID string
	Version    string
	IsSnapshot bool
	Type       string // file extension; "jar" by default
	Classifier string
	// Path is the Maven-conventional relative path inside the
	// `libraries/` folder: groupId-as-slash/artifactId/version/
	// artifactId-version[-classifier].type
	Path string
	Name string // original maven coordinate
}

// ParseLibraryName parses a Maven coordinate string. Accepts either
// "groupId:artifactId:version" or with classifier/type suffixes
// (e.g. `net.foo:bar:1.0:natives-windows@zip`).
func ParseLibraryName(name string) LibraryInfo {
	info := LibraryInfo{Name: name, Type: "jar"}

	body := name
	if at := strings.LastIndexByte(name, '@'); at != -1 {
		body = name[:at]
		info.Type = name[at+1:]
	}
	parts := strings.Split(body, ":")
	if len(parts) >= 3 {
		info.GroupID = parts[0]
		info.ArtifactID = parts[1]
		info.Version = parts[2]
	}
	if len(parts) >= 4 {
		info.Classifier = parts[3]
	}
	info.IsSnapshot = strings.HasSuffix(info.Version, "-SNAPSHOT")

	groupPath := strings.ReplaceAll(info.GroupID, ".", "/")
	base := filepath.ToSlash(filepath.Join(
		groupPath,
		info.ArtifactID,
		info.Version,
		info.ArtifactID+"-"+info.Version,
	))
	if info.Classifier != "" {
		base += "-" + info.Classifier
	}
	info.Path = base + "." + info.Type
	return info
}

// ParseLibraryPath is the inverse of ParseLibraryName — reconstructs
// LibraryInfo from the on-disk relative path under `libraries/`.
// Useful when the launcher only has the path (e.g. when walking the
// directory tree).
func ParseLibraryPath(path string) LibraryInfo {
	// Normalise to forward slashes; the path uses Maven convention.
	p := filepath.ToSlash(path)
	parts := strings.Split(p, "/")
	if len(parts) < 4 {
		return LibraryInfo{Path: p, Type: "jar"}
	}
	file := parts[len(parts)-1]
	version := parts[len(parts)-2]
	artifact := parts[len(parts)-3]
	group := strings.Join(parts[:len(parts)-3], ".")

	ext := filepath.Ext(file)
	typ := strings.TrimPrefix(ext, ".")
	if typ == "" {
		typ = "jar"
	}

	isSnapshot := strings.HasPrefix(file, version)
	filePrefix := artifact + "-" + version

	// Trim file → leaves the optional classifier.
	classifier := strings.TrimSuffix(file, ext)
	if isSnapshot {
		classifier = strings.TrimPrefix(classifier, version)
	} else {
		classifier = strings.TrimPrefix(classifier, filePrefix)
	}
	classifier = strings.TrimPrefix(classifier, "-")

	name := group + ":" + artifact + ":" + version
	if classifier != "" {
		name += ":" + classifier
	}
	if typ != "jar" {
		name += "@" + typ
	}

	return LibraryInfo{
		GroupID:    group,
		ArtifactID: artifact,
		Version:    version,
		IsSnapshot: isSnapshot,
		Type:       typ,
		Classifier: classifier,
		Path:       p,
		Name:       name,
	}
}

// ============================================================
// Rule evaluation
// ============================================================

// Rule mirrors the version JSON `rules` schema.
type Rule struct {
	Action   string            // "allow" / "disallow"
	OS       *RuleOS           // optional
	Features map[string]bool   // optional feature flags
}

// RuleOS describes the `os` block of a rule.
type RuleOS struct {
	Name    string
	Version string // regex pattern
	Arch    string
}

// CheckAllowed evaluates the rule list under the given platform and
// the enabled set of feature flags. Mirrors `Version.checkAllowed`.
func CheckAllowed(rules []Rule, platform Platform, features []string) bool {
	if len(rules) == 0 {
		return true
	}
	allow := false
	for _, rule := range rules {
		action := rule.Action == "allow"
		apply := true
		if rule.OS != nil {
			apply = false
			osRule := rule.OS
			if platform.Name == osRule.Name {
				if osRule.Version == "" || matchOSVersion(osRule.Version, platform.Version) {
					apply = true
					if osRule.Arch != "" {
						ruleArch := osRule.Arch
						if ruleArch == "x86" {
							ruleArch = "ia32"
						}
						apply = ruleArch == platform.Arch
					}
				}
			}
		}
		if apply && len(rule.Features) > 0 {
			featureSet := make(map[string]bool, len(features))
			for _, f := range features {
				featureSet[f] = true
			}
			for k, required := range rule.Features {
				present := featureSet[k]
				if required && !present {
					apply = false
					break
				}
				if !required && present {
					apply = false
					break
				}
			}
		}
		if apply {
			allow = action
		}
	}
	return allow
}

func matchOSVersion(pattern, version string) bool {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return false
	}
	return re.MatchString(version)
}
