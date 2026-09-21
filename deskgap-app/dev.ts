import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const deskGapRoot = resolve(root, '../../DeskGap')
const cli = resolve(deskGapRoot, 'node/npm/cli.js')
const dist = process.env.DESKGAP_DIST_PATH || resolve(deskGapRoot, 'cmake-build-windows/Debug')
const child = spawn(process.execPath, [cli, root, ...process.argv.slice(2)], {
  env: { ...process.env, DESKGAP_DIST_PATH: dist, NODE_ENV: process.env.NODE_ENV || 'development' },
  stdio: 'inherit',
  windowsHide: false,
})

child.once('error', error => {
  console.error(error)
  process.exitCode = 1
})
child.once('exit', code => {
  process.exitCode = code ?? 1
})