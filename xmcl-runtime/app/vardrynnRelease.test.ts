import { generateKeyPairSync, sign } from 'crypto'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  isNewerVersion,
  parseVardrynnRelease,
  parseVardrynnReleaseKey,
  releaseSignaturePayload,
  selectVerifiedAsset,
  sha256File,
  verifyReleaseSignature,
} from './vardrynnRelease'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const rawPublic = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)
const SHA = 'a'.repeat(64)

function signedAsset(version: string, overrides: Record<string, string> = {}) {
  const base = { platform: 'darwin', arch: 'arm64', url: 'https://downloads.example.com/v.dmg', sha256: SHA }
  const asset = { ...base, ...overrides }
  const signature = sign(null, releaseSignaturePayload(version, asset), privateKey).toString('base64')
  return { ...asset, signature }
}

const release = (assets: unknown[], version = '1.2.0') => ({
  apiVersion: 'v1', version, channel: 'stable', publishedAt: '2026-11-04T00:00:00Z', notesUrl: 'https://example.com/n', assets,
})

describe('release signatures', () => {
  it('accepts a signature over the exact version, platform, arch and hash', () => {
    expect(verifyReleaseSignature(rawPublic, '1.2.0', signedAsset('1.2.0'))).toBe(true)
  })

  it.each([
    ['another version', (a: any) => verifyReleaseSignature(rawPublic, '1.2.1', a)],
    ['another hash', (a: any) => verifyReleaseSignature(rawPublic, '1.2.0', { ...a, sha256: 'b'.repeat(64) })],
    ['another platform', (a: any) => verifyReleaseSignature(rawPublic, '1.2.0', { ...a, platform: 'win32' })],
    ['a malformed signature', (a: any) => verifyReleaseSignature(rawPublic, '1.2.0', { ...a, signature: 'AAAA' })],
    ['another key', (a: any) => verifyReleaseSignature(
      generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).subarray(-32), '1.2.0', a)],
  ])('rejects %s', (_, check) => {
    expect(check(signedAsset('1.2.0'))).toBe(false)
  })

  it('only selects an asset for this host whose signature verifies', () => {
    const forged = { ...signedAsset('1.2.0'), signature: Buffer.alloc(64).toString('base64') }
    const parsed = parseVardrynnRelease(release([forged, signedAsset('1.2.0', { platform: 'linux', arch: 'x64' })]))!
    expect(selectVerifiedAsset(parsed, 'darwin', 'arm64', rawPublic)).toBeUndefined()
    expect(selectVerifiedAsset(parsed, 'linux', 'x64', rawPublic)?.platform).toBe('linux')
  })

  it('parses only a 32 byte base64 public key', () => {
    expect(parseVardrynnReleaseKey(rawPublic.toString('base64'))).toEqual(rawPublic)
    expect(parseVardrynnReleaseKey('')).toBeUndefined()
    expect(parseVardrynnReleaseKey(undefined)).toBeUndefined()
    expect(parseVardrynnReleaseKey('AAAA')).toBeUndefined()
  })
})

describe('release parsing', () => {
  it('rejects other api versions and malformed versions', () => {
    expect(parseVardrynnRelease({ ...release([]), apiVersion: 'v2' })).toBeUndefined()
    expect(parseVardrynnRelease(release([], 'latest'))).toBeUndefined()
    expect(parseVardrynnRelease(null)).toBeUndefined()
  })

  it('drops assets with unsafe urls, upstream hosts or bad hashes', () => {
    const parsed = parseVardrynnRelease(release([
      signedAsset('1.2.0'),
      signedAsset('1.2.0', { url: 'http://downloads.example.com/v.dmg' }),
      signedAsset('1.2.0', { url: 'https://xmcl.app/v.dmg' }),
      signedAsset('1.2.0', { url: 'https://github.com/Voxelum/x-minecraft-launcher/releases/download/v1/x.dmg' }),
      signedAsset('1.2.0', { sha256: 'xyz' }),
    ]))!
    expect(parsed.assets).toHaveLength(1)
  })
})

describe('version ordering', () => {
  it.each([
    ['1.2.1', '1.2.0', true],
    ['1.10.0', '1.9.9', true],
    ['1.2.0', '1.2.0', false],
    ['1.2.0', '1.2.1', false],
    ['1.2.0', '1.2.0-beta.1', true],
    ['1.2.0-beta.1', '1.2.0', false],
    ['1.2.0-beta.2', '1.2.0-beta.1', true],
    ['1.2.0-beta.10', '1.2.0-beta.9', true],
    ['v1.3.0', '1.2.0', true],
  ])('%s newer than %s: %s', (a, b, expected) => {
    expect(isNewerVersion(a, b)).toBe(expected)
  })
})

describe('sha256File', () => {
  it('hashes file contents', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vardrynn-hash-'))
    try {
      await writeFile(join(dir, 'f'), 'abc')
      expect(await sha256File(join(dir, 'f'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
