import { readdir } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin } from '../app'
import { kCommandHost } from './kCommandHost'
import { runCli, shouldDeferWindow } from './cliDriver'

/**
 * Best-effort modification count for an instance directory. Used by
 * auto-memory assignment in `generateLaunchOptionsWithGlobal`. Failure
 * (missing folder, permissions) silently degrades to 0 — this matches
 * the renderer composable's behaviour.
 */
async function countMods(instancePath: string): Promise<number> {
  try {
    const entries = await readdir(join(instancePath, 'mods'))
    return entries.length
  } catch {
    return 0
  }
}

/**
 * Pre-fills host-specific fields on parsed CLI input. The handler stays
 * pure; the CLI layer is the only place that touches the file system.
 */
async function enrichInput(commandId: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (commandId === 'instance.launch' && input.modCount === undefined) {
    const inst = typeof input.instance === 'string' ? input.instance : ''
    if (inst) input.modCount = await countMods(inst)
  }
  return input
}

/**
 * Wires the CLI driver into the launcher lifecycle:
 *
 * 1. Inspects `process.argv` synchronously at startup so that
 *    `app.deferredWindowOpen` can be set before the window is created.
 * 2. Runs the parsed command once the engine is ready, focusing the
 *    deferred window after completion.
 * 3. Re-runs the driver on `second-instance` so subsequent CLI
 *    invocations against an already-running launcher are honoured.
 *
 * Errors from command dispatch are logged but never thrown — they would
 * otherwise crash the launcher startup.
 */
export const pluginCli: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('Cli')
  const hostPromise = app.registry.get(kCommandHost)

  hostPromise.then((host) => {
    if (shouldDeferWindow(process.argv, host.registry)) {
      app.deferredWindowOpen = true
    }
  }).catch(() => { /* host not ready — leave deferredWindowOpen as-is */ })

  app.waitEngineReady().then(async () => {
    try {
      const host = await hostPromise
      const result = await runCli(host, { logger, enrichInput })
      if (result.handled && app.deferredWindowOpen && !result.parsed.globals.noWindow) {
        app.controller.requireFocus()
      }
    } catch (e) {
      logger.error(e as Error)
    }
  })

  app.on('second-instance', async (argv) => {
    try {
      const host = await hostPromise
      const result = await runCli(host, { argv, logger, enrichInput })
      if (result.parsed.globals.noWindow && app.controller.mainWin && !app.controller.mainWin.isDestroyed()) {
        app.controller.mainWin.hide()
      }
    } catch (e) {
      logger.error(e as Error)
    }
  })
}
