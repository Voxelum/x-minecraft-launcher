import { writeFile } from 'fs/promises'
import { join } from 'path'
import elevateBase64 from 'virtual:elevate.exe'
import { gunzipSync } from 'zlib'
import { checksum } from '~/util/fs'

export async function ensureElevateExe(appDataPath: string) {
  const elevate = join(appDataPath, 'elevate.exe')
  const sha1 = await checksum(elevate, 'sha1').catch(() => undefined)
  if (sha1 !== 'd8d449b92de20a57df722df46435ba4553ecc802') {
    const elevateBinary = gunzipSync(Buffer.from(elevateBase64, 'base64'))
    await writeFile(elevate, elevateBinary)
  }
  return elevate
}
