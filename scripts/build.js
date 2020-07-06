

process.env.NODE_ENV = 'production';

const chalk = require('chalk');
const del = require('del');
const { spawn } = require('child_process');
const webpack = require('webpack');
const Multispinner = require('multispinner');
const { writeFileSync } = require('fs');
const { join } = require('path');
const { build: electronBuild } = require('electron-builder');

const liteConfig = require('./build.lite.config');
const fullConfig = require('./build.full.config');
const mainConfig = require('./webpack.main.config');
const rendererConfig = require('./webpack.renderer.config');

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

function buildFull() {
    return electronBuild({ publish: "never", config: fullConfig }).then((v) => {
        console.log(`${okayLog}${v.join(' ')}`);
    });
}

function buildLite() {
    return electronBuild({ publish: "never", config: liteConfig }).then((v) => {
        console.log(`${okayLog}${v.join(' ')}`);
    });
}


switch (process.env.BUILD_TARGET) {
    case 'clean':
        clean();
        break;
    case 'lite':
        build().then(buildLite);
        break;
    case 'full':
        build().then(buildFull);
    default:
        build();
        break;
}
