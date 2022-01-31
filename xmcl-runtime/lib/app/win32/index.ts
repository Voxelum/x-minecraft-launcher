import { spawn } from 'child_process'
import generateIcon from 'icon-gen'
import { join } from 'path'
import { URL } from 'url'
import { AppManifest } from '../AppManifest'
import { downloadIcon, resolveIcon } from '../utils'
import { WebManifest } from '../WebManifest'
import createShortcutScript from './createShortcut.vbs'

export async function createShortcutWin32(exePath: string, outputDir: string, man: AppManifest, globalShortcut: boolean): Promise<void> {
  const windowModes = {
    normal: 1,
    maximized: 3,
    minimized: 7,
  }

  const filePath = exePath
  let icon = man.icon
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

export async function installWin32(url: string, appDir: string, man: WebManifest): Promise<AppManifest> {
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

      const svg = resolvedIcons.find(i => i.type === 'svg')
      if (svg) {
        const svgPath = join(appDir, 'app.svg')
        // try to use svg to generate icon
        await downloadIcon(new URL(svg.src, url).toString(), svgPath)
        await generateIcon(svgPath, appDir, {
          ico: {
            name: 'app.ico',
          },
          report: true,
        })
        return icoPath
      }

      const pngs = resolvedIcons.filter(i => i.type === 'png')
      if (pngs.length > 0) {
        // try to use png to generate icon
        const anyIconDir = join(appDir, 'icons')
        // download all png
        await Promise.all(pngs.map(f => downloadIcon(new URL(f.src, url).toString(), join(anyIconDir, `${f.allSizes[0]}.png`))))

        const result = await generateIcon(anyIconDir, appDir, {
          ico: {
            name: 'app.ico',
          },
          report: true,
        })

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
    url,
    name: man.name ?? '',
    icon: iconPath ?? '',
    description: man.description ?? '',

    minWidth: 800,
    minHeight: 580,
    backgroundColor: man.background_color ?? '',
    frame: man.display !== 'frameless',
    vibrancy: false,
  }
}
