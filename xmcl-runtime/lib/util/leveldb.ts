import { AbstractSublevelOptions } from 'abstract-level'
import { ClassicLevel } from 'classic-level'

export class LevelDBStorage {
  private level: ClassicLevel

  constructor(path: string) {
    this.level = new ClassicLevel(path)
  }

  getStorage<K = string, V = string>(name: string, options: AbstractSublevelOptions<K, V>) {
    return this.level.sublevel<K, V>(name, options)
  }
}
