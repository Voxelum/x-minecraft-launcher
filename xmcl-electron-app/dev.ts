import chalk from 'chalk'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import electron from 'electron'
import { BuildContext, Plugin, context } from 'esbuild'
import { join, resolve } from 'path'
import esbuildOptions from './esbuild.config'
import { existsSync, mkdirSync } from 'fs'

process.once('exit', terminate).once('SIGINT', terminate)

let manualRestart = false

let electronProcess: ChildProcessWithoutNullStreams | null = null

/**
 * The esbuild watch handle.
 */
let esbuild: BuildContext | null = null

/**
 * Start electron process and inspect port 5858 with 9222 as debug port.
 */
function startElectron() {
  const electronPath = electron as any as string
  const cwd = join(__dirname, '../dist')
  if (!existsSync(cwd)) {
    mkdirSync(cwd)
  }
  const spawnProcess = spawn(electronPath, [
    '--inspect=5858',
    '--remote-debugging-port=9222',
    join(__dirname, '../dist/index.js'),
  ], { cwd })

  function electronLog(data: string | Buffer) {
    const colorize = (line: string) => {
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
        .join('\n'),
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
  if (process.env.LAUNCH_BY === 'vscode') {
    return
  }
  process.env.NODE_ENV = 'development'
  if (electronProcess) {
    manualRestart = true
    electronProcess.kill('SIGTERM')
    console.log(
      `${chalk.cyan('[DEV]')} ${chalk.bold.underline.green(
        'Electron app restarted',
      )}`,
    )
  } else {
    console.log('Electron app started')
  }

  startElectron()
}

/**
 * Start esbuild service for main process and preload script
 */
export async function dev() {
  const onEndPlugin: Plugin = {
    name: 'dev',
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length > 0) {
          for (const e of result.errors) {
            // pretty print esbuild error message
            console.error(e.text)
          }
        } else {
          console.log('electron main ready')
          reloadElectron()
        }
      })
    },
  }

  esbuildOptions.plugins.push(onEndPlugin)
  esbuildOptions.define['process.env.HAS_DEV_SERVER'] = 'true'
  esbuild = await context({
    ...esbuildOptions,
    outdir: resolve(__dirname, './dist'),
    publicPath: '.',
    entryPoints: { index: join(__dirname, './main/index.dev.ts') },
  })
  await esbuild.watch()
}

function terminate() {
  if (electronProcess) {
    electronProcess.kill()
    electronProcess = null
  }
  if (esbuild) {
    esbuild.dispose()
    esbuild = null
  }
}

dev().catch((e) => {
  console.error(e)
  terminate()
  process.exit(1)
})
