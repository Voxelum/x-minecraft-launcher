#!/bin/sh
set -eu

die() {
    echo "Vardrynn installation failed: $*" >&2
    exit 1
}

# A root-owned helper is unsafe if an unprivileged user can replace its parent.
for directory in / /opt /opt/Vardrynn; do
    if [ -L "$directory" ] || [ ! -d "$directory" ]; then
        die "$directory must be a real directory"
    fi
    owner="$(stat -c '%u' "$directory")" || die "cannot inspect $directory"
    mode="$(stat -c '%a' "$directory")" || die "cannot inspect $directory"
    if [ "$owner" != "0" ] || [ "$((0$mode & 022))" -ne 0 ]; then
        die "$directory must be root-owned and not writable by group or other users"
    fi
done

sandbox='/opt/Vardrynn/chrome-sandbox'
if [ -L "$sandbox" ] || [ ! -f "$sandbox" ]; then
    die "$sandbox must be a regular file, not a symbolic link"
fi

# Installation runs as root; a successful root userns probe says nothing about
# whether the desktop user can create namespaces (for example under AppArmor).
chown root:root "$sandbox" || die "cannot set sandbox ownership"
chmod 4755 "$sandbox" || die "cannot set sandbox permissions"
permissions="$(stat -c '%u:%g:%a' "$sandbox")" || die "cannot inspect sandbox permissions"
[ "$permissions" = "0:0:4755" ] || die "sandbox must be owned by root:root with mode 4755"

if command -v update-alternatives >/dev/null 2>&1; then
    if [ -L '/usr/bin/vardrynn' ] && [ -e '/usr/bin/vardrynn' ] &&
        [ "$(readlink '/usr/bin/vardrynn')" != '/etc/alternatives/vardrynn' ]; then
        rm -f '/usr/bin/vardrynn'
    fi
    update-alternatives --install '/usr/bin/vardrynn' 'vardrynn' '/opt/Vardrynn/vardrynn' 100 ||
        die "cannot register the launcher executable"
else
    ln -sf '/opt/Vardrynn/vardrynn' '/usr/bin/vardrynn'
fi

if command -v update-mime-database >/dev/null 2>&1; then
    update-mime-database /usr/share/mime || echo "Vardrynn: could not update the MIME database" >&2
fi
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || echo "Vardrynn: could not update the desktop database" >&2
fi

if command -v apparmor_status >/dev/null 2>&1 && apparmor_status --enabled >/dev/null 2>&1; then
    source='/opt/Vardrynn/resources/apparmor-profile'
    target='/etc/apparmor.d/vardrynn'
    [ -f "$source" ] || die "the bundled AppArmor profile is missing"
    command -v apparmor_parser >/dev/null 2>&1 || die "apparmor_parser is missing"

    # Older AppArmor versions do not understand abi/4.0; retain SUID support.
    if apparmor_parser --skip-kernel-load --debug "$source" >/dev/null 2>&1; then
        cp -f "$source" "$target"
        if ! { command -v ischroot >/dev/null 2>&1 && ischroot; }; then
            apparmor_parser --replace --write-cache --skip-read-cache "$target" ||
                die "cannot load the Vardrynn AppArmor profile"
        fi
    else
        echo "Vardrynn: skipping the unsupported AppArmor profile; the SUID sandbox remains configured"
    fi
fi
