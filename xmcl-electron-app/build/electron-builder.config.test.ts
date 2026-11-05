import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from './electron-builder.config'

describe('macOS packaging', () => {
  it('declares local network access for Vardrynn and its Minecraft subprocesses', () => {
    expect(config.mac.extendInfo.NSLocalNetworkUsageDescription).toBe(
      'Vardrynn and Minecraft need access to your local network to discover and connect to LAN games and servers.',
    )
  })
})

describe('Linux system packaging', () => {
  // The package scripts and AppArmor profile assume /opt/Vardrynn. An upstream postinstall used to
  // rewrite electron-builder to /opt/xmcl, which made every deb fail its post-install check.
  it('installs to /opt/<productName>, not a rewritten prefix', () => {
    const builder = resolve(__dirname, '..', 'node_modules', 'app-builder-lib', 'out', 'targets')
    for (const file of ['FpmTarget.js', 'LinuxTargetHelper.js']) {
      const source = readFileSync(resolve(builder, file), 'utf8')
      expect(source).toContain('installPrefix}/${appInfo.sanitizedProductName}')
      expect(source).not.toContain('installPrefix}/xmcl')
    }
    expect(readFileSync(resolve(__dirname, '..', 'postinstall.ts'), 'utf8')).not.toContain('installPrefix}/xmcl\'')
  })

  it.each(['deb', 'rpm', 'pacman'] as const)('uses Vardrynn-owned scripts for %s', (target) => {
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
    expect(profile).toContain('profile "vardrynn" "/opt/Vardrynn/vardrynn" flags=(unconfined)')
    expect(profile).toContain('userns,')
  })
})
