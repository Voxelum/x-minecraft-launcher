<template>
  <transition name="scale-transition">
    <v-text-field
      v-show="show"
      ref="self"
      v-model="text"
      hide-details
      style="position: fixed; z-index: 300;"
      :style="{ top: `${top}px`, right: `${right}px` }"
      solo
      class="search-bar"
      append-icon="filter_list"
      @focus="focused = true"
      @blur="focused = false"
    />
  </transition>
</template>

<script lang=ts>
import { Ref } from '@vue/composition-api'
import { useI18n } from 'vue-i18n'
import { useSearch, useSearchToggles } from '../composables/useSearch'

function setupDraggable(self: Ref<any>) {
  let initialX = 0
  let initialY = 0
  let currentX = 0
  let currentY = 0
  let xOff = 0
  let yOff = 0
  let active = false
  watch(self, (v) => {
    if (!v) return
    const newVal = v.$el as HTMLElement
    const control = newVal.querySelector('.v-input__append-inner')! as HTMLElement
    control.addEventListener('mousedown', (e) => {
      initialX = e.clientX - xOff
      initialY = e.clientY - yOff
      active = true
    })
    control.addEventListener('mousemove', (e) => {
      if (active) {
        e.preventDefault()
        currentX = e.clientX - initialX
        currentY = e.clientY - initialY

        xOff = currentX
        yOff = currentY
        newVal.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`
      }
    })
    control.addEventListener('mouseup', (e) => {
      initialX = currentX
      initialY = currentY
      active = false
    })
  })
}

export default defineComponent({
  setup() {
    const show = ref(false)
    const { text } = useSearch()
    const top = inject('search-top', ref(30))
    const right = inject('search-right', ref(30))
    const focused = ref(false)
    const self: Ref<any> = ref(null)
    function toggleBar(force?: boolean) {
      if (force) {
        if (show.value) {
          show.value = false
          return true
        }
        return false
      }
      if (show.value && !focused.value) {
        nextTick(() => {
          self.value?.focus()
        })
        return true
      }
      show.value = !show.value
      nextTick(() => {
        self.value?.focus()
      })
      return true
    }
    setupDraggable(self)
    const { toggles } = useSearchToggles()
    toggles.unshift(toggleBar)
    return {
      show,
      focused,
      self,
      text,
      top,
      right,
    }
  },
})
</script>

<style>
.search-bar .v-input__append-inner {
  cursor: move;
}
</style>
