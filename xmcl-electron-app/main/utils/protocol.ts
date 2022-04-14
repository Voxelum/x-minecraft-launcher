import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs-extra'
import { join } from 'path'

async function writeMimeList(mimesAppsList: string) {
  if (!existsSync(mimesAppsList)) {
    await writeFile(mimesAppsList, ['[Default Applications]', 'x-scheme-handler/xmcl=xmcl.desktop'].join('\n'))
    return
  }
  const content = await readFile(mimesAppsList, 'utf-8')
  if (content.indexOf('x-scheme-handler/xmcl=xmcl.desktop') === -1) {
    let lines = content.split('\n')
    const defaultAppsHeaderIndex = lines.indexOf('[Default Applications]')
    if (defaultAppsHeaderIndex === -1) {
      lines.push('[Default Applications]')
      lines.push('x-scheme-handler/xmcl=xmcl.desktop')
    } else {
      lines = [...lines.slice(0, defaultAppsHeaderIndex + 1), 'x-scheme-handler/xmcl=xmcl.desktop', ...lines.slice(defaultAppsHeaderIndex + 1)]
    }
    await writeFile(mimesAppsList, lines.join('\n'))
  }
}

export async function setLinuxProtocol(homePath: string) {
  const mimesAppsList = join(homePath, '.config', 'mimeapps.list')
  await writeMimeList(mimesAppsList)
    .catch(() => writeMimeList(join(homePath, '.local', 'share', 'applications', 'mimeapps.list')))
}
