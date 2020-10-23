const chalk = require('chalk');
const electron = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const mainConfig = require('./webpack.main.config');
const rendererConfig = require('./webpack.renderer.config');

let electronProcess = null;
/**
 * @type {import('child_process').ChildProcess}
 */
let devtoolProcess = null;
let manualRestart = false;

function logStats(proc, data) {
    let log = '';

    log += chalk.yellow.bold(`┏ ${proc} Process ${new Array((19 - proc.length) + 1).join('-')}`);
    log += '\n\n';

    if (typeof data === 'object') {
        data.toString({
            colors: true,
            chunks: false,
        }).split(/\r?\n/).forEach((line) => {
            log += `  ${line}\n`;
        });
    } else {
        log += `  ${data}\n`;
    }

    log += `\n${chalk.yellow.bold(`┗ ${new Array(28 + 1).join('-')}`)}\n`;

    console.log(log);
}

function startVueDebug() {
    devtoolProcess = exec('npx vue-devtools');
    devtoolProcess.ref();
}

function startRenderer() {
    return new Promise((resolve, reject) => {
        rendererConfig.mode = 'development';
        const compiler = webpack(rendererConfig);

        compiler.hooks.done.tap('done', (stats) => {
            logStats('Renderer', stats);
        });

        const server = new WebpackDevServer(
            compiler,
            {
                contentBase: path.join(__dirname, '../'),
                quiet: true,
                inline: true,
                hot: true,
                before(app, ctx) {
                    ctx.middleware.waitUntilValid(() => {
                        resolve();
                    });
                },
            },
        );

        server.listen(9080);
    });
}

function startMain() {
    return new Promise((resolve, reject) => {
        mainConfig.entry.main = [path.join(__dirname, '../src/main/index.dev.ts')].concat(mainConfig.entry.main);
        mainConfig.mode = 'development';

        const compiler = webpack(mainConfig);

        compiler.hooks.watchRun.tapAsync('watch-run', (compilation, done) => {
            logStats('Main', chalk.white.bold('compiling...'));
            done();
        });


        compiler.watch({}, (err, stats) => {
            if (err) {
                console.log(err);
                return;
            }

            logStats('Main', stats);

            if (electronProcess && electronProcess.kill) {
                manualRestart = true;
                process.kill(electronProcess.pid, 'SIGINT');
                electronProcess = null;
                startElectron();

                setTimeout(() => {
                    manualRestart = false;
                }, 5000);
            }

            resolve();
        });
    });
}

function startElectron() {
    electronProcess = spawn(electron, ['--inspect=5858', '--remote-debugging-port=9222', path.join(__dirname, '../dist/electron/main.js')]);

    electronProcess.stdout.on('data', (data) => {
        electronLog(data, 'blue');
    });
    electronProcess.stderr.on('data', (data) => {
        electronLog(data, 'red');
    });

    electronProcess.on('close', () => {
        if (!manualRestart) {
            if (!devtoolProcess.killed) {
                devtoolProcess.kill(0);
            }
            process.exit();
        }
    });
}

function electronLog(data, color) {
    const colorize = (line) => {
        if (line.startsWith('[INFO]')) {
            return chalk.green('[INFO]') + line.substring(6)
        } else if (line.startsWith('[WARN]')) {
            return chalk.yellow('[WARN]') + line.substring(6)
        } if (line.startsWith('[ERROR]')) {
            return chalk.red('[ERROR]') + line.substring(7)
        }
        return line
    }
    data = data.toString().split(/\r?\n/);
    console.log(data.filter(s => s.trim() !== '').map(colorize).join('\n'));
}

function init() {
    Promise.all([startRenderer(), /*  startLog(), */ startMain()])
        .then(() => {
            startVueDebug();
            startElectron();
        })
        .catch((err) => {
            console.error(err);
        });
}

init();
