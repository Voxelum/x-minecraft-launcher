

process.env.NODE_ENV = 'production';

const chalk = require('chalk');
const del = require('del');
const { spawn } = require('child_process');
const webpack = require('webpack');
const Multispinner = require('multispinner');
const { writeFileSync, existsSync } = require('fs');
const { join } = require('path');
const { build: electronBuild } = require('electron-builder');
const { createHash } = require('crypto');
const { createReadStream } = require('fs');
const { pipeline } = require('stream')
const { promisify } = require('util')

const liteConfig = require('./build.lite.config');
const fullConfig = require('./build.full.config');
const mainConfig = require('./webpack.main.config');
const rendererConfig = require('./webpack.renderer.config');
const { move, readdir, writeFile, stat } = require('fs-extra');

const doneLog = `${chalk.bgGreen.white(' DONE ')}  `;
const errorLog = `${chalk.bgRed.white(' ERROR ')}  `;
const okayLog = `${chalk.bgBlue.white(' OKAY ')}  `;
const isCI = process.env.CI || false;

function clean() {
    del.sync(['build/*', '!build/icons', '!build/icons/icon.*', '!build/electron-publisher-customer.js']);
    console.log(`\n${doneLog}\n`);
    process.exit();
}

function build() {
    del.sync(['dist/electron/*', '!.gitkeep']);

    const tasks = ['main', 'renderer'];
    const m = new Multispinner(tasks, {
        preText: 'building',
        postText: 'process',
    });

    let results = '';

    let p = new Promise((res) => {
        m.on('success', () => {
            process.stdout.write('\x1B[2J\x1B[0f');
            console.log(`\n\n${results}`);
            res();
        });
    })


    pack(mainConfig).then((result) => {
        results += `${result}\n\n`;
        m.success('main');
    }).catch((err) => {
        m.error('main');
        console.log(`\n  ${errorLog}failed to build main process`);
        console.error(`\n${err}\n`);
        process.exit(1);
    });
    pack(rendererConfig).then((result) => {
        results += `${result}\n\n`;
        m.success('renderer');
    }).catch((err) => {
        m.error('renderer');
        console.log(`\n  ${errorLog}failed to build renderer process`);
        console.error(`\n${err}\n`);
        process.exit(1);
    })

    return p;
}

function pack(config) {
    return new Promise((resolve, reject) => {
        config.mode = 'production';
        webpack(config, (err, stats) => {
            if (err) reject(err.stack || err);
            else if (stats.hasErrors()) {
                let err = '';

                stats.toString({
                    chunks: false,
                    colors: true,
                })
                    .split(/\r?\n/)
                    .forEach((line) => {
                        err += `    ${line}\n`;
                    });

                reject(err);
            } else {
                writeFileSync(join(__dirname, '..', 'dist', `${config.target}-status.log`), stats.toString({
                    version: true,
                    children: true,
                    chunks: true,
                    chunkModules: true,
                }));
                resolve(stats.toString({
                    chunks: false,
                    colors: true,
                }));
            }
        });
    });
}

async function renameAndHashFiles(s) {
    async function hashByPath(algorithm, path) {
        let hash = createHash(algorithm).setEncoding("hex");
        await promisify(pipeline)(createReadStream(path), hash);
        return hash.read();
    }
    async function process(filePath) {
        if (filePath.indexOf(' ') !== -1) {
            await move(filePath, filePath.replace(/ /g, '-'));
            filePath = filePath.replace(/ /g, '-');
        }
        if (!(await stat(filePath)).isDirectory() && !filePath.endsWith('.yml') && !filePath.endsWith('.yaml')) {
            const sha256 = await hashByPath('sha256', filePath);
            const sha1 = await hashByPath('sha1', filePath);
            console.log(`checksum of ${filePath}`);
            console.log(`sha1: ${sha1}`);
            console.log(`sha256: ${sha256}`);
            await writeFile(`${filePath}.sha256`, sha256);
            await writeFile(`${filePath}.sha1`, sha1);
        }
    }
    for (const file of await readdir('build')) {
        const filePath = `build/${file}`;
        await process(filePath);
    }
    if (existsSync('build/nsis-web')) {
        for (const file of await readdir('build/nsis-web')) {
            const filePath = `build/nsis-web/${file}`;
            await process(filePath);
        }
    }
    return s;
}

function buildFull() {
    return electronBuild({ publish: "never", config: fullConfig }).then(renameAndHashFiles).then((v) => {
        console.log(`${okayLog}${v.join(' ')}`);
    });
}

function buildLite() {
    return electronBuild({ publish: "never", config: liteConfig }).then((v) => {
        console.log(`${okayLog}${v.join(' ')}`);
    });
}

function buildDir() {
    return electronBuild({ publish: "never", config: liteConfig, dir: true }).then((v) => {
        console.log(`${okayLog}${v.join(' ')}`);
    });
}

switch (process.env.BUILD_TARGET) {
    case 'clean':
        clean();
        break;
    case 'production':
        build().then(process.env.FULL_RELEASE === 'true' ? buildFull : buildLite);
        break;
    case 'debug':
        build().then(buildDir);
        break;
    default:
        build();
        break;
}
