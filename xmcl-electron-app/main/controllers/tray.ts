import { ElectronController } from '@/ElectronController'
import { darkIcon, darkTray, lightIcon, lightTray } from '@/utils/icons'
import { BaseService } from '@xmcl/runtime/app'
import { InstanceService } from '@xmcl/runtime/instance'
import { LaunchService } from '@xmcl/runtime/launch'
import { InstanceState } from '@xmcl/runtime-api'

type InstanceItem = InstanceState['instances'][number]
import { app, contentTracing, dialog, Menu, Tray, nativeTheme, nativeImage, MenuItemConstructorOptions, shell, ipcMain } from 'electron'
import { isAbsolute, join } from 'path'
import { readJson, writeJson } from 'fs-extra'
import { ControllerPlugin } from './plugin'
import { kSettings } from '@xmcl/runtime/settings'

export const trayPlugin: ControllerPlugin = function (this: ElectronController) {
  const { t } = this.i18n
  let isTracing = false
  let checkUpdate: (() => void) | undefined
  let instanceService: InstanceService | undefined
  let pinnedPaths = new Set<string>()
  const runningPaths = new Set<string>()

  const pinnedFilePath = join(this.app.appDataPath, 'pinned-instances.json')
  readJson(pinnedFilePath).then((paths) => {
    if (Array.isArray(paths)) {
      pinnedPaths = new Set(paths)
      this.tray?.setContextMenu(createMenu())
    }
  }).catch(() => {})

  ipcMain.handle('sync-pinned-instances', async (_, paths: string[]) => {
    if (Array.isArray(paths)) {
      pinnedPaths = new Set(paths)
      await writeJson(pinnedFilePath, paths).catch(() => {})
      this.tray?.setContextMenu(createMenu())
    }
  })

  const toggleTracing = async () => {
    if (!isTracing) {
      try {
        await contentTracing.startRecording({
          included_categories: ['*'],
        })
        isTracing = true
      } catch (e) {
        dialog.showErrorBox('Content tracing', `Failed to start recording: ${(e as Error).message}`)
      }
    } else {
      const out = join(app.getPath('logs'), `trace-${Date.now()}.json`)
      try {
        const file = await contentTracing.stopRecording(out)
        isTracing = false
        shell.showItemInFolder(file)
      } catch (e) {
        isTracing = false
        dialog.showErrorBox('Content tracing', `Failed to stop recording: ${(e as Error).message}`)
      }
    }
    this.tray?.setContextMenu(createMenu())
  }

  const openInstance = async (instancePath: string) => {
    let window = this.mainWin
    if ((!window || window.isDestroyed()) && this.activatedManifest) {
      await this.activate(this.activatedManifest)
      window = this.mainWin
    } else {
      if (window?.isMinimized()) window.restore()
      window?.show()
      if (this.maximized) {
        window?.maximize()
      }
      window?.focus()
    }
    const targetWin = this.mainWin
    if (targetWin && !targetWin.isDestroyed()) {
      if (targetWin.webContents.isLoading()) {
        targetWin.webContents.once('did-finish-load', () => {
          targetWin.webContents.send('instance-select', instancePath)
        })
      } else {
        targetWin.webContents.send('instance-select', instancePath)
      }
    }
  }

  const launchInstance = async (instancePath: string) => {
    let window = this.mainWin
    if ((!window || window.isDestroyed()) && this.activatedManifest) {
      await this.activate(this.activatedManifest)
      window = this.mainWin
    } else {
      if (window?.isMinimized()) window.restore()
      window?.show()
      if (this.maximized) {
        window?.maximize()
      }
      window?.focus()
    }
    const targetWin = this.mainWin
    if (targetWin && !targetWin.isDestroyed()) {
      const event = runningPaths.has(instancePath) ? 'instance-select' : 'instance-launch'
      if (targetWin.webContents.isLoading()) {
        targetWin.webContents.once('did-finish-load', () => {
          targetWin.webContents.send(event, instancePath)
        })
      } else {
        targetWin.webContents.send(event, instancePath)
      }
    }
  }

  const getLoaderEmoji = (inst: InstanceItem): string => {
    if (inst.edition === 'bedrock') return '🧱'
    const r = inst.runtime
    if (r?.fabricLoader) return '🧶'
    if (r?.neoForged) return '⚡'
    if (r?.forge) return '🔨'
    if (r?.quiltLoader) return '🪡'
    if (r?.optifine) return '✨'
    if (r?.labyMod) return '🧪'
    return '🟩'
  }

  const getInstancePrefix = (inst: InstanceItem, isPinned = false): string => {
    if (runningPaths.has(inst.path)) {
      return isPinned ? '🟢 📌' : '🟢'
    }
    return isPinned ? '📌' : getLoaderEmoji(inst)
  }

  const formatInstanceLabel = (inst: InstanceItem): string => {
    const name = inst.name || inst.path
    if (inst.edition === 'bedrock') {
      return name.toLowerCase().includes('bedrock') ? name : `${name} (Bedrock)`
    }
    const mc = inst.runtime?.minecraft
    const r = inst.runtime
    const loader = r?.fabricLoader ? 'Fabric'
      : r?.neoForged ? 'NeoForge'
      : r?.forge ? 'Forge'
      : r?.quiltLoader ? 'Quilt'
      : r?.labyMod ? 'LabyMod'
      : r?.optifine ? 'OptiFine'
      : ''

    const details: string[] = []
    if (mc && !name.includes(mc)) {
      details.push(mc)
    }
    if (loader && !name.toLowerCase().includes(loader.toLowerCase())) {
      details.push(loader)
    }

    if (details.length > 0) {
      return `${name} (${details.join(' · ')})`
    }
    return name
  }

  const createMenu = () => {
    const diagnose = () => {
      this.openDevTools()
    }

    const show = () => {
      const window = this.mainWin
      if ((!window || window.isDestroyed()) && this.activatedManifest) {
        this.activate(this.activatedManifest)
      } else {
        if (window?.isMinimized()) window.restore()
        window?.show()
        if (this.maximized) {
          window?.maximize()
        }
        window?.focus()
      }
    }

    const options: MenuItemConstructorOptions[] = [
      {
        label: `🚀  ${t('showLauncher')}`,
        type: 'normal',
        click: () => {
          show()
        },
      },
    ]

    const allInstances = instanceService?.state.instances ?? []
    const pinned: InstanceItem[] = []
    for (const path of pinnedPaths) {
      const match = allInstances.find(i => i.path === path)
      if (match) pinned.push(match)
    }

    const unpinned = allInstances
      .filter(i => !pinnedPaths.has(i.path))
      .sort((a, b) => (b.lastAccessDate ?? 0) - (a.lastAccessDate ?? 0))

    if (pinned.length > 0) {
      options.push({ type: 'separator' })
      for (const inst of pinned) {
        options.push({
          label: `${getInstancePrefix(inst, true)}  ${formatInstanceLabel(inst)}`,
          type: 'normal',
          click: () => {
            launchInstance(inst.path)
          },
        })
      }
    }

    if (allInstances.length > 0) {
      options.push({ type: 'separator' })

      const submenuItems: MenuItemConstructorOptions[] = []
      const rawGroups = instanceService?.state.groups ?? []
      const groups: Array<{ id: string; name: string; instances: InstanceItem[] }> = []
      const groupedPaths = new Set<string>()

      for (const g of rawGroups) {
        if (typeof g === 'object' && g && 'name' in g && Array.isArray((g as any).instances)) {
          const groupInstances: InstanceItem[] = []
          for (const p of (g as any).instances) {
            const inst = allInstances.find(i => i.path === p)
            if (inst) {
              groupInstances.push(inst)
              groupedPaths.add(inst.path)
            }
          }
          if (groupInstances.length > 0) {
            groups.push({ id: (g as any).id || (g as any).name, name: (g as any).name, instances: groupInstances })
          }
        }
      }

      if (groups.length > 0) {
        for (const grp of groups) {
          submenuItems.push({
            label: `📁  ${grp.name} (${grp.instances.length})`,
            type: 'submenu',
            submenu: grp.instances.map(inst => ({
              label: `${getInstancePrefix(inst, pinnedPaths.has(inst.path))}  ${formatInstanceLabel(inst)}`,
              type: 'normal',
              click: () => {
                launchInstance(inst.path)
              },
            })),
          })
        }

        const ungrouped = allInstances.filter(i => !groupedPaths.has(i.path))
        if (ungrouped.length > 0) {
          submenuItems.push({ type: 'separator' })
          for (const inst of ungrouped) {
            submenuItems.push({
              label: `${getInstancePrefix(inst, pinnedPaths.has(inst.path))}  ${formatInstanceLabel(inst)}`,
              type: 'normal',
              click: () => {
                launchInstance(inst.path)
              },
            })
          }
        }
      } else {
        if (pinned.length > 0) {
          for (const inst of pinned) {
            submenuItems.push({
              label: `${getInstancePrefix(inst, true)}  ${formatInstanceLabel(inst)}`,
              type: 'normal',
              click: () => {
                launchInstance(inst.path)
              },
            })
          }
          if (unpinned.length > 0) {
            submenuItems.push({ type: 'separator' })
          }
        }

        for (const inst of unpinned) {
          submenuItems.push({
            label: `${getInstancePrefix(inst, false)}  ${formatInstanceLabel(inst)}`,
            type: 'normal',
            click: () => {
              launchInstance(inst.path)
            },
          })
        }
      }

      options.push({
        label: `🎮  ${t('allInstances')} (${allInstances.length})`,
        type: 'submenu',
        submenu: submenuItems,
      })
    } else {
      options.push({
        label: `🎮  ${t('noInstances')}`,
        type: 'normal',
        enabled: false,
      })
    }

    options.push(
      { type: 'separator' },
      {
        label: `🌐  ${t('multiplayer')}`,
        type: 'normal',
        click: () => {
          this.openMultiplayer()
        },
      },
      {
        label: `🖥️  ${t('makeDesktopShortcut')}`,
        type: 'normal',
        click: () => {
          this.app.registry.get(BaseService).then(service => service.makeDesktopShortcut())
        },
      },
      {
        type: 'normal',
        label: `🔄  ${t('checkUpdate')}`,
        click: () => {
          checkUpdate?.()
        },
        enabled: !!checkUpdate,
      },
      { type: 'separator' },
      {
        label: `📁  ${t('showLogsFolder')}`,
        type: 'normal',
        click: () => {
          shell.openPath(app.getPath('logs'))
        },
      },
      {
        label: `🛠️  ${t('showDiagnosis')}`,
        type: 'normal',
        click: () => {
          diagnose()
        },
        role: 'toggleDevTools',
      },
      {
        label: isTracing ? '⏹️  Stop CPU trace' : '📊  Start CPU trace',
        type: 'normal',
        click: () => {
          toggleTracing()
        },
      },
      { type: 'separator' },
      {
        label: `🔁  ${t('relaunch')}`,
        type: 'normal',
        click() {
          app.relaunch()
        },
      },
      {
        label: `❌  ${t('quit')}`,
        type: 'normal',
        click() {
          app.quit()
        },
      },
    )

    return Menu.buildFromTemplate(options)
  }

  const getTrayImage = (dark: string, light: string) => {
    let path = nativeTheme.shouldUseDarkColors ? dark : light
    if (!isAbsolute(path)) {
      path = join(__dirname, path)
    }
    const icon = nativeImage.createFromPath(path)
    if (this.app.platform.os === 'osx') {
      return icon.resize({ width: 20, height: 20 })
    }
    return icon.isEmpty() ? path : icon
  }

  this.app.waitEngineReady().then(async () => {
    const tray = new Tray(getTrayImage(darkTray, lightTray))
    this.tray = tray

    if (this.app.platform.os === 'windows') {
      tray.on('double-click', () => {
        const window = this.mainWin
        if (window) {
          if (window.isVisible()) {
            window.focus()
          } else {
            window.show()
            if (this.maximized) {
              window.maximize()
            }
          }
        }
      })
    }

    tray.setToolTip(t('title'))
    tray.setContextMenu(createMenu())

    this.app.registry.get(BaseService).then(service => {
      checkUpdate = () => service.checkUpdate()
      tray.setContextMenu(createMenu())
    })
    this.app.registry.get(InstanceService).then(serv => {
      instanceService = serv
      serv.state.subscribe('instanceAdd', () => {
        tray.setContextMenu(createMenu())
      }).subscribe('instanceRemove', () => {
        tray.setContextMenu(createMenu())
      }).subscribe('instanceEdit', () => {
        tray.setContextMenu(createMenu())
      }).subscribe('instanceGroupsSet', () => {
        tray.setContextMenu(createMenu())
      })
      tray.setContextMenu(createMenu())
    })
    this.app.registry.get(LaunchService).then(service => {
      service.getGameProcesses().then(processes => {
        for (const p of processes) {
          const dir = p.options?.gameDirectory
          if (dir) runningPaths.add(dir)
        }
        tray.setContextMenu(createMenu())
      }).catch(() => {})

      service.on('minecraft-start', (e: any) => {
        const path = e?.options?.gameDirectory || e?.gameDirectory
        if (path) {
          runningPaths.add(path)
          tray.setContextMenu(createMenu())
        }
      }).on('minecraft-exit', (e: any) => {
        const path = e?.options?.gameDirectory || e?.gameDirectory
        if (path) {
          runningPaths.delete(path)
          tray.setContextMenu(createMenu())
        }
      })
    }).catch(() => {})
    this.app.registry.get(kSettings).then(state => {
      state.subscribe('config', () => {
        tray.setToolTip(t('title'))
        tray.setContextMenu(createMenu())
      }).subscribe('localeSet', () => {
        tray.setToolTip(t('title'))
        tray.setContextMenu(createMenu())
      })
    })

    if (app.dock) {
      app.on('activate', () => {
        if (this.mainWin && !this.mainWin.isDestroyed()) {
          this.mainWin?.show()
        } else if (this.activatedManifest) {
          this.activate(this.activatedManifest, false)
        }
      })
    }
    app.on('before-quit', () => {
      this.tray?.destroy()
    })
  })

  this.app.on('app-booted', (man) => {
    this.tray?.setImage(getTrayImage(man.iconSets.darkTrayIcon, man.iconSets.trayIcon))
  })
}
