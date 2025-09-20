import { ProjectEntry, ProjectFile } from '@/util/search'

export function useSortByItems() {
  const { t } = useI18n()

  const sortByItems = computed(() => {
    return [{
      text: t('modrinth.sort.relevance'),
      icon: 'sort_by_alpha',
      value: 'relevance',
    }, {
      text: t('modrinth.sort.downloads'),
      icon: 'file_download',
      value: 'downloads',
    }, {
      text: t('modrinth.sort.follows'),
      icon: 'star',
      value: 'popularity',
    }, {
      text: t('modrinth.sort.updated'),
      icon: 'update',
      value: 'updated',
    }, {
      text: t('modrinth.sort.newest'),
      icon: 'celebration',
      value: 'created',
    }]
  })

  return sortByItems
}

export type LocalSort = 'alpha_asc' | 'alpha_desc' | 'time_asc' | 'time_desc' | ''

export function sort(sort: LocalSort, result: (ProjectEntry | { mtime: number; name: string })[]) {
  if (sort.startsWith('time')) {
    result.sort((a, b) => {
      const aMtime = 'mtime' in a ? a.mtime : a.installed[0]?.mtime
      const bMtime = 'mtime' in b ? b.mtime : b.installed[0]?.mtime
      if (!aMtime || !bMtime) return 0
      if (sort.endsWith('asc')) return aMtime - bMtime
      return bMtime - aMtime
    })
  } else if (sort.startsWith('alpha')) {
    result.sort((a, b) => {
      const aText = 'title' in a ? (a.title) : a.name
      const bText = 'title' in b ? (b.title) : b.name

      // Use numeric sorting to handle cases like "1-name", "2-fileName", "10-name", "20-folderName"
      // This will sort 10 after 2, not between 1 and 2
      if (sort.endsWith('asc')) return aText.localeCompare(bText, undefined, { numeric: true, sensitivity: 'base' })
      return bText.localeCompare(aText, undefined, { numeric: true, sensitivity: 'base' })
    })
  }
  return result
}