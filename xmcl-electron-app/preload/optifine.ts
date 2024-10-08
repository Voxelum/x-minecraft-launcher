import { ipcRenderer } from 'electron'

function iterateTable(table: HTMLTableElement) {
  return Array.from(table.querySelectorAll('tr')).map(row => {
    const name = row.getElementsByClassName('colFile').item(0)?.textContent ?? ''
    const forge = row.getElementsByClassName('colForge').item(0)?.textContent?.substring(6) ?? ''
    const downloadUrl = row.querySelector('.colMirror a')?.getAttribute('href') ?? ''
    return {
      name,
      forge,
      downloadUrl,
    }
  })
}

interface VersionData {
  version: string
  downloads: {
    name: string
    forge: string
    downloadUrl: string
  }[]
}

function iterateAllVersions(container: HTMLDivElement) {
  const result = [] as VersionData[]
  let current: VersionData | undefined
  for (const child of container.children) {
    if (child.tagName === 'H2') {
      current = {
        version: cleanMinecraftVersion(child.textContent?.trim() ?? ''),
        downloads: [],
      }
      result.push(current)
    } else if (child.tagName === 'TABLE') {
      const table = child as HTMLTableElement
      const data = iterateTable(table)
      if (current) {
        current.downloads.push(...data)
      }
    } else if (child.tagName === 'DIV') {
      const table = child.querySelector('table') as HTMLTableElement
      if (table) {
        const data = iterateTable(table)
        if (current) {
          current.downloads.push(...data)
        }
      }
    }
  }
  return result
}

function cleanMinecraftVersion(s: string) {
  return s.replace('Minecraft ', '')
}
type OptifineVersion = {
  /**
   * The minecraft version
   */
  mcversion: string
  /**
   * The type of the optifine like HD_U
   */
  type: string
  /**
   * The patch of the optifine
   */
  patch: string

  forge?: string
}

const versions: OptifineVersion[] = []

function handleDownloadsPage() {
  const defaultDownloadBlock = window.document.getElementsByClassName('downloads').item(0)

  if (!defaultDownloadBlock) {
    return
  }

  const allResults: VersionData[] = []
  const versionData: VersionData = {
    version: '',
    downloads: [],
  }
  allResults.push(versionData)
  for (const child of defaultDownloadBlock.children) {
    if (child.tagName === 'H2') {
      versionData.version = cleanMinecraftVersion(child.textContent?.trim() ?? '')
    } else if (child.tagName === 'TABLE') {
      const table = child as HTMLTableElement
      versionData.downloads.push(...iterateTable(table))
    } else if (child.tagName === 'DIV') {
      if (child.id.startsWith('all')) {
        allResults.push(...iterateAllVersions(child as HTMLDivElement))
      } else {
        const table = child.querySelector('table') as HTMLTableElement
        if (table) {
          versionData.downloads.push(...iterateTable(table))
        }
      }
    }
  }

  function parseOptifineVersion(v: string) {
    v = v.replace('OptiFine ', '')
    const [hd, u, ...others] = v.split(' ')
    const type = `${hd}_${u}`
    const patch = others.join('_')
    return {
      type,
      patch,
    }
  }

  const mapped = allResults.flatMap(v => v.downloads.map(d => ({
    ...parseOptifineVersion(d.name),
    mcversion: v.version,
    forge: d.forge,
    downloadUrl: d.downloadUrl,
  }) as OptifineVersion))

  versions.push(...mapped)
  console.log(mapped)
  ipcRenderer.send('optifine-downloads', versions)
}

function handleDownloadPage() {
  const href = document.querySelector('.downloadButton a')?.getAttribute('href')
  const realUrl = new URL(href ?? '', 'https://optifine.net')
  ipcRenderer.send('optifine-download', realUrl.toString())
}

window.addEventListener('load', () => {
  if (window.location.href === 'https://optifine.net/downloads') {
    handleDownloadsPage()
  } else if (window.location.href.indexOf('adloadx') !== -1) {
    handleDownloadPage()
  }
})
