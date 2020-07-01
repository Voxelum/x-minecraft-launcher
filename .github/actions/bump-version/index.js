const fs = require('fs');
const core = require('@actions/core');
const convBump = require('conventional-recommended-bump');
const semver = require('semver');
const conventionalChangelog = require('conventional-changelog')

const DRY = !process.env.CI;

/**
 * @returns {Promise<import('conventional-recommended-bump').Callback.Recommendation>}
 */
async function getBumpSuggestion() {
    const result = await new Promise((resolve, reject) => {
        convBump({
            whatBump(comments) {
                const reasons = comments.filter(c => c.type === 'feat' || c.type === 'fix' || c.type === 'refactor' || c.header.startsWith('BREAKING CHANGE:'));
                const feats = comments.filter(c => c.type === 'feat');
                const fixes = comments.filter(c => c.type === 'fix' || c.type === 'refactor');
                const breakings = comments.filter(c => c.header.startsWith('BREAKING CHANGE:'));
                if (comments.some(c => c.header.startsWith('BREAKING CHANGE:'))) {
                    return { level: 0, reasons, feats, fixes, breakings }; // major
                } else if (comments.some(c => c.type === 'feat')) {
                    return { level: 1, reasons, feats, fixes, breakings }; // minor
                } else if (comments.some(c => c.type === 'fix' || c.type === 'refactor')) {
                    return { level: 2, reasons, feats, fixes, breakings }; // patch
                }
            }
        }, function (err, result) {
            if (err) reject(err);
            else resolve(result);
        });
    });
    return result;
}

/**
 * @param {string} newVersion 
 * @returns {Promise<string>}
 */
function generateChangelog(newVersion, oldVersion) {
    return new Promise((resolve, reject) => {
        let content = ''
        const context = { version: newVersion }
        const changelogStream = conventionalChangelog({
            // tagPrefix: args.tagPrefix
            preset: 'conventional-changelog-config-spec',
        }, context, { merges: null })
            .on('error', function (err) {
                return reject(err)
            })

        changelogStream.on('data', function (buffer) {
            content += buffer.toString()
        })

        changelogStream.on('end', function () {
            content = content.replace(/## .+/, `## [${newVersion}](https://github.com/voxelum/x-minecraft-launcher/compare/v${oldVersion}...v${newVersion})`)
            content = `\n${content.trim()}\n`;
            return resolve(content)
        })
    })
}

function writeFile(name, content) {
    if (!DRY) {
        fs.writeFileSync(name, content);
    } else {
        console.log(`Write file ${name}`);
    }
}

async function main(output) {
    const suggesstion = await getBumpSuggestion();
    const package = JSON.parse(fs.readFileSync(`package.json`).toString());
    const packageLock = JSON.parse(fs.readFileSync(`package-lock.json`).toString());

    console.log(`Release type ${suggesstion.releaseType}`)
    if (suggesstion.releaseType) {
        const newVersion = semver.inc(package.version, suggesstion.releaseType);
        console.log(`New version ${package.version} -> ${newVersion}`)
        const newChangelog = await generateChangelog(newVersion, package.version);
        console.log(newChangelog);

        writeFile('package.json', JSON.stringify(Object.assign(package, { version: newVersion }), null, 4));
        writeFile('package-lock.json', JSON.stringify(Object.assign(packageLock, { version: newVersion }), null, 4));

        const changelog = fs.readFileSync('CHANGELOG.md').toString();
        const changelogLines = changelog.split('\n')

        const start = changelogLines.findIndex(l => l.startsWith('## ')) - 1;

        const result = [...changelogLines.slice(0, start), '', '', ...newChangelog.split('\n'), ...changelogLines.slice(start)].join('\n');

        writeFile('CHANGELOG.md', result);

        output('release', true);
        output('version', newVersion);
    } else {
        output('release', false);
    }
    // const changelog = await generateChangelog('0.1');
    // console.log(changelog);
}

main(core ? core.setOutput : (k, v) => {
    console.log(k)
    console.log(v)
});
