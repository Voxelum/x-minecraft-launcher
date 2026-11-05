import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { config } from './electron-builder.config'
import { AppInfo } from 'app-builder-lib/out/appInfo'
import metadata from '../package.json'

const appDir = resolve(__dirname, '..')
// FpmTarget installs into /opt/<sanitizedProductName>, preserving its case.
const packageInfo = new AppInfo({ config, metadata } as any, undefined, config.linux)
const installDirectory = `/opt/${packageInfo.sanitizedProductName}`
const shellPath = (path: string) => path.replaceAll('\\', '/')
  .replace(/^([a-z]):/i, (_, drive: string) => `/${drive.toLowerCase()}`)
const template = (path: string) => readFileSync(resolve(appDir, path), 'utf8')
  .replaceAll('${executable}', config.linux.executableName)

describe('Linux package scripts', () => {
  let directory: string
  let bin: string
  let log: string
  let sandbox: string
  let installedProfile: string
  let paths: Record<string, string>

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'vardrynn-package-scripts-'))
    bin = join(directory, 'commands')
    log = join(directory, 'commands.log')
    paths = {
      [installDirectory]: join(directory, 'opt', packageInfo.sanitizedProductName),
      '/opt': join(directory, 'opt'),
      '/usr/bin': join(directory, 'usr', 'bin'),
      '/etc/apparmor.d': join(directory, 'etc', 'apparmor.d'),
      '/etc/alternatives': join(directory, 'etc', 'alternatives'),
    }
    for (const path of [bin, ...Object.values(paths), join(paths['/opt/Vardrynn'], 'resources')]) {
      mkdirSync(path, { recursive: true })
    }
    sandbox = join(paths['/opt/Vardrynn'], 'chrome-sandbox')
    installedProfile = join(paths['/etc/apparmor.d'], 'vardrynn')
    writeFileSync(sandbox, 'sandbox fixture')
    writeFileSync(join(paths['/opt/Vardrynn'], 'resources', 'apparmor-profile'), template(config.deb.appArmorProfile))
    writeFileSync(log, '')

    const command = `#!/bin/bash
name="$(basename "$0")"
echo "$name $*" >> "$XMCL_SCRIPT_LOG"
if [ "$name" = "\${XMCL_FAIL_COMMAND:-}" ]; then
  echo "$name failed" >&2
  exit 1
fi
case "$name" in
  stat)
    case "$2" in
      %u) echo "\${XMCL_DIRECTORY_OWNER:-0}" ;;
      %a) echo "\${XMCL_DIRECTORY_MODE:-755}" ;;
      %u:%g:%a) echo "\${XMCL_SANDBOX_PERMISSIONS:-0:0:4755}" ;;
      *) exit 1 ;;
    esac ;;
  apparmor_status) [ "\${XMCL_APPARMOR_ENABLED:-1}" = 1 ] ;;
  apparmor_parser)
    if [ "$1" = "--skip-kernel-load" ] && [ "\${XMCL_PROFILE_UNSUPPORTED:-0}" = 1 ]; then exit 1; fi ;;
  ischroot) [ "\${XMCL_CHROOT:-0}" = 1 ] ;;
esac
`
    for (const name of ['stat', 'chown', 'chmod', 'unshare', 'update-alternatives', 'update-mime-database',
      'update-desktop-database', 'apparmor_status', 'apparmor_parser', 'ischroot', 'ln']) {
      writeFileSync(join(bin, name), command, { mode: 0o755 })
    }
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  function run(path: string, env: NodeJS.ProcessEnv = {}, args: string[] = []) {
    const input = template(path).replace(/\/opt\/Vardrynn|\/opt(?=[\s/'"])|\/usr\/bin|\/etc\/apparmor\.d|\/etc\/alternatives/g,
      match => shellPath(paths[match]))
    return spawnSync('sh', ['-s', '--', ...args], {
      input: `export PATH='${shellPath(bin)}':"$PATH"\n${input}`,
      encoding: 'utf8',
      env: {
        ...process.env,
        XMCL_SCRIPT_LOG: shellPath(log),
        ...env,
      },
    })
  }

  const commands = () => readFileSync(log, 'utf8')

  it('configures SUID even when a root namespace probe would succeed', () => {
    const result = run(config.deb.afterInstall)
    expect(result.error).toBeUndefined()
    expect(result.status, result.stderr).toBe(0)
    expect(commands()).toContain(`chown root:root ${shellPath(sandbox)}`)
    expect(commands()).toContain(`chmod 4755 ${shellPath(sandbox)}`)
    expect(commands().indexOf('chown root:root')).toBeLessThan(commands().indexOf('chmod 4755'))
    expect(commands()).not.toContain('unshare ')
    expect(commands()).not.toContain('chmod 0755')
    expect(commands()).toContain('update-alternatives --install')
    expect(commands()).toContain('apparmor_parser --replace --write-cache --skip-read-cache')
    expect(readFileSync(installedProfile, 'utf8')).toContain('"/opt/Vardrynn/vardrynn"')
  })

  it.each(['chown', 'chmod'])('fails installation when %s fails', (command) => {
    const result = run(config.deb.afterInstall, { XMCL_FAIL_COMMAND: command })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Vardrynn installation failed')
    expect(commands()).not.toContain('update-alternatives')
    if (command === 'chown') expect(commands()).not.toContain('chmod 4755')
  })

  it('verifies actual helper ownership and mode after configuring them', () => {
    const result = run(config.deb.afterInstall, { XMCL_SANDBOX_PERMISSIONS: '1000:1000:755' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('sandbox must be owned by root:root with mode 4755')
  })

  it.each([
    { XMCL_DIRECTORY_OWNER: '1000' },
    { XMCL_DIRECTORY_MODE: '775' },
    { XMCL_DIRECTORY_MODE: '757' },
  ])('rejects unsafe installation directories (%j)', (env) => {
    const result = run(config.deb.afterInstall, env)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('must be root-owned and not writable')
    expect(commands()).not.toContain('chown ')
  })

  it('fails explicitly when the helper is missing', () => {
    rmSync(sandbox)
    const result = run(config.deb.afterInstall)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('must be a regular file')
  })

  it.skipIf(process.platform === 'win32')('rejects a symlinked helper', () => {
    rmSync(sandbox)
    symlinkSync(join(directory, 'commands.log'), sandbox)
    const result = run(config.deb.afterInstall)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('not a symbolic link')
    expect(commands()).not.toContain('chown ')
  })

  it('retains SUID support with older AppArmor versions', () => {
    const result = run(config.deb.afterInstall, { XMCL_PROFILE_UNSUPPORTED: '1' })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('SUID sandbox remains configured')
    expect(existsSync(installedProfile)).toBe(false)
    expect(commands()).toContain('chmod 4755')
    expect(commands()).not.toContain('apparmor_parser --replace')
  })

  it('configures SUID on systems without active AppArmor', () => {
    const result = run(config.deb.afterInstall, { XMCL_APPARMOR_ENABLED: '0' })
    expect(result.status, result.stderr).toBe(0)
    expect(commands()).toContain('chmod 4755')
    expect(commands()).not.toContain('apparmor_parser ')
  })

  it('reports an AppArmor reload failure', () => {
    const parser = join(bin, 'apparmor_parser')
    writeFileSync(parser, `#!/bin/bash
if [ "$1" = "--replace" ]; then exit 1; fi
`, { mode: 0o755 })
    const retry = run(config.deb.afterInstall)
    expect(retry.status).not.toBe(0)
    expect(retry.stderr).toContain('cannot load the Vardrynn AppArmor profile')
  })

  it('installs the profile without loading it inside a chroot', () => {
    const result = run(config.deb.afterInstall, { XMCL_CHROOT: '1' })
    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(installedProfile)).toBe(true)
    expect(commands()).not.toContain('apparmor_parser --replace')
  })

  it.each(['1', 'upgrade'])('does not undo the new installation during an upgrade (%s)', (argument) => {
    expect(run(config.deb.afterInstall).status).toBe(0)
    writeFileSync(log, '')
    const result = run(config.deb.afterRemove, {}, [argument])
    expect(result.status, result.stderr).toBe(0)
    expect(commands()).toBe('')
    expect(existsSync(installedProfile)).toBe(true)
  })

  it('unregisters the installed path and unloads the profile on removal', () => {
    expect(run(config.deb.afterInstall).status).toBe(0)
    writeFileSync(log, '')
    const result = run(config.deb.afterRemove, {}, ['0'])
    expect(result.status, result.stderr).toBe(0)
    expect(commands()).toContain(`update-alternatives --remove vardrynn ${shellPath(paths['/opt/Vardrynn'])}/vardrynn`)
    expect(commands()).toContain(`apparmor_parser --remove ${shellPath(installedProfile)}`)
    expect(existsSync(installedProfile)).toBe(false)
  })

  it('leaves XMCL executable and AppArmor records untouched on install and removal', () => {
    const upstreamExecutable = join(paths['/usr/bin'], 'xmcl')
    const upstreamProfile = join(paths['/etc/apparmor.d'], 'xmcl')
    writeFileSync(upstreamExecutable, 'upstream executable')
    writeFileSync(upstreamProfile, 'upstream profile')
    expect(run(config.deb.afterInstall).status).toBe(0)
    expect(run(config.deb.afterRemove, {}, ['0']).status).toBe(0)
    expect(readFileSync(upstreamExecutable, 'utf8')).toBe('upstream executable')
    expect(readFileSync(upstreamProfile, 'utf8')).toBe('upstream profile')
    expect(commands()).not.toContain('update-alternatives --remove xmcl ')
  })

  it('does not delete the profile when unloading it fails', () => {
    expect(run(config.deb.afterInstall).status).toBe(0)
    const result = run(config.deb.afterRemove, { XMCL_FAIL_COMMAND: 'apparmor_parser' }, ['0'])
    expect(result.status).not.toBe(0)
    expect(existsSync(installedProfile)).toBe(true)
  })
})
