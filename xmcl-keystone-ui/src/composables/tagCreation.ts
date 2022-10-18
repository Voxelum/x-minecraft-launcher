import { Ref, set } from 'vue'

export function useTagCreation() {
  const { t } = useI18n()
  function getNewTag(tags: string[]) {
    const tag = t('tag.newTag')
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

const groupEditingText = ref(undefined as undefined | string)

export function useTags(tags: Ref<string[]>, selected: Ref<boolean> = ref(false)) {
  const { t } = useI18n()
  let lastEditIndex = 0
  function removeTag(tag: string) {
    groupEditingText.value = undefined
    tags.value = tags.value.filter(t => t !== tag)
  }
  function editTag(text: string, index: number) {
    if (text === tags.value[index]) {
      return
    }
    tags.value[index] = text
    if (lastEditIndex === index) {
      if (groupEditingText.value !== undefined) {
        groupEditingText.value = text
      }
    } else {
      lastEditIndex = index
      groupEditingText.value = undefined
    }
  }
  function createTag(group = false) {
    const tag = t('tag.newTag')
    let dedupTag = tag
    let index = 0
    while (tags.value.indexOf(dedupTag) !== -1) {
      index += 1
      dedupTag = tag + ' ' + index
    }
    tags.value.push(dedupTag)
    if (group) {
      groupEditingText.value = undefined
      // force other to create new tags
      nextTick(() => {
        groupEditingText.value = dedupTag
      })
    } else {
      groupEditingText.value = undefined
    }
    lastEditIndex = tags.value.length - 1

    return dedupTag
  }

  watch(groupEditingText, (text, oldVal) => {
    if (selected.value) {
      if (oldVal === undefined) {
        if (text !== undefined && tags.value.indexOf(text) === -1) {
          tags.value.push(text)
          lastEditIndex = tags.value.length - 1
        }
      } else {
        if (text === tags.value[lastEditIndex]) {
          return
        }
        if (text !== undefined) {
          set(tags.value, lastEditIndex, text)
        }
      }
    }
  })

  return { removeTag, editTag, createTag }
}
