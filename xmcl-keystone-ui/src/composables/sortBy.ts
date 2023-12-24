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
