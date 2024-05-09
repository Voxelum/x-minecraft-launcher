const { writeFileSync, existsSync } = require('fs');

const getInput = (name) => {
    const val = process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] || '';
    return val
}

async function translate(body, locale) {
    const key = process.env.DEEPSEEK_API_KEY
    if (!key) {
        return body
    }
    const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
                {
                    role: "system",
                    content: "You are an asistant of a Minecraft Launcher developer. You are asked to translate the mod description into different languages by locale code. I'm going to give you markdown text. You should give me translated markdown text. Do not wrap extra markdown code block (```) to the output, and do not add locale prefix to output."
                },
                {
                    role: "user",
                    content: "Translate following text into zh-CN:\nHello World"
                },
                {
                    role: "assistant",
                    content: "你好世界"
                },
                {
                    role: "user",
                    content: `Translate following text into ${locale}:\n${body}`
                }
            ],
        }),
    })

    const resp = await res.json()
    let content = resp.choices[0].message.content;
    if (content.startsWith('```' + locale)) {
        content = content.substring(('```' + locale).length);
        content = content.substring(0, content.length - 3);
    }
    if (content.startsWith(locale)) {
        content = content.substring(locale.length);
    }
    return content;
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
            content = await translate(content, 'zh-CN')
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
