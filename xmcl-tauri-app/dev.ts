import { spawn } from 'child_process'
import { context } from 'esbuild'
import { resolve } from 'path'
import { preloadConfig, sidecarConfig } from './esbuild.config'

/**
 * Development launcher of the Tauri target.
 *
 * Watches the sidecar and renderer bridge bundles and runs the Rust shell
 * against the `xmcl-keystone-ui` dev server, mirroring `dev:main` of the
 * Electron target. The renderer dev server itself is still `dev:renderer`.
 */
async function main() {
  const contexts = await Promise.all([context(sidecarConfig), context(preloadConfig)])
  await Promise.all(contexts.map((c) => c.rebuild()))
  await Promise.all(contexts.map((c) => c.watch()))
  console.log('Watching the sidecar and the renderer bridge')

  const shell = spawn('cargo', ['run', '--manifest-path', resolve(__dirname, 'src-tauri/Cargo.toml')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      XMCL_SIDECAR_DIST: resolve(__dirname, 'dist'),
      XMCL_DEV_SERVER: process.env.XMCL_DEV_SERVER ?? 'http://localhost:3000',
    },
  })
  shell.on('exit', async (code) => {
    await Promise.all(contexts.map((c) => c.dispose()))
    process.exit(code ?? 0)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
