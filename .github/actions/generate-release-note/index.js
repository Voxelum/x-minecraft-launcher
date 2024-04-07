const { writeFileSync, existsSync } = require('fs');

const getInput = (name) => {
    const val = process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] || '';
    return val
}
async function main() {
    const body = getInput('body')
    const version = getInput('version')
    const locales = ['en', 'zh']

    console.log(body)
    for (const l of locales) {
        let content = body.replace(`## ${version}`, `## [${version}](#${version})`)
        if (l === 'zh') {
            content = content.replace(/BREAKING CHANGES/g, '破坏性改动').replace(/Features/, '新特性').replace('Bug Fixes & Patches', '修复与补丁')
                .replace('Refactors', '重构')
                .replace('Dependencies Updates', '依赖更新')
        }
        const today = new Date()
        content = `---\nversion: ${version}\ndate: ${today.getUTCFullYear()}-${(today.getUTCMonth() + 1).toString().padStart(2, '0')}-${today.getUTCDate().toString().padStart(2, '0')}\nlayout: changelog\n---\n${content}`

        const rpmUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-x86_64.rpm`
        const rpmArmUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-aarch64.rpm`
        const tarUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-x64.tar.xz`
        const tarArmUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-arm64.tar.xz`
        const debUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-amd64.deb`
        const debArmUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-arm64.deb`
        const appImageUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-x86_64.AppImage`
        const appImageArmUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-arm64.AppImage`
        const darwinZipUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-darwin-x64.zip`

        content += `## Downloads\n\n`
        content += `Windows (x64): [zip](https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-win32-x64.zip)\n\n`
        content += `Linux (x64): [AppImage](${appImageUrl}) [deb](${debUrl}) [tar.xz](${tarUrl}) [rpm](${rpmUrl})\n\n`
        content += `Linux (arm64): [AppImage](${appImageArmUrl}) [deb](${debArmUrl}) [tar.xz](${tarArmUrl}) [rpm](${rpmArmUrl})\n\n`
        content += `Mac (x64): [dmg](https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}.dmg) [zip](${darwinZipUrl})\n\n`
        content += `Mac (arm64): [zip](https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-darwin-arm64.zip)\n\n`

        try {
            if (existsSync(`xmcl-page/src/${l}/changelogs`)) {
                writeFileSync(`xmcl-page/src/${l}/changelogs/${version}.md`, content)
            } else {
                writeFileSync(`xmcl-page/docs/${l}/changelogs/${version}.md`, content)
            }
        } catch (e) {
            console.error(`Fail to update ${l} release note:`)
            console.error(e)
        }
    }
}

main();
