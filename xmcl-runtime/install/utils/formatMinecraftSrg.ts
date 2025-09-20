import { spawn } from 'child_process'
import { unlink, writeFile } from 'fs-extra'
import { delimiter, join } from 'path'

/**
 * ```java
 *  import net.minecraftforge.srgutils.IMappingFile;
 *  public class Main {
 *      public static void main(String[] args) throws java.io.IOException {
 *        IMappingFile.load(new java.io.File(args[0]))
 *          .write(java.nio.file.Path.of(args[1]), IMappingFile.Format.TSRG, false);
 *      }
 *  }
 * ```
 */
const base64 = 'yv66vgAAADQAMQoAAgADBwAEDAAFAAYBABBqYXZhL2xhbmcvT2JqZWN0AQAGPGluaXQ+AQADKClWBwAIAQAMamF2YS9pby9GaWxlCgAHAAoMAAUACwEAFShMamF2YS9sYW5nL1N0cmluZzspVgsADQAOBwAPDAAQABEBAChuZXQvbWluZWNyYWZ0Zm9yZ2Uvc3JndXRpbHMvSU1hcHBpbmdGaWxlAQAEbG9hZAEAOihMamF2YS9pby9GaWxlOylMbmV0L21pbmVjcmFmdGZvcmdlL3NyZ3V0aWxzL0lNYXBwaW5nRmlsZTsHABMBABBqYXZhL2xhbmcvU3RyaW5nCwAVABYHABcMABgAGQEAEmphdmEvbmlvL2ZpbGUvUGF0aAEAAm9mAQA7KExqYXZhL2xhbmcvU3RyaW5nO1tMamF2YS9sYW5nL1N0cmluZzspTGphdmEvbmlvL2ZpbGUvUGF0aDsJABsAHAcAHQwAHgAfAQAvbmV0L21pbmVjcmFmdGZvcmdlL3NyZ3V0aWxzL0lNYXBwaW5nRmlsZSRGb3JtYXQBAARUU1JHAQAxTG5ldC9taW5lY3JhZnRmb3JnZS9zcmd1dGlscy9JTWFwcGluZ0ZpbGUkRm9ybWF0OwsADQAhDAAiACMBAAV3cml0ZQEASShMamF2YS9uaW8vZmlsZS9QYXRoO0xuZXQvbWluZWNyYWZ0Zm9yZ2Uvc3JndXRpbHMvSU1hcHBpbmdGaWxlJEZvcm1hdDtaKVYHACUBAARNYWluAQAEQ29kZQEAD0xpbmVOdW1iZXJUYWJsZQEABG1haW4BABYoW0xqYXZhL2xhbmcvU3RyaW5nOylWAQAKRXhjZXB0aW9ucwcALAEAE2phdmEvaW8vSU9FeGNlcHRpb24BAApTb3VyY2VGaWxlAQAJTWFpbi5qYXZhAQAMSW5uZXJDbGFzc2VzAQAGRm9ybWF0ACEAJAACAAAAAAACAAEABQAGAAEAJgAAAB0AAQABAAAABSq3AAGxAAAAAQAnAAAABgABAAAAAgAJACgAKQACACYAAABBAAQAAQAAACG7AAdZKgMytwAJuAAMKgQyA70AErgAFLIAGgO5ACAEALEAAAABACcAAAAOAAMAAAAEABQABQAgAAYAKgAAAAQAAQArAAIALQAAAAIALgAvAAAACgABABsADQAwQBk='

export async function formatMinecraftSrg(originalMappingPath: string, mappingPath: string, javaPath: string, workspaceFolder: string, cp: string[]) {
  const buffer = Buffer.from(base64, 'base64')
  const javaFilePath = join(workspaceFolder, 'Main.class')
  await writeFile(javaFilePath, buffer)
  try {
    const args = [
      '-cp',
      `"${[...cp, workspaceFolder].join(delimiter)}"`,
      'Main',
      originalMappingPath,
      mappingPath,
    ]
    const process = spawn(javaPath, args)
    await new Promise<void>((resolve, reject) => {
      const buff = [] as Buffer[]
      process.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          const text = Buffer.concat(buff).toString()
          reject(new Error(`Failed to format srg mapping. ${text}`))
        }
      })
      process.stderr.on('data', (data) => {
        buff.push(data)
      })
    })
  } finally {
    await unlink(javaFilePath)
  }
}