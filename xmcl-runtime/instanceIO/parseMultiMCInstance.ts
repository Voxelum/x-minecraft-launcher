import { CreateInstanceOption } from '@xmcl/runtime-api'
import { readFile } from 'fs-extra'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { Logger } from '~/logger'
import { discover } from './InstanceFileDiscover'
import { MultiMCConfig } from './entities/MultiMCConfig'
import { MultiMCManifest } from './entities/MultiMCManifest'

export async function parseMultiMCInstance(path: string): Promise<CreateInstanceOption> {
  const instanceCFGText = await readFile(join(path, 'instance.cfg'), 'utf-8')
  const instanceCFG = instanceCFGText.split('\n').reduce((acc, line) => {
    if (!line || line.trim().length === 0) return acc
    const [key, value] = line.split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>) as any as MultiMCConfig
  const instancePack = JSON.parse(await readFile(join(path, 'mmc-pack.json'), 'utf-8')) as MultiMCManifest

  const instanceOptions: CreateInstanceOption = {
    name: instanceCFG.name,
  }

  if (instanceCFG.JavaPath) {
    instanceOptions.java = instanceCFG.JavaPath
  }

  if (instanceCFG.JoinServerOnLaunch && instanceCFG.JoinServerOnLaunchAddress) {
    const [host, port] = instanceCFG.JoinServerOnLaunchAddress.split(':')
    instanceOptions.server = { host, port: port && !isNaN(parseInt(port)) ? parseInt(port) : undefined }
  }

  if (instanceCFG.MinMemAlloc) {
    instanceOptions.minMemory = parseInt(instanceCFG.MinMemAlloc)
  }
  if (instanceCFG.MaxMemAlloc) {
    instanceOptions.maxMemory = parseInt(instanceCFG.MaxMemAlloc)
  }
  if (instanceCFG.ShowConsole) {
    instanceOptions.showLog = instanceCFG.ShowConsole === 'true'
  }
  if (instanceCFG.notes) {
    instanceOptions.description = instanceCFG.notes
  }
  if (instanceCFG.JvmArgs) {
    instanceOptions.vmOptions = instanceCFG.JvmArgs.split(' ')
  }
  if (instanceCFG.lastTimePlayed) {
    instanceOptions.lastPlayedDate = parseInt(instanceCFG.lastTimePlayed)
  }
  if (instanceCFG.totalTimePlayed) {
    instanceOptions.playtime = parseInt(instanceCFG.totalTimePlayed)
  }
  if (instanceCFG.MinecraftWinWidth && instanceCFG.MinecraftWinHeight) {
    instanceOptions.resolution = {
      width: parseInt(instanceCFG.MinecraftWinWidth),
      height: parseInt(instanceCFG.MinecraftWinHeight),
      fullscreen: false,
    }
  }

  if (instancePack.formatVersion === 1) {
    const minecraft = instancePack.components.find(c => c.uid === 'net.minecraft')?.version ?? ''
    const forge = instancePack.components.find(c => c.uid === 'net.minecraftforge')?.version ?? ''
    const optifine = instancePack.components.find(c => c.uid === 'optifine.Optifine')?.version ?? ''
    const fabricLoader = instancePack.components.find(c => c.uid === 'net.fabricmc.fabric-loader')?.version ?? ''
    const quiltLoader = instancePack.components.find(c => c.uid === 'org.quiltmc.quilt-loader')?.version ?? ''
    const runtime = {
      minecraft,
      forge,
      optifine,
      fabricLoader,
      quiltLoader,
    }
    instanceOptions.runtime = runtime
  }

  return instanceOptions
}

export async function parseMultiMcInstanceFiles(instancePath: string, logger: Logger) {
  const _files = await discover(instancePath, logger)
  for (const [f] of _files) {
    f.downloads = [pathToFileURL(join(instancePath, f.path)).toString()]
  }
  return _files.map(([file]) => file)
}
