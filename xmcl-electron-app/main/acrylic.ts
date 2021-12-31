import Shell from 'node-powershell'
import { join } from 'path'
import acrylicScriptPath from './Acrylic.cs'
import { IS_DEV } from './constant'

export async function acrylic(pid: number) {
  const ps = new Shell({
    executionPolicy: 'Bypass',
    noProfile: true,
  })
  const path = IS_DEV ? acrylicScriptPath : join(__dirname.replace('app.asar', 'app.asar.unpacked'), acrylicScriptPath)
  ps.addCommand('[Console]::OutputEncoding = [Text.Encoding]::UTF8')
  ps.addCommand(`Add-Type -Path '${path}'`)
  ps.addCommand(`[Acrylic.Acrylic]::EnableAcrylic(${pid})`)
  try {
    const result = await ps.invoke()
    return result
  } finally {
    ps.dispose()
  }
}
