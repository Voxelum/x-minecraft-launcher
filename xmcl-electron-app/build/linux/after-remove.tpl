#!/bin/sh
set -eu

# RPM removes the old package after installing the new one during an upgrade.
case "${1:-}" in
    1|upgrade|failed-upgrade|abort-install|abort-upgrade) exit 0 ;;
esac

if command -v update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove 'xmcl' '/opt/xmcl/xmcl'
else
    rm -f '/usr/bin/xmcl'
fi

profile='/etc/apparmor.d/xmcl'
if [ -f "$profile" ]; then
    if command -v apparmor_status >/dev/null 2>&1 && apparmor_status --enabled >/dev/null 2>&1; then
        if ! { command -v ischroot >/dev/null 2>&1 && ischroot; }; then
            if ! command -v apparmor_parser >/dev/null 2>&1; then
                echo "XMCL removal failed: apparmor_parser is missing" >&2
                exit 1
            fi
            apparmor_parser --remove "$profile"
        fi
    fi
    rm -f "$profile"
fi
