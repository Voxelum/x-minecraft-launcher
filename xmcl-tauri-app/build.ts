import { spawnSync } from 'child_process'
import { build } from 'esbuild'
import { chmod, copyFile, cp, readdir, rm, stat } from 'fs/promises'
import { resolve } from 'path'
import { preloadConfig, sidecarConfig } from './esbuild.config'

const dist = resolve(__dirname, 'dist')

/**
 * Stage what the installers ship next to the sidecar bundle: the renderer the
 * sidecar serves over loopback, and the Node runtime the shell spawns.
 *
 * `xmcl-keystone-ui` is built by the workspace (`pnpm build:renderer`), the
 * same bundle the Electron target packs into its asar.
 */
async function stageRenderer() {
  const source = resolve(__dirname, '../xmcl-keystone-ui/dist')
  if (!(await stat(resolve(source, 'index.html')).catch(() => undefined))) {
    throw new Error(
      `The renderer bundle is missing at ${source}. Run \`pnpm build:renderer\` first.`,
    )
  }
  await cp(source, resolve(dist, 'renderer'), { recursive: true })
}

/**
 * The installers cannot rely on a Node runtime being present on the user's
 * machine, so one is packed as a resource — the counterpart of the Electron
 * binary the Electron target ships.
 *
 * The copied runtime is the one running this build, so installers have to be
 * produced on (or for) the target platform, exactly as `electron-builder`
 * requires today. `XMCL_NODE_BINARY` overrides it for cross-building.
 */
async function stageNode() {
  const source = process.env.XMCL_NODE_BINARY || process.execPath
  const target = resolve(dist, process.platform === 'win32' ? 'node.exe' : 'node')
  await copyFile(source, target)
  if (process.platform !== 'win32') await chmod(target, 0o755)
}

/**
 * The agent documents the runtime reads at startup. Electron packs them as
 * `extraResources` and resolves them from `process.resourcesPath`; here they sit
 * next to the sidecar, which is the directory the shell exports as
 * `XMCL_RESOURCES_PATH`.
 */
async function stageAgentDocuments() {
  await cp(
    resolve(__dirname, '../xmcl-electron-app/main/agent-documents'),
    resolve(dist, 'agent-documents'),
    { recursive: true },
  )
}

/** Source maps are build artifacts; the Electron installers exclude them too. */
async function dropSourceMaps(directory = dist) {
  const entries = await readdir(directory, { withFileTypes: true })
  await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) return dropSourceMaps(path)
      return entry.name.endsWith('.map') ? rm(path, { force: true }) : undefined
    }),
  )
}

/**
 * Build the JavaScript half of the Tauri target: the sidecar hosting the
 * runtime and the renderer bridge the shell injects into every window.
 *
 * `BUILD_TARGET=shell` also compiles the Rust shell, and `BUILD_TARGET=bundle`
 * produces the installers through `tauri build`, which needs the renderer and
 * the Node runtime staged in `dist/` first because both are bundle resources.
 */
async function main() {
  const target = process.env.BUILD_TARGET
  await rm(dist, { recursive: true, force: true })

  const started = Date.now()
  await Promise.all([build(sidecarConfig), build(preloadConfig)])
  console.log(`Built sidecar and renderer bridge in ${((Date.now() - started) / 1000).toFixed(2)}s`)

  if (target === 'bundle') {
    await stageRenderer()
    await stageNode()
    await stageAgentDocuments()
    await dropSourceMaps()
    console.log('Staged the renderer, the agent documents and the Node runtime in dist/')
    const args = ['exec', 'tauri', 'build']
    // The bundle targets default to the ones declared in `tauri.conf.json`.
    if (process.env.BUNDLE_TARGETS) args.push('--bundles', process.env.BUNDLE_TARGETS)
    const result = spawnSync('pnpm', args, { stdio: 'inherit', cwd: __dirname })
    if (result.status !== 0) process.exit(result.status ?? 1)
    return
  }

  if (target === 'shell') {
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
