const baseConfig = require('./build.base.config');

/**
 * @type {import('electron-builder').Configuration}
 */
const config = {
    ...baseConfig,
    dmg: {
        contents: [
            {
                x: 410,
                y: 150,
                type: "link",
                path: "/Applications"
            },
            {
                x: 130,
                y: 150,
                type: "file"
            }
        ]
    },
    mac: {
        icon: "build/icons/icon.icns",
        target: [
            {
                target: "zip"
            },
            {
                target: "dmg"
            }
        ],
        files: [
            "dist/electron/**/*",
            "!node_modules/7zip-bin/linux/**",
            "!node_modules/7zip-bin/win/**",
            "!dist/electron/static/*.cs"
        ]
    },
    win: {
        icon: "build/icons/icon.ico",
        target: [
            {
                target: "nsis",
                arch: [
                    "x64",
                    "ia32"
                ]
            },
            {
                target: "zip",
                arch: [
                    "x64",
                    "ia32"
                ]
            },
            {
                target: "portable",
                arch: [
                    "x64",
                    "ia32"
                ]
            }
        ],
        files: [
            "dist/electron/**/*",
            "!node_modules/7zip-bin/linux/**",
            "!node_modules/7zip-bin/mac/**"
        ]
    },
    linux: {
        icon: "build/icons",
        target: [
            {
                target: "deb"
            },
            {
                target: "rpm"
            },
            {
                target: "AppImage"
            },
            {
                target: "snap"
            }
        ],
        files: [
            "dist/electron/**/*",
            "!node_modules/7zip-bin/win/**",
            "!node_modules/7zip-bin/mac/**",
            "!dist/electron/static/*.cs"
        ]
    },
    snap: {
        publish: [
            "github"
        ]
    }
}

module.exports = config;
