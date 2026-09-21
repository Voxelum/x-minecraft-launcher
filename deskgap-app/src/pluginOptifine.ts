import type { LauncherAppPlugin } from '@xmcl/runtime/app'
import { kGFW } from '@xmcl/runtime/infra/gfw'
import { kOptifineInstaller } from '@xmcl/runtime/install/optifine'
import { kSettings, shouldOverrideApiSet } from '@xmcl/runtime/settings/settings'
import { AnyError } from '@xmcl/utils'
import { resolveOptifineDownloadSource } from '../../xmcl-electron-app/main/controllers/optifineSource'

export const pluginOptifine: LauncherAppPlugin = async (app) => {
  const gfw = await app.registry.get(kGFW)
  const settings = await app.registry.get(kSettings)
  app.registry.register(kOptifineInstaller, async (version) => {
    const inside = (await gfw.signal) === 'cn'
    const source = resolveOptifineDownloadSource(version, shouldOverrideApiSet(settings, inside))
    if (source.type === 'mirror') return source.url
    throw new AnyError(
      'OptifineNoMirrorError',
      'OptiFine can only be downloaded from the BMCLAPI mirror, which is disabled by your API source preference.',
    )
  })
}