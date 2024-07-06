import { ModFile } from '@/util/mod'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { ContextMenuItem } from './contextMenu'
import { useService } from './service'
import { useSearchInMcWiki } from './useMarketRoute'
import { ProjectEntry } from '@/util/search'

export function useModItemContextMenuItems(entry: Ref<ProjectEntry<ModFile>>, onDelete: () => void, onCreateTag: (group?: boolean) => void, onDisable: () => void) {
  const { t, te } = useI18n()
  const { showItemInDirectory } = useService(BaseServiceKey)
  const { searchInMcWiki } = useSearchInMcWiki()

  return () => {
    const files = entry.value.installed
    if (files.length === 0) return []
    const items: ContextMenuItem[] = []
    for (const file of files) {
      items.push({
        text: t('mod.showFile', { file: file.path }),
        onClick: () => {
          showItemInDirectory(file.path)
        },
        icon: 'folder',
      })
      /* , {
        text: t('tag.create'),
        onClick: () => {
          onCreateTag()
        },
        icon: 'add',
      } */
      // if (item.selected) {
      //   items.push({
      //     text: t('tag.createSelected'),
      //     onClick: () => {
      //       onCreateTag(true)
      //     },
      //     icon: 'add',
      //   })
      // }
      items.push({
        text: t('delete.name', { name: file.resource.name }),
        onClick: onDelete,
        icon: 'delete',
        color: 'error',
      })
      if (file.modId.toLowerCase() !== 'optifine') {
        items.push({
          onClick: onDisable,
          text: file.enabled ? t('disable') + ' ' + file.resource.name : t('enable') + ' ' + file.resource.name,
          color: 'grey',
          icon: file.enabled ? 'flash_off' : 'flash_on',
        })
      }
      if (file.url) {
        const url = file.url
        items.push({
          text: t('mod.openLink', { url }),
          onClick: () => {
            window.open(url, 'browser')
          },
          icon: 'link',
        })
      }
    }
    if (te('mod.searchOnMcWiki')) {
      items.push({
        text: t('mod.searchOnMcWiki', { name: entry.value.title }),
        onClick: () => {
          searchInMcWiki(entry.value.title)
        },
        icon: 'search',
      })
    }
    return items
  }
}
