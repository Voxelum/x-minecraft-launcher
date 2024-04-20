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
