import { join, resolve } from 'path'
import { existsSync, readdirSync } from 'fs'

const ROOT = resolve('.')

async function getElectronVersion(): Promise<string> {
  const pkgPath = join(ROOT, 'xmcl-electron-app', 'package.json')
  const pkg = JSON.parse(await Bun.file(pkgPath).text())
  const version = pkg.devDependencies?.electron ?? pkg.dependencies?.electron
  if (!version) throw new Error('Cannot find electron version in xmcl-electron-app/package.json')
  return version.replace(/^[\^~>=<]/, '')
}

function findBunPackage(prefix: string): string | null {
  const bunPath = join(ROOT, 'node_modules', '.bun')
  if (!existsSync(bunPath)) return null
  const entry = readdirSync(bunPath).find(e => e.startsWith(prefix))
  if (!entry) return null
  return join(bunPath, entry, 'node_modules', entry.split('@')[0] === '' ? entry.split('@')[1].split('@')[0] : prefix.replace('@', ''))
}

function findNodeDatachannel(): string | null {
  const bunPath = join(ROOT, 'node_modules', '.bun')
  if (!existsSync(bunPath)) return null
  const entry = readdirSync(bunPath).find(e => e.startsWith('node-datachannel@'))
  if (!entry) return null
  return join(bunPath, entry, 'node_modules', 'node-datachannel')
}

function findVueDemi(): string | null {
  const bunPath = join(ROOT, 'node_modules', '.bun')
  if (!existsSync(bunPath)) return null
  const entry = readdirSync(bunPath).find(e => e.startsWith('vue-demi@'))
  if (!entry) return null
  return join(bunPath, entry, 'node_modules', 'vue-demi')
}

function run(cmd: string, cwd?: string) {
  console.log(`$ ${cmd}`)
  const [bin, ...args] = cmd.split(' ')
  const result = Bun.spawnSync([bin, ...args], { cwd, stdout: 'inherit', stderr: 'inherit' })
  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${cmd}`)
  }
}

async function setupNodeDatachannel(electronVersion: string) {
  const nodeDcPath = findNodeDatachannel()
  if (!nodeDcPath) {
    console.warn('⚠️  node-datachannel not found, skipping')
    return
  }

  const binaryPath = join(nodeDcPath, 'build', 'Release', 'node_datachannel.node')
  if (existsSync(binaryPath)) {
    console.log('✅ node_datachannel.node already exists, skipping')
    return
  }

  console.log('📦 Installing prebuilt node-datachannel...')
    try {
      run(`bunx prebuild-install -r napi`, nodeDcPath)
    } catch (e) {
      console.log('⚠️ Failed to download prebuilt binary, attempting to build from source...')
      run(`bunx cmake-js rebuild --runtime electron --runtime-version ${electronVersion}`, nodeDcPath)
    }

  if (existsSync(binaryPath)) {
    console.log('✅ node_datachannel.node installed')
  } else {
    console.error('❌ Failed to install node_datachannel.node')
    process.exit(1)
  }
}

async function setupVueDemi() {
  const vueDemiPath = findVueDemi()
  if (!vueDemiPath) {
    console.warn('⚠️  vue-demi not found, skipping')
    return
  }

  const postinstallScript = join(vueDemiPath, 'scripts', 'postinstall.js')
  if (!existsSync(postinstallScript)) {
    console.warn('⚠️  vue-demi postinstall script not found, skipping')
    return
  }

  console.log('🔧 Running vue-demi postinstall (Vue 2 mode)...')
  const result = Bun.spawnSync(['node', postinstallScript], {
    cwd: vueDemiPath,
    stdout: 'inherit',
    stderr: 'inherit',
  })

  if (result.exitCode === 0) {
    console.log('✅ vue-demi switched to Vue 2 mode')
  } else {
    console.warn('⚠️  vue-demi postinstall failed (non-fatal)')
  }
}

async function setup() {
  const electronVersion = await getElectronVersion()
  console.log(`\n🔧 Electron ${electronVersion}\n`)

  await setupNodeDatachannel(electronVersion)
  await setupVueDemi()

  console.log('\n✅ Setup complete!\n')
}

setup().catch(e => {
  console.error('Setup failed:', e)
  process.exit(1)
})
