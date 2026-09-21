import { watch } from 'vue'

export function useVersionAutoSelect(
  props: { value?: string; autoSelect?: string; items: { name: string }[] },
  select: (version: string) => void,
) {
  let autoSelected = false
  watch([() => props.autoSelect, () => props.items], ([autoSelect, items]) => {
    // Loaded/imported choices are authoritative, even if the latest release
    // arrives asynchronously after the creation form was populated.
    if (props.value || !autoSelect || autoSelected || !items.some(item => item.name === autoSelect)) return
    autoSelected = true
    select(autoSelect)
  }, { immediate: true })
}
