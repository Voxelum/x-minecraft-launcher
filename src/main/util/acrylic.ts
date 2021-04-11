import Shell from 'node-powershell'
import { IS_DEV } from '../constant'
import acrylicScriptPath from '/@static/Acrylic.cs'

export async function acrylic(pid: number) {
  // const path = process.env.NODE_ENV === 'production'
  //   ? resolve(__static.replace('app.asar', 'app.asar.unpacked'), 'Acrylic.cs')
  //   : resolve(__static, 'Acrylic.cs')

  const ps = new Shell({
    executionPolicy: 'RemoteSigned',
    noProfile: true,
  })
  ps.addCommand('[Console]::OutputEncoding = [Text.Encoding]::UTF8')
  if (IS_DEV) {
    ps.addCommand(`Add-Type -Path '${acrylicScriptPath}'`)
  } else {
    ps.addCommand(`Add-Type -Path '${acrylicScriptPath}.asar.unpacked'`)
  }
  ps.addCommand(`[Acrylic.Acrylic]::EnableAcrylic(${pid})`)
  try {
    const result = await ps.invoke()
    return result
  } finally {
    ps.dispose()
  }
}
