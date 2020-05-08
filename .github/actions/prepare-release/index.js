const fs = require('fs');
const core = require('@actions/core');

function genBody(b) {
    let body = ``;
    body += b;
    return body;
}
async function main(output) {
    const { version } = JSON.parse(fs.readFileSync(`package.json`).toString());
    const changelog = fs.readFileSync('CHANGELOG.md').toString();
    const changelogLines = changelog.split('\n')

    const start = changelogLines.findIndex(l => l.startsWith('## '));
    const end = changelogLines.slice(start + 1).findIndex(l => l.startsWith('## '))
    const body = changelogLines.slice(start, end).join('\n') + '\n';

    console.log(body);

    output('release', `Release ${version}`);
    output('body', genBody(body));
    output('tag', `v${version}`);
    output('prerelease', false);
    output('draft', false);
}

main(core ? core.setOutput : (k, v) => {
    console.log(k)
    console.log(v)
});
