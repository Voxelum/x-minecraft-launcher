import Drive from 'node-disk-info/dist/classes/drive'
import { join, parse } from 'path'
import { setTimeout } from 'timers/promises'
import { isValidPathName } from '~/util/validate'
import { LauncherAppPlugin } from '../app'
import { createLazyWorker } from '@xmcl/worker'
import { SetupWorker } from './setupWorker'
import createSetupWorker from './setupWorkerEntry?worker'
import { Exception } from '@xmcl/runtime-api'

/**
 * Returns true if the drive is a real user-accessible filesystem suitable as
 * a data-root recommendation.  On Linux (including Flatpak) `getDiskInfo()`
 * surfaces every kernel/virtual mount (`tmpfs`, `proc`, `overlay`, …) and
 * every Flatpak bind-mount (`/etc/timezone`, `/usr`, `/dev/shm`, …).
 * We suppress those so the setup wizard only shows sensible choices.
 */
function isUserDrive(drive: { filesystem: string; mounted: string }): boolean {
  if (process.platform === 'linux') {
    // Virtual / kernel / container filesystem types that are never writable
    // user-data locations.
    const VIRTUAL_FS = new Set([
      'tmpfs', 'devtmpfs', 'devpts', 'sysfs', 'proc', 'procfs',
      'cgroup', 'cgroup2', 'pstore', 'bpf', 'tracefs', 'debugfs',
      'securityfs', 'hugetlbfs', 'mqueue', 'fusectl', 'rpc_pipefs',
      'nfsd', 'configfs', 'autofs', 'efivarfs', 'selinuxfs',
      'fuse.portal', 'fuse.gvfsd-fuse', 'overlay', 'squashfs',
    ])

    if (VIRTUAL_FS.has(drive.filesystem.toLowerCase())) {
      return false
    }

    const mp = drive.mounted

    // USB / removable media mounted under /run/media or /media are fine.
    if (mp.startsWith('/run/media/') || mp.startsWith('/media/')) {
      return true
    }

    // Network / fuse user mounts under /mnt are also acceptable.
    if (mp.startsWith('/mnt/')) {
      return true
    }

    // Block-list system path prefixes that should never be data roots.
    const SYSTEM_PREFIXES = [
      '/dev', '/sys', '/proc', '/run', '/tmp',
      '/usr', '/etc', '/lib', '/lib32', '/lib64', '/libx32',
      '/bin', '/sbin', '/boot', '/snap',
    ]

    for (const prefix of SYSTEM_PREFIXES) {
      if (mp === prefix || mp.startsWith(prefix + '/')) {
        return false
      }
    }
  }

  return true
}

export const pluginSetup: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('Setup')
  const [worker, dispose] = createLazyWorker<SetupWorker>(
    createSetupWorker,
    { methods: ['getDiskInfo'] },
    logger,
    Exception,
  )
  app.registryDisposer(dispose)
  logger.log('Setup worker created')

  const getDiskInfo = async () => {
    try {
      const infos = await worker.getDiskInfo()
      for (const i of infos) {
        Object.setPrototypeOf(i, Drive.prototype)
      }
      return infos
    } catch (e) {
      throw Object.assign(new Error(), e)
    }
  }

  app.controller.handle('preset', async () => {
    // E2E isolation: when the harness provides a game-data root, use it as the
    // onboarding default so the wizard never points at the real ~/.minecraftx.
    const defaultPath = process.env.XMCL_E2E_GAME_DATA || join(app.host.getPath('home'), '.minecraftx')
    const getPath = (driveSymbol: string) => {
      const parsedHome = parse(defaultPath)
      if (
        isValidPathName(defaultPath) &&
        parsedHome.root.toLocaleLowerCase().startsWith(driveSymbol.toLocaleLowerCase())
      ) {
        return defaultPath
      }
      return join(driveSymbol, '.minecraftx')
    }
    const getAllDrived = async () => {
      try {
        const startTime = Date.now()
        const drives = await Promise.race([getDiskInfo(), setTimeout(4000).then(() => [])])
        logger.log(`Get disk info in ${Date.now() - startTime}ms`)
        return drives.filter(isUserDrive).map((d) => ({
          filesystem: d.filesystem,
          blocks: d.blocks,
          used: d.used,
          available: d.available,
          capacity: d.capacity,
          mounted: d.mounted,
          selectedPath: getPath(d.mounted),
        }))
      } catch (e) {
        logger.warn('Failed to get drives')
        logger.error(e as any)
        return []
      }
    }
    const drives = await getAllDrived()
    return {
      locale: app.host.getLocale(),
      minecraftPath: app.minecraftDataPath,
      defaultPath,
      drives,
    }
  })
}
