import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertClickToRun, assertRawBootstrap, assetNames, productName, stageApplication, stageRuntime } from './packaging'

const root = dirname(fileURLToPath(import.meta.url))
const version = '0.69.0'
let fixture: string

beforeEach(async () => {
  fixture = join(root, 'build', 'output', 'tests', randomUUID())
  await mkdir(fixture, { recursive: true })
})
afterEach(async () => {
  await rm(fixture, { recursive: true, force: true })
})

async function stageFixture() {
  const dist = join(fixture, 'dist')
  await mkdir(join(dist, 'renderer'), { recursive: true })
  for (const name of ['main.cjs', 'worker.cjs', 'native.node', 'main.cjs.map', join('renderer', 'index.html'), join('renderer', 'app.js.map')]) {
    await writeFile(join(dist, name), 'fixture')
  }
  return dist
}

async function writeCTR() {
  const archive = Buffer.from('embedded application fixture')
  const runtime = Buffer.from('runtime fixture')
  const name = Buffer.from(productName)
  const entry = Buffer.from('DeskGap.exe')
  const releaseVersion = Buffer.from(version)
  const footer = Buffer.alloc(108)
  footer.write('DGCLK001')
  footer.writeUInt32LE(1, 8)
  footer.writeUInt32LE(name.length, 12)
  footer.writeUInt32LE(entry.length, 16)
  footer.writeUInt32LE(releaseVersion.length, 20)
  footer.writeBigUInt64LE(BigInt(runtime.length), 28)
  footer.writeBigUInt64LE(BigInt(archive.length), 36)
  createHash('sha256').update(archive).digest().copy(footer, 76)
  const file = join(fixture, assetNames(version).runtime)
  await writeFile(file, Buffer.concat([Buffer.from('MZ'), runtime, archive, name, entry, releaseVersion, footer]))
  return file
}

describe('DeskGap single-executable packaging', () => {
  it('stages the root version and renderer without separate trust config, maps, or development files', async () => {
    const dist = await stageFixture()
    const app = join(fixture, 'app')
    await writeFile(join(fixture, '.env'), 'PRIVATE SECRET')
    await stageApplication(dist, app, version)
    expect(JSON.parse(await readFile(join(app, 'package.json'), 'utf8'))).toMatchObject({
      name: 'xmcl-deskgap', productName, version, main: 'dist/main.cjs',
    })
    expect(await readdir(app)).toEqual(['dist', 'package.json'])
    expect(await readdir(join(app, 'dist'))).toEqual(['main.cjs', 'native.node', 'renderer', 'worker.cjs'])
    expect(await readdir(join(app, 'dist', 'renderer'))).toEqual(['index.html'])
  })

  it('rejects Electron ASAR input', async () => {
    const dist = await stageFixture()
    await writeFile(join(dist, 'app.asar.gz'), 'fixture')
    await expect(stageApplication(dist, join(fixture, 'app'), version)).rejects.toThrow('ASAR')
  })

  it('removes demo/browser data from the copy, preserves the source, and rejects overlapping staging', async () => {
    const source = join(fixture, 'DeskGap')
    const destination = join(fixture, 'runtime-staging')
    await mkdir(join(source, 'resources', 'app'), { recursive: true })
    await mkdir(join(source, 'DeskGap.exe.WebView2'))
    await writeFile(join(source, 'resources', 'app', 'demo.js'), 'demo')
    await writeFile(join(source, 'resources', 'runtime.dat'), 'runtime')
    await writeFile(join(source, 'DeskGap.exe.WebView2', 'History'), 'fixture browsing history')
    await writeFile(join(source, 'DeskGap.exe'), 'MZ runtime')
    await stageRuntime(source, destination)
    expect(await readdir(join(destination, 'resources'))).toEqual(['runtime.dat'])
    expect(await readdir(destination)).not.toContain('DeskGap.exe.WebView2')
    expect(await readFile(join(source, 'DeskGap.exe.WebView2', 'History'), 'utf8')).toBe('fixture browsing history')
    for (const overlapping of [source, join(source, 'staging'), fixture]) {
      await expect(stageRuntime(source, overlapping)).rejects.toThrow('must not overlap')
    }
    expect(await readFile(join(source, 'resources', 'app', 'demo.js'), 'utf8')).toBe('demo')
  })

  it('accepts only raw bootstrap input, not another packaged application', async () => {
    const raw = join(fixture, 'bootstrap.exe')
    await writeFile(raw, 'MZ raw bootstrap')
    await expect(assertRawBootstrap(raw)).resolves.toBeUndefined()
    await expect(assertRawBootstrap(await writeCTR())).rejects.toThrow('not a packaged')
    await writeFile(raw, 'not executable')
    await expect(assertRawBootstrap(raw)).rejects.toThrow('Windows executable')
  })

  it('checks embedded application bytes and identity before external Authenticode signing', async () => {
    const file = await writeCTR()
    await expect(assertClickToRun(file, version)).resolves.toBeUndefined()
    await expect(assertClickToRun(file, '0.70.0')).rejects.toThrow('identity or version')
    const bytes = await readFile(file)
    bytes[2 + Buffer.byteLength('runtime fixture')] ^= 1
    await writeFile(file, bytes)
    await expect(assertClickToRun(file, version)).rejects.toThrow('checksum mismatch')
  })

  it('uses the standard release version in a Windows x64 EXE filename', () => {
    expect(assetNames(version)).toEqual({ runtime: 'xmcl-deskgap-0.69.0-win32-x64.exe' })
    for (const invalid of ['v0.69.0', 'deskgap-v0.69.0', '../bad', '']) {
      expect(() => assetNames(invalid)).toThrow('valid semver')
    }
  })

  it.skipIf(!process.env.DESKGAP_PACKAGING_SOURCE)('creates only a CTR using the pinned runtime helper, without demo/browser data', async () => {
    const app = join(fixture, 'app')
    await stageApplication(await stageFixture(), app, version)
    const runtime = join(fixture, 'runtime')
    const staging = join(fixture, 'runtime-staging')
    await mkdir(join(runtime, 'resources', 'app'), { recursive: true })
    await mkdir(join(runtime, 'DeskGap.exe.WebView2'))
    await writeFile(join(runtime, 'DeskGap.exe'), 'MZ runtime fixture')
    await writeFile(join(runtime, 'DeskGap.exe.WebView2', 'History'), 'fixture browsing history')
    await writeFile(join(runtime, 'resources', 'app', 'demo.js'), 'demo')
    const bootstrap = join(fixture, 'bootstrap.exe')
    // A structural unsigned PE32+ fixture, not a runnable native bootstrap.
    const bootstrapBytes = Buffer.alloc(512)
    bootstrapBytes.write('MZ')
    bootstrapBytes.writeUInt32LE(0x80, 0x3c)
    bootstrapBytes.write('PE\0\0', 0x80)
    bootstrapBytes.writeUInt16LE(0x8664, 0x84)
    bootstrapBytes.writeUInt16LE(240, 0x94)
    bootstrapBytes.writeUInt16LE(0x20b, 0x98)
    bootstrapBytes.writeUInt32LE(16, 0x98 + 108)
    await writeFile(bootstrap, bootstrapBytes)
    await stageRuntime(runtime, staging)
    const output = join(fixture, 'release')
    await mkdir(output)
    const file = join(output, assetNames(version).runtime)
    const result = spawnSync(process.execPath, [
      join(process.env.DESKGAP_PACKAGING_SOURCE!, 'node', 'scripts', 'package-click-to-run.mjs'),
      bootstrap, staging, app, file, version,
    ], { encoding: 'utf8' })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    await assertClickToRun(file, version)
    expect(await readdir(output)).toEqual([assetNames(version).runtime])
    const executable = await readFile(file)
    const runtimeSize = Number(executable.readBigUInt64LE(executable.length - 108 + 28))
    const bootstrapSize = (await readFile(bootstrap)).length
    const runtimeTar = zstdDecompressSync(executable.subarray(bootstrapSize, bootstrapSize + runtimeSize))
    expect(runtimeTar.includes(Buffer.from('resources/app/demo.js'))).toBe(false)
    expect(runtimeTar.includes(Buffer.from('DeskGap.exe.WebView2'))).toBe(false)
    expect(runtimeTar.includes(Buffer.from('fixture browsing history'))).toBe(false)
  })
})
