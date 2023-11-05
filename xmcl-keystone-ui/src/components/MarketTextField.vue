<template>
  <v-text-field
    ref="searchTextField"
    v-model="_keyword"
    class="max-w-80 min-w-70"
    :placeholder="placeholder"
    small
    hide-details
    outlined
    filled
    dense
    prepend-inner-icon="search"
    @focus="searchTextFieldFocused = true"
    @blur="searchTextFieldFocused = false"
    @click="emit('click', $event)"
  >
    <template #append>
      <v-btn
        v-if="clearable || _keyword"
        text
        icon
        class="h-[24px] w-[24px]"
        @click="clear"
      >
        <v-icon>
          clear
        </v-icon>
      </v-btn>
    </template>
  </v-text-field>
</template>

<script lang=ts setup>
import debounce from 'lodash.debounce'

const props = defineProps<{
  value?: string
  clearable?: boolean
  placeholder?: string
}>()

const _keyword = computed({
  get: () => props.value as string ?? '',
  set: (v) => { search(v) },
})

const emit = defineEmits<{
  (event: 'input', value: string | undefined): void
  (event: 'click', e: MouseEvent): void
  (event: 'clear'): void
}>()

const search = debounce((v: string | undefined) => {
  if (v !== props.value) {
    emit('input', v)
  }
}, 800)

const clear = () => {
  _keyword.value = ''
  emit('clear')
}

const searchTextField = ref(undefined as any | undefined)
const searchTextFieldFocused = inject('focused', ref(false))
const onKeyPress = (e: KeyboardEvent) => {
  // ctrl+f
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault()
    e.stopPropagation()
    searchTextField.value?.focus()
  }
  // ctrl+a
  if (searchTextFieldFocused.value && e.ctrlKey && e.key === 'a') {
    e.preventDefault()
    e.stopPropagation()
    searchTextField.value?.$el.querySelector('input')?.select()
  }
  // esc
  if (searchTextFieldFocused.value && e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    searchTextField.value?.blur()
  }
}
defineExpose({
  focus() {
    if (!searchTextFieldFocused.value) {
      searchTextField.value?.focus()
    }
  },
})
onMounted(() => {
  document.addEventListener('keydown', onKeyPress, { capture: true })
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyPress)
})
</script>
