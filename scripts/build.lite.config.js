const baseConfig = require('./build.base.config');

/**
 * @type {import('electron-builder').Configuration}
 */
const config = {
    ...baseConfig,
    mac: {
        icon: "build/icons/icon.icns",
        target: [
            {
                target: "zip"
            },
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
                target: "zip",
                arch: [
                    "x64",
                    "ia32"
                ]
            },
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
                target: "tar.gz"
            }
        ],
        files: [
            "dist/electron/**/*",
            "!node_modules/7zip-bin/win/**",
            "!node_modules/7zip-bin/mac/**",
            "!dist/electron/static/*.cs"
        ]
    },
}

module.exports = config;
