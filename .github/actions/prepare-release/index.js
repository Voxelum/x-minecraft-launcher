const fs = require('fs');
const core = require('@actions/core');

async function main(output) {
    const { version } = JSON.parse(fs.readFileSync(`package.json`).toString());
    const changelog = fs.readFileSync('CHANGELOG.md').toString();
    const changelogLines = changelog.split('\n').map(s => s.trim());

    const start = changelogLines.findIndex(l => l.startsWith(`## [${version}]`));

    let body = 'Manual Release';
    if (start !== -1) {
        console.log(`Found start line @${start}`);
        const end = changelogLines.slice(start + 1).findIndex(l => l.startsWith('## '))
        console.log(`Found end line @${end}`);
        body = changelogLines.slice(start, start + end).join('\n') + '\n';
    } else {
        console.log(`Not found this version start:`);
        let lines = changelogLines.filter(c => c.startsWith('##'));
        for (let l of lines) console.log(`${l.start(`## [${version}]`)}: ${l}`);
    }

    console.log(body);

    output('release', `v${version}`);
    output('body', body);
    output('tag', `v${version}`);
    output('prerelease', true);
    output('draft', false);
}

main(core ? core.setOutput : (k, v) => {
    console.log(k)
    console.log(v)
});
