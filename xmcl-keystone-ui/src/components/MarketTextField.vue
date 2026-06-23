<template>
  <v-text-field
    id="search-text-field"
    ref="searchTextField"
    v-model="_keyword"
    class="max-w-80 min-w-40 market-search-field"
    :placeholder="placeholder"
    variant="outlined"
    density="compact"
    hide-details
    :prepend-inner-icon="icon"
    @focus="searchTextFieldFocused = true"
    @blur="onBlur"
    @click="onClickField"
  >
    <template #append-inner>
      <v-chip
        v-if="gameVersion"
        label
        variant="outlined"
        size="small"
        closable
        @click:close="emit('clear-version')"
      >
        {{ gameVersion }}
      </v-chip>
      <v-chip
        v-if="category"
        label
        variant="outlined"
        size="small"
        closable
        @click:close="emit('clear-category')"
      >
        <v-icon size="small">
          filter_alt
        </v-icon>
      </v-chip>
    </template>
  </v-text-field>
</template>

<script lang=ts setup>
import { useTextFieldBehavior } from '@/composables/textfieldBehavior'

const props = defineProps<{
  value?: string
  clearable?: boolean
  placeholder?: string
  gameVersion?: string
  category?: boolean
  localOnly?: boolean
  icon?: string
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
  (event: 'blur', e: FocusEvent): void
  (event: 'update:localOnly', v: boolean): void
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

function onBlur(e: FocusEvent) {
  emit('blur', e)
}

function onClickField(e: MouseEvent) {
  searchTextFieldFocused.value = true
}

const { t } = useI18n()

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

useTextFieldBehavior(searchTextField, searchTextFieldFocused)
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
