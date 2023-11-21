import { randomUUID } from 'crypto'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { kClientToken } from '~/clientToken'

export const pluginClientToken: LauncherAppPlugin = async (app) => {
  const clientSessionFile = join(app.appDataPath, 'client_session')
  let clientSession = ''
  try {
    const session = await readFile(clientSessionFile).then(b => b.toString())
    clientSession = session
  } catch {
    clientSession = randomUUID()
    await writeFile(clientSessionFile, clientSession)
  }

  app.registry.register(kClientToken, clientSession)
}
