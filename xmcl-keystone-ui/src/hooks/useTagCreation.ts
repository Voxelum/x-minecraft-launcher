import { Ref } from '@vue/composition-api'
import { useI18n } from '.'

export function useTagCreation() {
  const { $t } = useI18n()
  function getNewTag(tags: string[]) {
    const tag = $t('tag.newTag')
    let dedupTag = tag
    let index = 0
    while (tags.indexOf(dedupTag) !== -1) {
      index += 1
      dedupTag = tag + ' ' + index
    }
    return dedupTag
  }
  return {
    getNewTag,
  }
}

export function useTagColors() {
  const colors = [
    'amber',
    'orange lighten-1',
    'pink lighten-3',
    'deep-orange',
    'purple lighten-1',
    'lime',
  ]

  return { colors }
}

export function useTags(tags: Ref<string[]>) {
  const { $t } = useI18n()
  function removeTag(tag: string) {
    tags.value = tags.value.filter(t => t !== tag)
  }
  function editTag(text: string, index: number) {
    tags.value[index] = text
  }
  function createTag() {
    const tag = $t('tag.newTag')
    let dedupTag = tag
    let index = 0
    while (tags.value.indexOf(dedupTag) !== -1) {
      index += 1
      dedupTag = tag + ' ' + index
    }
    tags.value.push(dedupTag)
  }

  return { removeTag, editTag, createTag }
}
