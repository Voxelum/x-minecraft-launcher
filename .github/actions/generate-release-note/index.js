const core = require('@actions/core');
const {  writeFileSync } = require('fs');

async function main(output) {
    const body = core.getInput('body')
    const version = core.getInput('version')
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
            writeFileSync(`xmcl-page/src/pages/${l}/changelogs/${version}.md`, content)
        } catch (e) {
            console.error(`Fail to update ${l} release note:`)
            console.error(e)
        }
    }
}

main(core ? core.setOutput : (k, v) => {
    console.log(k)
    console.log(v)
});
