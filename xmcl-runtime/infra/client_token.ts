import { InjectionKey } from '~/app'
import { randomUUID } from 'crypto'
import { readFile, writeFile } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'

export const kClientToken: InjectionKey<string> = Symbol('ClientToken')
export const kIsNewClient: InjectionKey<boolean> = Symbol('IsNewClient')

export const pluginClientToken: LauncherAppPlugin = async (app) => {
  const clientSessionFile = join(app.appDataPath, 'client_session')
  let clientSession = ''
  let isNew = false
  try {
    const session = await readFile(clientSessionFile).then(b => b.toString())
    clientSession = session
  } catch {
    clientSession = randomUUID()
    await writeFile(clientSessionFile, clientSession)
    isNew = true
  }

  app.registry.register(kClientToken, clientSession)
  app.registry.register(kIsNewClient, isNew)
}
