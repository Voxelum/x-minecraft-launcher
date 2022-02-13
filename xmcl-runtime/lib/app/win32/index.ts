import { AppManifest, InstalledAppManifest } from '@xmcl/runtime-api'
import { spawn } from 'child_process'
import { ensureDir } from 'fs-extra'
import generateIco from 'icon-gen/dist/lib/ico'
import { join } from 'path'
import { URL } from 'url'
import { downloadIcon, resolveIcon } from '../utils'
import createShortcutScript from './createShortcut.vbs'

export async function createShortcutWin32(exePath: string, outputDir: string, man: InstalledAppManifest, globalShortcut: boolean): Promise<void> {
  const windowModes = {
    normal: 1,
    maximized: 3,
    minimized: 7,
  }

  const filePath = exePath
  let icon = man.iconPath
  let args = `--url=${man.url}`
  if (globalShortcut) {
    args += ' --global'
  }
  const comment = man.description
  const cwd = ''
  const windowMode = windowModes.normal.toString()
  const hotkey = ''
  const outputPath = join(outputDir, `${man.name}.Ink`)

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

  const wscriptArguments = [
    createShortcutScript,
    // '/NoLogo',  // Apparently this stops it from displaying a logo in the console, even though I haven't actually ever seen one
    // '/B',  // silent mode, but doesn't actually stop dialog alert windows from popping up on errors
    outputPath,
    filePath,
    args,
    comment,
    cwd,
    icon,
    windowMode,
    hotkey,
  ]

  try {
    spawn('wscript', wscriptArguments)
  } catch (error) {
    // success = false
    // helpers.throwError(
    //   options,
    //   'ERROR: Could not create WINDOWS shortcut.\n' +
    //   'TARGET: ' + options.filePath + '\n' +
    //   'PATH: ' + options.outputPath + '\n',
    //   error,
    // )
  }
}

export async function installWin32(url: string, appDir: string, man: AppManifest): Promise<InstalledAppManifest> {
  const processIcons = async () => {
    if (man.icons) {
      const resolvedIcons = man.icons.map(resolveIcon)
      const icoPath = join(appDir, 'app.ico')

      const ico = resolvedIcons.find(i => i.type === 'ico')
      if (ico) {
        // if has ico, we just use it
        await downloadIcon(new URL(ico.src, url).toString(), icoPath)
        return icoPath
      }

      // TODO: since svg use sharp which is too large. we skip svg for now
      // const svg = resolvedIcons.find(i => i.type === 'svg')
      // if (svg) {
      //   const svgPath = join(appDir, 'app.svg')
      //   // try to use svg to generate icon
      //   await downloadIcon(new URL(svg.src, url).toString(), svgPath)
      //   await generateIco(svgPath, appDir, {
      //     ico: {
      //       name: 'app.ico',
      //     },
      //     report: true,
      //   })
      //   return icoPath
      // }

      const pngs = resolvedIcons.filter(i => i.type === 'png')
      if (pngs.length > 0) {
        // try to use png to generate icon
        const anyIconDir = join(appDir, 'icons')
        await ensureDir(anyIconDir)
        // download all png
        const fileInfos = await Promise.all(pngs.map(async (f) => {
          const filePath = join(anyIconDir, `${f.allSizes[0]}.png`)
          await downloadIcon(new URL(f.src, url).toString(), join(anyIconDir, `${f.allSizes[0]}.png`))
          return { filePath, size: f.allSizes[0] }
        }))

        const result = await generateIco(fileInfos, appDir, console as any, {
          name: 'app.ico',
        }).catch((e) => [])

        if (result.length === 0) {
          const maxSizePng = pngs.sort((a, b) => b.allSizes[0] - a.allSizes[0]).map(f => join(anyIconDir, `${f.allSizes[0]}.png`))[0]
          return maxSizePng
        }

        return icoPath
      }
    }
  }
  const iconPath = await processIcons()

  return {
    name: man.name ?? '',
    description: man.description ?? '',
    icons: man.icons ?? [],
    screenshots: man.screenshots ?? [],

    url,
    iconPath: iconPath ?? '',
    minHeight: man.minHeight ?? 600,
    minWidth: man.minWidth ?? 800,
    ratio: man.ratio ?? false,
    background_color: man.background_color ?? '',
    display: man.display ?? 'frameless',
    vibrancy: false,
  }
}
