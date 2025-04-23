import { JavaVersion } from '@xmcl/core';
import { DEFAULT_RUNTIME_ALL_URL, JavaRuntimeTargetType, JavaRuntimes } from '@xmcl/installer';
import { LauncherApp } from '~/app';
import { kGFW } from '~/gfw';
import { getApiSets, kSettings, shouldOverrideApiSet } from '~/settings';

function normalizeUrls(url: string, fileHost?: string | string[]): string[] {
  if (!fileHost) {
    return [url]
  }
  if (typeof fileHost === 'string') {
    const u = new URL(url)
    u.hostname = fileHost
    const result = u.toString()
    if (result !== url) {
      return [result, url]
    }
    return [result]
  }
  const result = fileHost.map((host) => {
    const u = new URL(url)
    u.hostname = host
    return u.toString()
  })

  if (result.indexOf(url) === -1) {
    result.push(url)
  }

  return result
}

/**
 * Get manifest for a specific java runtime target from official api
 */
export async function getOfficialJavaManifest(app: LauncherApp, runtimeTarget: JavaRuntimeTargetType | string) {
  const settings = await app.registry.get(kSettings)
  const gfw = await app.registry.get(kGFW)
  let apiHost: string[] | undefined
  const apis = getApiSets(settings)
  if (shouldOverrideApiSet(settings, gfw.inside)) {
    apiHost = apis.map(a => new URL(a.url).hostname)
  }
  if (!apiHost) {
    const apis = getApiSets(settings)
    apiHost = apis.map(a => new URL(a.url).hostname)

    if (!shouldOverrideApiSet(settings, gfw.inside)) {
      apiHost.unshift('https://launcher.mojang.com')
    }
  }

  const resp = await app.fetch(normalizeUrls(DEFAULT_RUNTIME_ALL_URL, apiHost)[0], {})
  const runtimes = await resp.json() as JavaRuntimes
  const current = resolveTargetPlatform(runtimes)
  const result = current?.[runtimeTarget]?.[0]

  return result
}

function resolveTargetPlatform(manifest: JavaRuntimes) {
  if (process.platform === 'win32') {
    if (process.arch === 'x64') {
      return manifest['windows-x64'];
    }
    if (process.arch === 'ia32') {
      return manifest['windows-x86'];
    }
    if (process.arch === 'arm64') {
      return manifest['windows-arm64'];
    }
    return manifest['windows-x64'];
  }
  if (process.platform === 'darwin') {
    if (process.arch === 'arm64') {
      return manifest['mac-os-arm64'];
    }
    return manifest['mac-os'];
  }
  if (process.platform === 'linux' || process.platform === 'openbsd' || process.platform === 'freebsd') {
    if (process.arch === 'ia32') {
      return manifest['linux-i386'];
    }
    if (process.arch === 'x64') {
      return manifest.linux;
    }
    return manifest.linux;
  }
}
