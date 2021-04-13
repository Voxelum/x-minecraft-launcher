import Shell from 'node-powershell'
import acrylicScriptPath from '/@static/Acrylic.cs'

export async function acrylic(pid: number) {
  const ps = new Shell({
    executionPolicy: 'RemoteSigned',
    noProfile: true,
  })
  ps.addCommand('[Console]::OutputEncoding = [Text.Encoding]::UTF8')
  ps.addCommand(`Add-Type -Path '${acrylicScriptPath}'`)
  ps.addCommand(`[Acrylic.Acrylic]::EnableAcrylic(${pid})`)
  try {
    const result = await ps.invoke()
    return result
  } finally {
    ps.dispose()
  }
}
