import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { cp, mkdir, open, rm, stat, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { valid } from 'semver'

export const productName = 'XMCL DeskGap'

export function assetNames(version: string) {
  if (typeof version !== 'string' || !/^\d/.test(version) || version.trim() !== version || !valid(version)) {
    throw new Error('DeskGap release version must be valid semver')
  }
  return { runtime: `xmcl-deskgap-${version}-win32-x64.exe` }
}

export async function stageApplication(dist: string, destination: string, version: string) {
  assetNames(version)
  await Promise.all(['main.cjs', join('renderer', 'index.html')].map(file => stat(join(dist, file))))
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  await cp(dist, join(destination, 'dist'), {
    recursive: true,
    filter(source) {
      if (/\.asar(?:\.|$)/i.test(basename(source))) throw new Error('Electron ASAR assets cannot be packaged for DeskGap')
      return !source.endsWith('.map')
    },
  })
  await writeFile(join(destination, 'package.json'), JSON.stringify({
    name: 'xmcl-deskgap',
    productName,
    version,
    main: 'dist/main.cjs',
    description: 'DeskGap host for X Minecraft Launcher',
    license: 'MIT',
  }, null, 2) + '\n')
}

export async function stageRuntime(source: string, destination: string) {
  source = resolve(source)
  destination = resolve(destination)
  const contains = (parent: string, child: string) => {
    const path = relative(parent, child)
    return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path))
  }
  if (contains(source, destination) || contains(destination, source)) {
    throw new Error('Runtime source and staging directories must not overlap')
  }
  if (!(await stat(join(source, 'DeskGap.exe'))).isFile()) throw new Error('Runtime directory must contain DeskGap.exe')
  await rm(destination, { recursive: true, force: true })
  await cp(source, destination, {
    recursive: true,
    filter: path => {
      const entry = relative(source, path).toLowerCase()
      return entry !== join('resources', 'app') && entry !== 'deskgap.exe.webview2'
    },
  })
}

export async function assertRawBootstrap(path: string) {
  const file = await open(path, 'r')
  try {
    const header = Buffer.alloc(2)
    if ((await file.read(header, 0, 2, 0)).bytesRead !== 2 || header.toString('ascii') !== 'MZ') {
      throw new Error('Raw bootstrap must be a Windows executable')
    }
    const size = (await file.stat()).size
    if (size >= 108) {
      const marker = Buffer.alloc(8)
      await file.read(marker, 0, marker.length, size - 108)
      if (marker.toString('ascii') === 'DGCLK001') {
        throw new Error('Use raw DeskGapBootstrap.exe, not a packaged click-to-run executable')
      }
    }
  } finally {
    await file.close()
  }
}

export async function assertClickToRun(path: string, version: string) {
  const file = await open(path, 'r')
  try {
    const size = (await file.stat()).size
    const footer = Buffer.alloc(108)
    if (size < footer.length || (await file.read(footer, 0, footer.length, size - footer.length)).bytesRead !== footer.length ||
      footer.toString('ascii', 0, 8) !== 'DGCLK001' || footer.readUInt32LE(8) !== 1) {
      throw new Error('Output must be an unsigned DeskGap click-to-run executable before SignPath signing')
    }
    const nameLength = footer.readUInt32LE(12)
    const entryLength = footer.readUInt32LE(16)
    const versionLength = footer.readUInt32LE(20)
    const manifestLength = footer.readUInt32LE(24)
    const runtimeSize = footer.readBigUInt64LE(28)
    const applicationSize = footer.readBigUInt64LE(36)
    const identityLength = nameLength + entryLength + versionLength
    const identityOffset = size - footer.length - manifestLength - identityLength
    if (identityLength > 4096 || applicationSize === 0n || runtimeSize === 0n ||
      BigInt(identityOffset) - applicationSize - runtimeSize < 2n) throw new Error('Invalid click-to-run layout')
    const identity = Buffer.alloc(identityLength)
    await file.read(identity, 0, identityLength, identityOffset)
    if (identity.toString('utf8', 0, nameLength) !== productName ||
      identity.toString('utf8', nameLength, nameLength + entryLength) !== 'DeskGap.exe' ||
      identity.toString('utf8', nameLength + entryLength) !== version) {
      throw new Error('Click-to-run has the wrong XMCL identity or version')
    }
    const hash = createHash('sha256')
    for await (const bytes of createReadStream(path, { start: identityOffset - Number(applicationSize), end: identityOffset - 1 })) {
      hash.update(bytes)
    }
    if (hash.digest('hex') !== footer.subarray(76, 108).toString('hex')) {
      throw new Error('Embedded XMCL application payload checksum mismatch')
    }
  } finally {
    await file.close()
  }
}
