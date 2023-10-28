import { AZURE_CDN, AZURE_MS_CDN } from '@/constant'
import { download } from '@xmcl/file-transfer'
import { join } from 'path'

export async function ensureElevateExe(appDataPath: string) {
  const elevate = join(appDataPath, 'elevate.exe')
  await download({
    url: [
      `${AZURE_CDN}/elevate.exe`,
      `${AZURE_MS_CDN}/elevate.exe`,
    ],
    validator: {
      algorithm: 'sha1',
      hash: 'd8d449b92de20a57df722df46435ba4553ecc802',
    },
    destination: elevate,
  })
  return elevate
}
