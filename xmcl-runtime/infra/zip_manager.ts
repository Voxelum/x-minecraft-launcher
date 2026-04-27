import { open, readAllEntries } from "@xmcl/unzip"
import { stat } from "fs-extra"
import { ZipFile, Entry } from "yauzl"

/**
 * The managed zip.
 */
export interface ManagedZipFile {
  file: ZipFile
  entries: Record<string, Entry>
  /**
   * Dispose the zip file.
   */
  dispose(): void
}

export class ZipManager {
  #files: Record<string, Promise<ManagedZipFile> | undefined> = {}

  async close() {
    for (const file of Object.values(this.#files)) {
      if (file) {
        const f = await file
        f.file.close()
      }
    }
  }

  /**
   * Open or get a managed zip file.
   * @param filePath The file path.
   * @returns The managed zip file.
   */
  async open(filePath: string): Promise<ManagedZipFile> {
    const existing = this.#files[filePath]
    if (existing) {
      return existing
    }
    const fStat = await stat(filePath)
    const ino = fStat.ino

    const existingIno = this.#files[ino]
    if (existingIno) {
      return existingIno
    }

    const promise = open(filePath).then(async (zip) => {
      const dispose = () => {
        if (zip.isOpen) {
          zip.close()
        }
        delete this.#files[filePath]
        delete this.#files[ino]
      }
      zip.once("close", dispose)

      const file: ManagedZipFile = {
        file: zip,
        entries: Object.fromEntries((await readAllEntries(zip)).map(e => [e.fileName, e])),
        dispose,
      }
      return file
    })

    this.#files[filePath] = promise
    this.#files[ino] = promise

    return promise
  }
}
