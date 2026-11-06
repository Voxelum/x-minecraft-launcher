import { describe, expect, it } from 'vitest'
import { parseVardrynnRelease, parseVardrynnReleaseKey, releaseSignaturePayload, selectVerifiedAsset } from '~/app/vardrynnRelease'
import { buildReleaseManifest, classifyPackage, generateReleaseKeyPair, signaturePayload } from './vardrynnRelease'

const keys = generateReleaseKeyPair()
const base = {
  version: '1.2.0', channel: 'stable', publishedAt: '2026-11-04T00:00:00Z', notesUrl: 'https://example.com/n',
  downloadBase: 'https://downloads.example.com/releases/1.2.0', signingKey: keys.privateKey, publicKey: keys.publicKey,
}
const files = [
  { name: 'vardrynn-1.2.0-arm64.dmg', bytes: Buffer.from('mac') },
  { name: 'vardrynn-1.2.0-x64.deb', bytes: Buffer.from('deb') },
  { name: 'vardrynn-1.2.0-x64.AppImage', bytes: Buffer.from('appimage') },
  { name: 'vardrynn-1.2.0-win-x64.zip', bytes: Buffer.from('zip') },
]

describe('release manifest', () => {
  it('signs installable packages so the launcher accepts exactly them', () => {
    const manifest = buildReleaseManifest({ ...base, files })
    expect(manifest.assets.map((a) => `${a.platform}-${a.arch}`).sort()).toEqual(['darwin-arm64', 'linux-x64'])
    expect(manifest.assets[0].url).toBe('https://downloads.example.com/releases/1.2.0/vardrynn-1.2.0-arm64.dmg')
    const release = parseVardrynnRelease(manifest)!
    const key = parseVardrynnReleaseKey(keys.publicKey)!
    expect(selectVerifiedAsset(release, 'darwin', 'arm64', key)).toBeDefined()
    expect(selectVerifiedAsset(release, 'linux', 'x64', key)).toBeDefined()
    expect(selectVerifiedAsset(release, 'win32', 'x64', key)).toBeUndefined()
  })

  it('uses the payload format the launcher verifies', () => {
    const asset = { platform: 'darwin', arch: 'arm64', sha256: 'a'.repeat(64) }
    expect(signaturePayload('1.2.0', asset)).toEqual(releaseSignaturePayload('1.2.0', asset))
  })

  it('refuses a signing key that is not the embedded public key', () => {
    expect(() => buildReleaseManifest({ ...base, publicKey: generateReleaseKeyPair().publicKey, files })).toThrow('does not match')
  })

  it('refuses non-https downloads, empty releases and duplicate targets', () => {
    expect(() => buildReleaseManifest({ ...base, downloadBase: 'http://example.com', files })).toThrow('https')
    expect(() => buildReleaseManifest({ ...base, files: [files[3]] })).toThrow('No installable')
    expect(() => buildReleaseManifest({ ...base, files: [files[1], files[1]] })).toThrow('More than one')
  })

  it('classifies only this version and known installers', () => {
    expect(classifyPackage('vardrynn-1.2.0-arm64.dmg', '1.2.0')).toEqual({ platform: 'darwin', arch: 'arm64' })
    // electron-builder's real name for the x64 Debian package.
    expect(classifyPackage('vardrynn-1.2.0-amd64.deb', '1.2.0')).toEqual({ platform: 'linux', arch: 'x64' })
    expect(classifyPackage('vardrynn-1.2.0-x64.appx', '1.2.0')).toBeUndefined()
    expect(classifyPackage('vardrynn-1.2.1-arm64.dmg', '1.2.0')).toBeUndefined()
    expect(classifyPackage('vardrynn-1.2.0-arm64.dmg.blockmap', '1.2.0')).toBeUndefined()
    expect(classifyPackage('xmcl-1.2.0-arm64.dmg', '1.2.0')).toBeUndefined()
  })
})
