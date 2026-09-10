import { spawnSync } from 'node:child_process'
import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertClickToRun, assertRawBootstrap, assetNames, stageApplication, stageRuntime } from './packaging'

const root = dirname(fileURLToPath(import.meta.url))

async function main() {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('DeskGap release packaging currently supports Windows x64 only')
  }
  const [runtimeSourceArgument, runtimeArgument, bootstrapArgument] = process.argv.slice(2)
  if (!runtimeSourceArgument || !runtimeArgument || !bootstrapArgument) {
    throw new Error('Usage: pnpm --prefix=deskgap-app package <pinned-DeskGap-source> <runtime-directory> <bootstrap.exe>')
  }
  const runtimeSource = resolve(runtimeSourceArgument)
  const runtime = resolve(runtimeArgument)
  const bootstrap = resolve(bootstrapArgument)
  const scripts = join(runtimeSource, 'node', 'scripts')
  for (const path of [join(scripts, 'package-click-to-run.mjs'), join(runtime, 'DeskGap.exe'), bootstrap]) {
    if (!(await stat(path)).isFile()) throw new Error(`Missing DeskGap packaging input: ${path}`)
  }
  await assertRawBootstrap(bootstrap)
  const version = JSON.parse(await readFile(join(root, '..', 'package.json'), 'utf8')).version as string
  const names = assetNames(version)
  const output = join(root, 'build', 'output')
  const application = join(output, 'app')
  const release = join(output, 'release')
  const runtimeStaging = join(output, 'runtime-staging')
  const run = (args: string[], production = false) => {
    const env = { ...process.env }
    if (production) env.NODE_ENV = 'production'
    const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`DeskGap packaging subprocess failed (${result.status})`)
  }
  await stageRuntime(runtime, runtimeStaging)
  run(['--import', 'tsx', join(root, 'build.ts')], true)
  await stageApplication(join(root, 'dist'), application, version)
  await rm(release, { recursive: true, force: true })
  await mkdir(release, { recursive: true })
  run([join(scripts, 'package-click-to-run.mjs'), bootstrap, runtimeStaging, application, join(release, names.runtime), version])
  await assertClickToRun(join(release, names.runtime), version)
  console.log(`Unsigned DeskGap release artifacts: ${release}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
