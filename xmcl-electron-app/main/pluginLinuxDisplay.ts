import { LaunchException } from '@xmcl/runtime-api'
import { execFile } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { delimiter, join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { LaunchService } from '~/launch'
import { parseSystemdUserEnvironment, resolveLinuxDisplayEnvironment } from './linuxDisplay'

function readSystemdUserEnvironment() {
  return new Promise<NodeJS.ProcessEnv>((resolve) => {
    execFile('systemctl', ['--user', 'show-environment'], {
      encoding: 'utf8',
      maxBuffer: 128 * 1024,
      timeout: 2_000,
    }, (error, stdout) => {
      resolve(error ? {} : parseSystemdUserEnvironment(stdout))
    })
  })
}

function hasXwayland(env: NodeJS.ProcessEnv) {
  const candidates = (env.PATH ?? '').split(delimiter).filter(Boolean).map(path => join(path, 'Xwayland'))
  candidates.push('/usr/bin/Xwayland', '/usr/local/bin/Xwayland')
  return candidates.some(existsSync)
}

function hasX11Socket() {
  try {
    return readdirSync('/tmp/.X11-unix').some(name => /^X\d+$/.test(name))
  } catch {
    return false
  }
}

export const pluginLinuxDisplay: LauncherAppPlugin = async (app) => {
  if (app.platform.os !== 'linux') return

  const logger = app.getLogger('LinuxDisplay')
  app.registry.get(LaunchService).then((service) => {
    service.registerMiddleware({
      name: 'linux-display',
      async onBeforeLaunch(_, payload) {
        if (payload.side !== 'client') return

        const env = payload.options.extraExecOption?.env ?? process.env
        if (env.DISPLAY) return

        const sessionEnvironment = await readSystemdUserEnvironment()
        const result = resolveLinuxDisplayEnvironment(env, sessionEnvironment, {
          xwaylandAvailable: hasXwayland(env),
          x11SocketAvailable: hasX11Socket(),
        })
        if (result.type === 'ready') {
          if (result.recovered) {
            logger.log(`Recovered DISPLAY=${result.env.DISPLAY} from the systemd user environment`)
            payload.options.extraExecOption = {
              ...payload.options.extraExecOption,
              env: result.env,
            }
          }
          return
        }

        logger.warn(`Cannot prepare an X11 display for Minecraft: ${result.reason}`)
        throw new LaunchException({
          type: 'launchLinuxDisplayUnavailable',
          reason: result.reason,
        }, `Cannot prepare an X11 display for Minecraft: ${result.reason}`)
      },
    })
  })
}