import { ForgeVersion } from '@xmcl/runtime-api'

export function parse(text: string) {
  const parser = new DOMParser()
  const dom = parser.parseFromString(text, 'text/html')
  const selected = dom.querySelector('.elem-active')
  const mcversion = selected?.textContent ?? ''

  function parseLink(elem: Node) {
    const e = (elem as HTMLElement)
    /*
       * <div class="info-tooltip">
       *   <strong>MD5:</strong> 31742b6c996f53af96f606b7a0c46e2a<br>
       *   <strong>SHA1:</strong> 8d6a23554839d6f6014fbdb7991e3cd8af7eca80
       * </div>
       */
    const tooltipInfo = e.querySelector('.info-tooltip')
    const url = tooltipInfo?.querySelector('a')?.getAttribute('href') ||
      e.querySelector('.info-link')?.getAttribute('href') ||
      e.querySelector('a')?.getAttribute('href')

    if (!url) {
      return undefined
    }
    // href is like /maven/net/minecraftforge/forge/1.14.4-28.1.70/forge-1.14.4-28.1.70-changelog.txt
    const href = url.trim()
    const matched = /forge-.+-.+-(\w+)\.\w+/.exec(href)
    let name = ''; let sha1 = ''; let md5 = ''
    if (matched) { name = matched[1] }
    if (!name) {
      throw new SyntaxError(`Cannot determine name for forge url "${href}". Maybe the forge webisite changed?`)
    }
    const isSha1 = /\b([a-f0-9]{40})\b/i
    const isMd5 = /\b[a-f0-9]{32}\b/i
    for (const child of (tooltipInfo?.childNodes || [])) {
      if (child.nodeName !== '#text') {
        continue
      }
      if (child.textContent === '\n') {
        continue
      }
      const content = child.textContent?.trim() || ''
      if (isSha1.test(content)) {
        sha1 = content
      } else if (isMd5.test(content)) {
        md5 = content
      }
    }
    return {
      name,
      md5,
      sha1,
      path: href,
    }
  }

  function parseVersion(e: HTMLElement) {
    const nodes = e.querySelector('.download-links')?.childNodes ?? []

    const links = Array.from(nodes)
      .filter((elem) => elem instanceof HTMLElement && elem.tagName === 'LI')
      .map(parseLink)
      .filter(<T>(v: T | undefined): v is T => !!v)

    const downloadVersionElem = e.querySelector('.download-version')
    let version: string
    let type: ForgeVersion['type'] = 'common'
    const icon = downloadVersionElem?.querySelector('i')
    if (icon) {
      if (icon.className.indexOf('promo-recommended') !== -1) {
        type = 'recommended'
      } else if (icon.className.indexOf('promo-latest') !== -1) {
        type = 'latest'
      } else if (icon.className.indexOf('fa-bug') !== -1) {
        type = 'buggy'
      }
      version = downloadVersionElem?.firstChild?.textContent?.trim() ?? ''
    } else {
      version = downloadVersionElem?.textContent?.trim() ?? ''
    }
    const installer = links?.find((l) => l.name === 'installer')
    const universal = links?.find((l) => l.name === 'universal')
    const changelog = links?.find((l) => l.name === 'changelog')
    const installerWin = links?.find((l) => l.name === 'installer-win')
    const source = links?.find((l) => l.name === 'source')
    const launcher = links?.find((l) => l.name === 'launcher')
    const mdk = links?.find((l) => l.name === 'mdk')

    if (installer === undefined && universal === undefined) {
      throw new SyntaxError('Cannot parse forge web since it missing installer and universal jar info.')
    }
    const result: ForgeVersion = {
      version,
      date: e.querySelector('.download-time')?.textContent?.trim() ?? '',
      changelog,
      installer,
      mdk,
      universal,
      source,
      launcher,
      mcversion,
      type,
    }
    return result
  }

  const result = Array.from(
    dom.querySelector('.download-list')!.querySelector('tbody')!.querySelectorAll('tr')!
      .values())
    .map(parseVersion)

  return result
}
