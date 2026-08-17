import { spawnSync } from 'child_process'
import { build } from 'esbuild'
import { rm } from 'fs/promises'
import { resolve } from 'path'
import { preloadConfig, sidecarConfig } from './esbuild.config'

/**
 * Build the JavaScript half of the Tauri target: the sidecar hosting the
 * runtime and the renderer bridge the shell injects into every window.
 *
 * `BUILD_TARGET=shell` also compiles the Rust shell. Producing installers is
 * a separate step (`tauri build`) and is not wired up yet.
 */
async function main() {
  const dist = resolve(__dirname, 'dist')
  await rm(dist, { recursive: true, force: true })

  const started = Date.now()
  await Promise.all([build(sidecarConfig), build(preloadConfig)])
  console.log(`Built sidecar and renderer bridge in ${((Date.now() - started) / 1000).toFixed(2)}s`)

  if (process.env.BUILD_TARGET === 'shell') {
    const args = ['build', '--manifest-path', resolve(__dirname, 'src-tauri/Cargo.toml')]
    if (process.env.NODE_ENV === 'production') args.push('--release')
    const result = spawnSync('cargo', args, { stdio: 'inherit' })
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
