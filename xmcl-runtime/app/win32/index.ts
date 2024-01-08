import { AppManifest, InstalledAppManifest } from '@xmcl/runtime-api'
import { unlink, writeFile } from 'fs-extra'
// import generateIco from 'icon-gen/dist/lib/ico'
import { join } from 'path'
import { LauncherApp } from '../LauncherApp'

export async function removeShortcut(outputDir: string, man: InstalledAppManifest) {
  let outputPath = join(outputDir, `${man.name}.lnk`)
  await unlink(outputPath).catch(() => { })
  outputPath = join(outputDir, `${man.name}.url`)
  await unlink(outputPath).catch(() => { })
}

export async function createLinkWin32(app: LauncherApp, exePath: string, outputDir: string, man: InstalledAppManifest, globalShortcut: boolean): Promise<void> {
  const urlContent =
  `[InternetShortcut]
  URL=xmcl://launcher/app?url=${man.url}
  WorkingDirectory=.
  IconIndex=0
  IconFile=${man.iconSets.icon}`
  await writeFile(join(outputDir, `${man.name}.url`), urlContent)
}

export function createShortcutWin32(app: LauncherApp, exePath: string, outputDir: string, man: InstalledAppManifest, globalShortcut: boolean): boolean {
  const windowModes = {
    normal: 1,
    maximized: 3,
    minimized: 7,
  }

  const filePath = exePath
  let icon = man.iconSets.icon
  let args = `--url=${man.url}`
  if (globalShortcut) {
    args += ' --global'
  }
  const description = man.description
  const cwd = ''
  // const windowMode = windowModes.normal.toString()
  // const hotkey = ''
  const outputPath = join(outputDir, `${man.name}.lnk`)

  if (!icon) {
    if (
      filePath.endsWith('.dll') ||
      filePath.endsWith('.exe')
    ) {
      icon = filePath + ',0'
    } else {
      icon = filePath
    }
  }

  const options = {
    target: exePath,
    args,
    description,
    cwd,
    icon,
    iconIndex: 0,
  }

  return app.shell.createShortcut(outputPath, options)
}

export async function installWin32(url: string, appDir: string, man: AppManifest): Promise<InstalledAppManifest> {
  // TODO: fix this
  // const processIcons = async () => {
  //   const resolvedIcons = man.iconUrls.map(resolveIcon)
  //   const icoPath = join(appDir, 'app.ico')

  //   const ico = resolvedIcons.find(i => i.type === 'ico')
  //   if (ico) {
  //     // if has ico, we just use it
  //     await downloadIcon(new URL(ico.src, url).toString(), icoPath)
  //     return icoPath
  //   }

  //   const pngs = resolvedIcons.filter(i => i.type === 'png')
  //   if (pngs.length > 0) {
  //     // try to use png to generate icon
  //     const anyIconDir = join(appDir, 'icons')
  //     await ensureDir(anyIconDir)
  //     // download all png
  //     const fileInfos = await Promise.all(pngs.map(async (f) => {
  //       const filePath = join(anyIconDir, `${f.allSizes[0]}.png`)
  //       await downloadIcon(new URL(f.src, url).toString(), join(anyIconDir, `${f.allSizes[0]}.png`))
  //       return { filePath, size: f.allSizes[0] }
  //     }))

  //     const result = await generateIco(fileInfos, appDir, console as any, {
  //       name: 'app.ico',
  //     }).catch((e) => [])

  //     if (result.length === 0) {
  //       const maxSizePng = pngs.sort((a, b) => b.allSizes[0] - a.allSizes[0]).map(f => join(anyIconDir, `${f.allSizes[0]}.png`))[0]
  //       return maxSizePng
  //     }

  //     return icoPath
  //   }
  // }
  // const iconPath = await processIcons()

  return {
    name: man.name ?? '',
    description: man.description ?? '',
    screenshots: man.screenshots ?? [],

    iconUrls: man.iconUrls,
    url,
    iconSets: man.iconUrls as any,
    minHeight: man.minHeight ?? 600,
    minWidth: man.minWidth ?? 800,
    ratio: man.ratio ?? false,
    backgroundColor: man.backgroundColor ?? '',
    vibrancy: false,
  }
}
