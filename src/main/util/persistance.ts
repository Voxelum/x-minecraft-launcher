import { ensureFile, readFile } from 'fs-extra'
import { writeFile } from 'atomically'
import { join } from 'path'
import { Serializer } from './serialize'

export class FileIOHandler<T > {
  private saveSource: (() => T) | undefined

  constructor(readonly serializer: Serializer<Buffer, T>) { }

  setSaveSource(source: () => T) {
    this.saveSource = source
    return this
  }

  async writeTo(path: string, data: T): Promise<void> {
    await ensureFile(path)
    await writeFile(path, await this.serializer.serialize(data))
  }

  async readTo(path: string): Promise<T> {
    return this.serializer.deserialize(await readFile(path).catch(e => Buffer.from('')))
  }

  async saveTo(path: string, value?: T): Promise<void> {
    if (!value) {
      if (!this.saveSource) throw new Error(`Cannot save ${path} if the default save source is not set!`)
      await this.writeTo(path, this.saveSource())
    } else {
      await this.writeTo(path, value)
    }
  }
}

export class RelativeMappedFile<T > extends FileIOHandler<T> {
  constructor(readonly relativePath: string, serializer: Serializer<Buffer, T>) {
    super(serializer)
  }

  async writeTo(root: string, data: T): Promise<void> {
    return super.writeTo(join(root, this.relativePath), data)
  }

  async readTo(root: string): Promise<T> {
    return super.readTo(join(root, this.relativePath))
  }

  async saveTo(root: string, value?: T): Promise<void> {
    return super.saveTo(root, value)
  }
}

export class MappedFile<T > extends FileIOHandler<T> {
  constructor(readonly path: string, serializer: Serializer<Buffer, T>) {
    super(serializer)
  }

  async write(data: T): Promise<void> {
    return this.writeTo(this.path, data)
  }

  async read(): Promise<T> {
    return this.readTo(this.path)
  }

  async save(value?: T): Promise<void> {
    return this.saveTo(this.path, value)
  }
}
