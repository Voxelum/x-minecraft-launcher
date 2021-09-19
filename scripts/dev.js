process.env.NODE_ENV = 'development'

process.once('exit', terminate).once('SIGINT', terminate)

const electron = require('electron')
const { spawn } = require('child_process')
const { join } = require('path')
const { createServer } = require('vite')
const chalk = require('chalk')
const { build } = require('esbuild')
const { remove } = require('fs-extra')
const esbuildOptions = require('./esbuild.config')

let manualRestart = false

/**
 * @type {import('child_process').ChildProcessWithoutNullStreams  | null}
 */
let electronProcess = null

/**
 * The esbuild watch handle.
 * @type {import('esbuild').BuildResult  | null}
 */
let esbuild = null

/**
 * The vite dev server which watching renderer process files.
 * @type {import('vite').ViteDevServer  | null}
 */
let viteServer = null

/**
 * Start electron process and inspect port 5858 with 9222 as debug port.
 */
function startElectron() {
  /** @type {any} */
  const electronPath = electron
  const spawnProcess = spawn(electronPath, [
    '--inspect=5858',
    '--remote-debugging-port=9222',
    join(__dirname, '../dist/index.js')
  ])

  /**
   * @param {string | Buffer} data
   */
  function electronLog(data) {
    const colorize = (line) => {
      if (line.startsWith('[INFO]')) {
        return chalk.green('[INFO]') + line.substring(6)
      } else if (line.startsWith('[WARN]')) {
        return chalk.yellow('[WARN]') + line.substring(6)
      } else if (line.startsWith('[ERROR]')) {
        return chalk.red('[ERROR]') + line.substring(7)
      }
      return chalk.grey('[CONSOLE] ') + line
    }
    console.log(
      data
        .toString()
        .split('\n')
        .filter((s) => s.trim() !== '')
        .filter((s) => s.indexOf('source: chrome-extension:') === -1)
        .map(colorize)
        .join('\n')
    )
  }

  spawnProcess.stdout.on('data', electronLog)
  spawnProcess.stderr.on('data', electronLog)
  spawnProcess.on('exit', (_, signal) => {
    if (!manualRestart) {
      // if (!devtoolProcess.killed) {
      //     devtoolProcess.kill(0);
      // }
      if (!signal) {
        // Manual close
        process.exit(0)
      }
    } else {
      manualRestart = false
    }
  })

  electronProcess = spawnProcess
}

/**
 * Kill and restart electron process
 */
function reloadElectron() {
  if (electronProcess) {
    manualRestart = true
    electronProcess.kill('SIGTERM')
    console.log(
      `${chalk.cyan('[DEV]')} ${chalk.bold.underline.green(
        'Electron app restarted'
      )}`
    )
  } else {
    console.log(
      `${chalk.cyan('[DEV]')} ${chalk.bold.underline.green(
        'Electron app started'
      )}`
    )
  }
  startElectron()
}

/**
 * Start esbuild service for main process and preload script
 */
async function startMain() {
  const result = await build({
    ...esbuildOptions,
    entryPoints: { index: join(__dirname, '../src/main/index.dev.ts') },
    incremental: true,
    watch: {
      onRebuild(err, result) {
        if (err) {
          console.warn(err)
        } else {
          reloadElectron()
        }
      }
    }
  })
  return result
}

/**
 * Start vite dev server for renderer process and listen 8080 port
 */
async function startRenderer() {
  const config = require('./vite.config')

  config.mode = process.env.NODE_ENV

  const server = await createServer(config)
  return server.listen(8080)
}

/**
 * Main method of this script
 */
async function main() {
  // start renderer dev server
  viteServer = await startRenderer()
  // start watch the main & preload
  esbuild = await startMain()
}

remove(join(__dirname, '../dist'))
  .then(() => main())
  .catch((e) => {
    console.error(e)
    terminate()
    process.exit(1)
  })

function terminate() {
  if (electronProcess) {
    electronProcess.kill()
    electronProcess = null
  }
  if (viteServer) {
    viteServer.close()
    viteServer = null
  }
  if (esbuild && esbuild.stop) {
    esbuild.stop()
    esbuild = null
  }
}
