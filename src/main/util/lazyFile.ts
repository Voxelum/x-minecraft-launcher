import { FSWatcher } from 'fs-extra'
import watch from 'node-watch'

export class FileWatchDog {
  private watcher: FSWatcher | undefined

  private dirty = false
  
  constructor() { }

  watch(path: string) {
    this.watcher = watch(path, (event, file) => {
      if (file.endsWith('options.txt')) {
        this.dirty = true
      }
    })
  }
}
