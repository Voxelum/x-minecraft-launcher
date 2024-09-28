<template>
  <v-text-field
    id="search-text-field"
    ref="searchTextField"
    v-model="_keyword"
    class="max-w-80 min-w-40"
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
      <v-chip
        v-if="gameVersion"
        label
        outlined
        small
        close
        @click:close="emit('clear-version')"
      >
        {{ gameVersion }}
      </v-chip>
      <v-chip
        v-if="category"
        label
        outlined
        small
        close
        @click:close="emit('clear-category')"
      >
        <v-icon small>
          filter_alt
        </v-icon>
      </v-chip>
    </template>
  </v-text-field>
</template>

<script lang=ts setup>
import { useTextFieldBehavior } from '@/composables/textfieldBehavior'
import { useEventListener } from '@vueuse/core'
import { nextTick } from 'vue'

const props = defineProps<{
  value?: string
  clearable?: boolean
  placeholder?: string
  gameVersion?: string
  category?: boolean
}>()

const _keyword = computed({
  get: () => props.value as string ?? '',
  set: (v) => { search(v) },
})

const emit = defineEmits<{
  (event: 'input', value: string | undefined): void
  (event: 'click', e: MouseEvent): void
  (event: 'clear'): void
  (event: 'clear-version'): void
  (event: 'clear-category'): void
}>()

const search = (v: string | undefined) => {
  if (v !== props.value) {
    emit('input', v)
  }
}

const clear = () => {
  _keyword.value = ''
  emit('clear')
}

const searchTextField = ref(undefined as any | undefined)
const searchTextFieldFocused = inject('focused', ref(false))
const transitioning = inject('transitioning', ref(false))
let pendingFocus = false
watch(transitioning, (v) => {
  if (!v && pendingFocus) {
    if (!searchTextFieldFocused.value) {
      searchTextField.value?.focus()
      pendingFocus = false
    }
  }
}, { immediate: true })
useEventListener(document, 'keydown', useTextFieldBehavior(searchTextField, searchTextFieldFocused), { capture: true })
defineExpose({
  focus() {
    if (!searchTextFieldFocused.value) {
      if (!transitioning.value) {
        searchTextField.value?.focus()
      } else {
        pendingFocus = true
      }
    }
  },
})
onMounted(() => {
  if (!searchTextFieldFocused.value) {
    pendingFocus = true
  }
})
</script>
