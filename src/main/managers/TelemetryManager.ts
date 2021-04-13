import { Contracts, defaultClient, DistributedTracingModes, setup } from 'applicationinsights'
import { readFile, writeFile } from 'fs-extra'
import { join } from 'path'
import { v4 } from 'uuid'
import { Manager } from '.'
import { APP_INSIGHT_KEY, IS_DEV } from '/@main/constant'

export default class TelemetryManager extends Manager {
  private contract = new Contracts.ContextTagKeys()

  private sessionId: string = v4()

  async setup() {
    if (IS_DEV) {
      return
    }

    const clientSessionFile = join(this.app.appDataPath, 'client_session')
    try {
      const session = await readFile(clientSessionFile).then(b => b.toString())
      this.sessionId = session
    } catch {
      this.sessionId = v4()
      await writeFile(clientSessionFile, this.sessionId)
    }

    process.on('uncaughtException', (e) => {
      defaultClient.trackException({ exception: e })
    })
    process.on('unhandledRejection', (e) => {
      defaultClient.trackException({ exception: e as any }) // the applicationinsights will convert it to error automatically
    })

    setup(APP_INSIGHT_KEY)
      .setDistributedTracingMode(DistributedTracingModes.AI_AND_W3C)
      .setAutoCollectExceptions(true)
      .setAutoCollectConsole(false)
      .setAutoCollectPerformance(false)
      .setAutoCollectDependencies(false)
      .setAutoCollectRequests(false)
      .start()

    const tags = defaultClient.context.tags
    tags[this.contract.sessionId] = this.sessionId
    tags[this.contract.userId] = this.sessionId
    tags[this.contract.applicationVersion] = `${this.app.version}#${process.env.BUILD_NUMBER}`

    this.app.on('user-login', (authService) => {
      defaultClient.trackEvent({
        name: 'user-login',
        properties: {
          authService,
        },
      })
    })
    this.app.on('minecraft-start', (options) => {
      defaultClient.trackEvent({
        name: 'minecraft-start',
        properties: options,
      })
    })
    this.app.on('minecraft-exit', ({ code, signal, crashReport }) => {
      const normalExit = code === 0
      const crashed = crashReport.length > 0
      if (normalExit) {
        defaultClient.trackEvent({
          name: 'minecraft-exit',
        })
      } else {
        defaultClient.trackEvent({
          name: 'minecraft-exit',
          properties: {
            code,
            signal,
            crashed,
          },
        })
      }
    })
  }

  storeReady() {
    // this.app.storeManager.store.subscribe((mutation) => {
    //     if (this.app.isParking) {
    //         return;
    //     }
    //     let resources: Resource[];
    //     if (mutation.type === 'resource') {
    //         resources = [mutation.payload];
    //     } else if (mutation.type === 'resources') {
    //         resources = mutation.payload;
    //     } else {
    //         return;
    //     }
    //     resources.filter((r) => r.type === 'forge' && r.source.curseforge)
    //         .forEach((r) => {
    //             r.source.curseforge
    //         });
    //     this.client.trackEvent
    // });
  }
}
