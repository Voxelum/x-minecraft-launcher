const { readdirSync, readFileSync, writeFileSync } = require('fs')
const core = require('@actions/core');

function main(output) {
    const { version } = JSON.parse(readFileSync(`package.json`).toString());
    const files = readdirSync('build').filter((f) => f.endsWith('.sha1') || f.endsWith('.sha256'));

    let fileInfo = {};

    for (const file of files) {
        if (file.endsWith('.sha1')) {
            const realFile = file.substring(0, file.length - 5);
            if (!fileInfo[realFile]) {
                fileInfo[realFile] = { sha1: '', sha256: '' };
            }
            fileInfo[realFile].sha1 = readFileSync(`./build/${file}`).toString();
        } else {
            const realFile = file.substring(0, file.length - 7);
            if (!fileInfo[realFile]) {
                fileInfo[realFile] = { sha1: '', sha256: '' };
            }
            fileInfo[realFile].sha256 = readFileSync(`./build/${file}`).toString();
        }
    }

    fileInfo = new Proxy(fileInfo, {
        get(target, key) {
            if (!target[key]) {
                return { sha1: '', sha256: '' };
            }
            return target[key]
        }
    })

    const result =
        `[align=center]
[size=5][b]下载地址[/b][/size]
由于国内上github太虐了……我还是直接放下载地址
[b]Windows:[/b]
[url=https://xmcl-release.azureedge.net/releases/xmcl-Setup-${version}.exe]安装版[/url]
sha1:${fileInfo['xmcl-Setup-' + version + '.exe'].sha1}
sha256: ${fileInfo['xmcl-Setup-' + version + '.exe'].sha256}
[url=https://xmcl-release.azureedge.net/releases/xmcl-${version}-win.zip]x64 压缩包[/url]
sha1:${fileInfo['xmcl-' + version + '-win.zip'].sha1}
sha256: ${fileInfo['xmcl-' + version + '-win.zip'].sha256}
[b]MacOS:[/b]
[url=https://xmcl-release.azureedge.net/releases/xmcl-${version}-mac.zip]压缩包[/url]
sha1:${fileInfo['xmcl-' + version + '-mac.zip'].sha1}
sha256: ${fileInfo['xmcl-' + version + '-mac.zip'].sha256}
[url=https://xmcl-release.azureedge.net/releases/xmcl-${version}.dmg]DMG[/url]
sha1:${fileInfo['xmcl-' + version + '.dmg'].sha1}
sha256: ${fileInfo['xmcl-' + version + '.dmg'].sha256}
[b]Linux:[/b]
[url=https://xmcl-release.azureedge.net/releases/x-minecraft-launcher-${version}.x86_64.rpm]rpm[/url]
sha1:${fileInfo['x-minecraft-launcher-' + version + '.x86_64.rpm'].sha1}
sha256: ${fileInfo['x-minecraft-launcher-' + version + '.x86_64.rpm'].sha256}
[url=https://xmcl-release.azureedge.net/releases/x-minecraft-launcher_${version}_amd64.deb]deb[/url]
sha1:${fileInfo['x-minecraft-launcher_' + version + '_amd64.deb'].sha1}
sha256: ${fileInfo['x-minecraft-launcher_' + version + '_amd64.deb'].sha256}
[url=https://xmcl-release.azureedge.net/releases/x-minecraft-launcher_${version}_amd64.snap]snap[/url]
sha1:${fileInfo['x-minecraft-launcher_' + version + '_amd64.snap'].sha1}
sha256: ${fileInfo['x-minecraft-launcher_' + version + '_amd64.snap'].sha256}
[url=https://xmcl-release.azureedge.net/releases/xmcl-${version}.AppImage]AppImage[/url]
sha1:${fileInfo['xmcl-' + version + '.AppImage'].sha1}
sha256: ${fileInfo['xmcl-' + version + '.AppImage'].sha256}[/align]`

    console.log(result);

    if (core) {
        writeFileSync('./mcbbs', result);
    }
}



main(core ? core.setOutput : (k, v) => {
    console.log(k)
    console.log(v)
});
