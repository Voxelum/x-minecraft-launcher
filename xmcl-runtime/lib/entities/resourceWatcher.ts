import { Stats } from 'fs'
import { open, stat } from 'fs/promises'
import watch from 'node-watch'
import { join } from 'path'
import { readdirEnsured } from '../util/fs'
import { Logger } from '../util/log'

export interface FileStat extends Omit<Stats, 'isFile' | 'isDirectory' | 'isBlockDevice' | 'isCharacterDevice' | 'isSymbolicLink' | 'isFIFO' | 'isSocket'> {
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink: boolean
}

export class ResourceWatcher {
  private files: FileStat[] = []

  constructor() {}

  async watch(path: string) {
    const files = (await readdirEnsured(path)).map(f => join(path, f))
    this.files = await Promise.all(files.map(async (p) => {
      const result = await stat(p)
      return {
        path: p,
        ...result,
        isSymbolicLink: result.isSymbolicLink(),
        isDirectory: result.isDirectory(),
        isFile: result.isFile(),
      } as FileStat
    }))

    watch(path, async (event, name) => {
      if (event === 'remove') {
        if (name.endsWith('.json') || name.endsWith('.png') || name.endsWith('.pending')) {
          // json removed means the resource is totally removed
        } else {
          // this will remove
          // const resource = this.cache.get(name)
          // if (resource) {
          //   this.removeResourceInternal([resource])
          //   this.logger.log(`Remove resource ${resource.path} with its metadata`)
          // } else {
          //   this.logger.log(`Skip to remove untracked resource ${name} & its metadata`)
          // }
        }
      } else {
        if (name.endsWith('.png') || name.endsWith('.pending')) {

        }
        // new file found, try to resolve & import it
        // if (this.pending.has(name)) {
        //   // just ignore pending file. It will handle once the json metadata file is updated
        //   this.pending.delete(name)
        //   this.logger.log(`Ignore re-import a manually importing file ${name}`)
        //   return
        // }
        // try {
        //   this.logger.log(`Try to import new file ${name}`)
        //   await this.importResource({ resources: [{ path: name, domain }], optional: true })
        // } catch (e) {
        //   this.emit('error', e)
        // }
      }
    })
  }
}
