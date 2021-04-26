import { ensureDir, readFile, writeFile } from 'fs-extra';
import { join } from 'path';
import LauncherApp from './LauncherApp';

export interface AppEngine {
  waitEngineReady(): Promise<void>
}

async function resolveGameDataPath(appDataPath: string, engine: AppEngine) {
  let gameDataPath: string
  try {
    await ensureDir(appDataPath)
    gameDataPath = await readFile(join(appDataPath, 'root')).then((b) => b.toString().trim())
  } catch (e) {
    if (e instanceof Error && e.code === 'ENOENT') {
      // first launch
      await engine.waitEngineReady();
      gameDataPath = await this.controller.processFirstLaunch()
      await writeFile(join(appDataPath, 'root'), gameDataPath)
    } else {
      gameDataPath = appDataPath
    }
  }
  return gameDataPath
}

async function setup(appDataPath: string, engine: AppEngine) {
  console.log(`Boot from ${appDataPath}`)
  const gameDataPath = await resolveGameDataPath(appDataPath, engine)
  const temporaryPath = join(gameDataPath, 'temp')
  await ensureDir(temporaryPath)

  await Promise.all(this.managers.map(m => m.setup()))
}

export async function createApp(): Promise<LauncherApp> {

}