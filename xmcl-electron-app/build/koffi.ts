import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path, { join } from 'path'
import { Readable, pipeline } from 'stream'
import { extract } from 'tar-stream'
import { promisify } from 'util'
import { createGunzip } from 'zlib'

const nativeIntegrity: Record<string, string> = {
  '3.1.2-darwin-arm64': 'sha512-32pU4pNZABIz+l9DNJl51Y+jur4vv+SF4Ip2CSF4OUg1xUyefoLpX0NttDmzGITIrneUEVSEN+dT22524ESKBw==',
  '3.1.2-darwin-x64': 'sha512-S+H6LQgUoMj77BqDegwlRaxwLXDfwvSJGuceOqtH0I5V8rzKLmu/hC7NBlxOoAlvKlcV63FtdNiE2E9YSltffg==',
  '3.1.2-linux-arm64': 'sha512-f0hqAIlFcL9wlRGJ/uCfyfspqnGaASk2gLx1UAP3RBgMQl68D1e+fiHNdXa7g9d76ttmpA8/PGNAqc1X4Byy1Q==',
  '3.1.2-linux-x64': 'sha512-Oxvo6F3Edzy/Jm2EtbHWkJ2xRB0mXDAe63k5+USL5uiGE5xZjwEUDOBKIhv2BpCZSOAJrfoojFFogj6+ICKQhw==',
  '3.1.2-win32-arm64': 'sha512-8Wn6phw7y53uI52+aBPAqEfZ5pj/HCjg/YtdthqSWYHy+d0MhyASKlcmuP0B5raxQnnA1Bm9LC8UO3M3RojeBw==',
  '3.1.2-win32-ia32': 'sha512-FkKaPBMawgHMNnp1FwLldXMNvEa139GXkxPi9JD9xU71Kh/ZmuEYHGSD6JwZDmDr4jekVrBrr+eGZ+j6C2mkXg==',
  '3.1.2-win32-x64': 'sha512-FeFC59UU1XX4J3ZaqKrsrEzczzB5qksMJo7/R45vIg8mGNVSLMVE85JRiZpjcp9i5Lbav5Vw47QvwFzBgIfvlw==',
}

export async function resolveKoffiBinary(platform: NodeJS.Platform, arch: string) {
  const koffiRoot = path.dirname(require.resolve('koffi'))
  const packageName = `@koromix/koffi-${platform}-${arch}`
  try {
    const entry = require.resolve(packageName, { paths: [koffiRoot] })
    const binary = join(path.dirname(entry), `${platform}_${arch}`, 'koffi.node')
    if (existsSync(binary)) return binary
  } catch {
    // Cross-architecture optional packages are not linked by pnpm.
  }

  const koffiPackage = JSON.parse(await readFile(join(koffiRoot, 'package.json'), 'utf8')) as { version: string }
  const key = `${koffiPackage.version}-${platform}-${arch}`
  const integrity = nativeIntegrity[key]
  if (!integrity) throw new Error(`No Koffi native package is available for ${platform}-${arch} at ${koffiPackage.version}`)

  const cachePath = join(__dirname, '..', 'node_modules', '.cache', 'koffi', key, 'koffi.node')
  if (existsSync(cachePath)) return cachePath

  const packageSlug = `koffi-${platform}-${arch}`
  const response = await fetch(`https://registry.npmjs.org/${packageName}/-/${packageSlug}-${koffiPackage.version}.tgz`)
  if (!response.ok) throw new Error(`Cannot download ${packageName}: ${response.status} ${response.statusText}`)
  const archive = Buffer.from(await response.arrayBuffer())
  const [algorithm, expected] = integrity.split('-', 2)
  const actual = createHash(algorithm).update(archive).digest('base64')
  if (actual !== expected) throw new Error(`Integrity check failed for ${packageName}@${koffiPackage.version}`)

  let binary: Buffer | undefined
  const unpack = extract()
  unpack.on('entry', (header, stream, next) => {
    if (header.name === `package/${platform}_${arch}/koffi.node`) {
      const chunks: Buffer[] = []
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => {
        binary = Buffer.concat(chunks)
        next()
      })
    } else {
      stream.on('end', next)
      stream.resume()
    }
  })
  await promisify(pipeline)(Readable.from([archive]), createGunzip(), unpack)
  if (!binary) throw new Error(`${packageName} does not contain ${platform}_${arch}/koffi.node`)
  await mkdir(path.dirname(cachePath), { recursive: true })
  await writeFile(cachePath, binary)
  return cachePath
}