import { LaunchServiceKey, UserServiceKey } from '@xmcl/runtime-api'
import { readFile, writeFile } from 'fs-extra'
import { join } from 'path'
import { v4 } from 'uuid'
import { Manager } from '.'
import { APP_INSIGHT_KEY, IS_DEV } from '../constant'

export default class TelemetryManager extends Manager {
  private sessionId: string = v4()

  async setup() {
    if (IS_DEV) {
      return
    }
    const appInsight = await import('applicationinsights')
    const contract = new appInsight.Contracts.ContextTagKeys()

    const clientSessionFile = join(this.app.appDataPath, 'client_session')
    try {
      const session = await readFile(clientSessionFile).then(b => b.toString())
      this.sessionId = session
    } catch {
      this.sessionId = v4()
      await writeFile(clientSessionFile, this.sessionId)
    }

    process.on('uncaughtException', (e) => {
      if (appInsight.defaultClient) {
        appInsight.defaultClient.trackException({ exception: e })
      }
    })
    process.on('unhandledRejection', (e) => {
      if (appInsight.defaultClient) {
        appInsight.defaultClient.trackException({ exception: e as any }) // the applicationinsights will convert it to error automatically
      }
    })

    appInsight.setup(APP_INSIGHT_KEY)
      .setDistributedTracingMode(appInsight.DistributedTracingModes.AI_AND_W3C)
      .setAutoCollectExceptions(true)
      .setAutoCollectConsole(false)
      .setAutoCollectPerformance(false)
      .setAutoCollectDependencies(false)
      .setAutoCollectRequests(false)
      .start()

    const tags = appInsight.defaultClient.context.tags
    tags[contract.sessionId] = this.sessionId
    tags[contract.userId] = this.sessionId
    tags[contract.applicationVersion] = `${this.app.version}#${process.env.BUILD_NUMBER}`

    this.app.on('engine-ready', () => {
      const launchService = this.app.serviceManager.getService(LaunchServiceKey)
      launchService?.on('minecraft-start', (options) => {
        appInsight.defaultClient.trackEvent({
          name: 'minecraft-start',
          properties: options,
        })
      }).on('minecraft-exit', ({ code, signal, crashReport }) => {
        const normalExit = code === 0
        const crashed = crashReport && crashReport.length > 0
        if (normalExit) {
          appInsight.defaultClient.trackEvent({
            name: 'minecraft-exit',
          })
        } else {
          appInsight.defaultClient.trackEvent({
            name: 'minecraft-exit',
            properties: {
              code,
              signal,
              crashed,
            },
          })
        }
      })

      this.app.serviceManager.getService(UserServiceKey)!.on('user-login', (authService) => {
        appInsight.defaultClient.trackEvent({
          name: 'user-login',
          properties: {
            authService,
          },
        })
      })
    })
  }

  storeReady() {
  }
}
