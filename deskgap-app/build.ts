import { build } from 'esbuild'
import { copy, emptyDir, pathExists } from 'fs-extra'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import electronConfig from '../xmcl-electron-app/esbuild.config'

const root = dirname(fileURLToPath(import.meta.url))
const dist = join(root, 'dist')
const rendererSource = resolve(root, '../xmcl-keystone-ui/dist')
const rendererDestination = join(dist, 'renderer')
const sharedConfig = (electronConfig as typeof electronConfig & { default?: typeof electronConfig }).default ?? electronConfig

async function rewriteRendererResources(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await rewriteRendererResources(path)
    } else if (['.html', '.js', '.css'].includes(extname(path))) {
      const source = await readFile(path, 'utf8')
      await writeFile(path, source.replaceAll('http://launcher', 'xmcl-resource://launcher'))
    }
  }
}

function injectBridge(source: string, bootstrap: boolean) {
  const bootstrapScript = bootstrap
    ? '<script>history.replaceState(null, "", location.pathname + "?bootstrap=true")</script>'
    : ''
  const bridgeScript = '<script src="./deskgap-browser.js"></script>'
  return source.replace('<head>', `<head>${bootstrapScript}${bridgeScript}`)
}

function injectMigrationBridge(source: string) {
  return source.replace('<head>', '<head><script src="./deskgap-migration.js"></script>')
}

async function assertAsciiBundle(path: string) {
  const source = await readFile(path, 'utf8')
  const index = source.search(/[^\x00-\x7F]/u)
  if (index !== -1) {
    throw new Error(`DeskGap host bundle contains a non-ASCII character at offset ${index}`)
  }
}

async function main() {
  if (!await pathExists(join(rendererSource, 'index.html'))) {
    throw new Error('The Keystone renderer is not built. Run pnpm build:renderer first.')
  }
  await emptyDir(dist)
  await build({
    ...sharedConfig,
    entryPoints: [join(root, 'src/main.ts')],
    external: [...(sharedConfig.external ?? []), 'deskgap'],
    define: {
      ...sharedConfig.define,
      'process.env.CURSEFORGE_API_KEY': JSON.stringify(process.env.CURSEFORGE_API_KEY ?? ''),
    },
    minifyIdentifiers: process.env.NODE_ENV === 'production',
    charset: 'ascii',
    legalComments: 'external',
    outdir: dist,
    outExtension: { '.js': '.cjs' },
    metafile: false,
    target: 'node20',
  })
  await assertAsciiBundle(join(dist, 'main.cjs'))
  await copy(rendererSource, rendererDestination)
  await rewriteRendererResources(rendererDestination)
  await build({
    bundle: true,
    entryPoints: [join(root, 'src/browser.ts')],
    format: 'iife',
    minify: process.env.NODE_ENV === 'production',
    outfile: join(rendererDestination, 'deskgap-browser.js'),
    platform: 'browser',
    target: 'es2022',
  })
  await build({
    bundle: true,
    entryPoints: [join(root, 'src/migration.ts')],
    format: 'iife',
    minify: process.env.NODE_ENV === 'production',
    outfile: join(rendererDestination, 'deskgap-migration.js'),
    platform: 'browser',
    target: 'es2022',
  })
  const indexPath = join(rendererDestination, 'index.html')
  const indexSource = await readFile(indexPath, 'utf8')
  await writeFile(indexPath, injectBridge(indexSource, false))
  await writeFile(join(rendererDestination, 'index-bootstrap.html'), injectBridge(indexSource, true))
  const migrationPath = join(rendererDestination, 'migration.html')
  await writeFile(migrationPath, injectMigrationBridge(await readFile(migrationPath, 'utf8')))
  const loggerPath = join(rendererDestination, 'logger.html')
  await writeFile(loggerPath, injectBridge(await readFile(loggerPath, 'utf8'), false))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})