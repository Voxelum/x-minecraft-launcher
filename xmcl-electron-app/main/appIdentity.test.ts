import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { mkdtempSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { configureAppIdentity } from './appIdentity'

describe('Electron app identity', () => {
  it('isolates Chromium storage beside XMCL without inspecting or migrating its profile', () => {
    let name = 'Electron'
    const directory = mkdtempSync(join(tmpdir(), 'vardrynn-identity-'))
    const paths = { appData: directory, userData: join(directory, 'xmcl') }
    try {
      configureAppIdentity({
        setName(value) { name = value },
        getPath() { return paths.appData },
        setPath(key, value) {
          expect(statSync(value).isDirectory()).toBe(true)
          paths[key] = value
        },
      })
      expect(name).toBe('Vardrynn')
      expect(paths).toEqual({ appData: directory, userData: join(directory, 'vardrynn') })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
