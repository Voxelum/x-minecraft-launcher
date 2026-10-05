import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from './electron-builder.config'

describe('macOS packaging', () => {
  it('declares local network access for XMCL and its Minecraft subprocesses', () => {
    expect(config.mac.extendInfo.NSLocalNetworkUsageDescription).toBe(
      'XMCL and Minecraft need access to your local network to discover and connect to LAN games and servers.',
    )
  })
})

describe('Linux system packaging', () => {
  it.each(['deb', 'rpm', 'pacman'] as const)('uses XMCL-owned scripts for %s', (target) => {
    expect(config[target]).toEqual({
      afterInstall: 'build/linux/after-install.tpl',
      afterRemove: 'build/linux/after-remove.tpl',
      appArmorProfile: 'build/linux/apparmor-profile.tpl',
      fpm: [`--after-upgrade=${resolve(__dirname, 'linux', 'after-install.tpl')}`],
    })
    const scripts = config[target]
    for (const template of [scripts.afterInstall, scripts.afterRemove, scripts.appArmorProfile]) {
      expect(readFileSync(resolve(__dirname, '..', template), 'utf8')).not.toContain('${sanitizedProductName}')
    }
    expect(readFileSync(resolve(__dirname, '..', scripts.afterInstall), 'utf8')).not.toContain('${executable}')
  })

  it('allows namespaces for the actual installed executable', () => {
    const profile = readFileSync(resolve(__dirname, '..', config.deb.appArmorProfile), 'utf8')
      .replaceAll('${executable}', config.linux.executableName)
    expect(profile).toContain('profile "xmcl" "/opt/xmcl/xmcl" flags=(unconfined)')
    expect(profile).toContain('userns,')
  })
})
