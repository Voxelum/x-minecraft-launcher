<template>
  <v-text-field
    id="search-text-field"
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
import { useTextFieldBehavior } from '@/composables/textfieldBehavior'
import { useEventListener } from '@vueuse/core'

const props = defineProps<{
  value?: string
  clearable?: boolean
  placeholder?: string
  gameVersion?: string
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
useEventListener(document, 'keydown', useTextFieldBehavior(searchTextField, searchTextFieldFocused), { capture: true })
defineExpose({
  focus() {
    if (!searchTextFieldFocused.value) {
      searchTextField.value?.focus()
    }
  },
})
</script>
