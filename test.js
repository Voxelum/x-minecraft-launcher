const querystring = require('querystring')
const parser = require('fast-html-parser')
const down = require('ts-minecraft/src/utils/download')

async function mods({ page, sort, version } = {}) {
    const endpoint = `https://minecraft.curseforge.com/mc-mods?${querystring.stringify({
        page: page || '',
        'filter-sort': sort || '',
        'filter-game-version': version || '',
    })}`
    const s = (await down(endpoint)).toString()
    const root = parser.parse(s.replace(/\r\\n/g, ''));
    console.log(root.queryAllSelector('.project-list-item'))
    return root;
}

mods();
