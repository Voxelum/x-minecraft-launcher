<template>
  <HomeDefault
    v-if="layout === 'default'"
  />
  <HomeFocus v-else />
</template>
<script lang="ts" setup>
import { kUILayout, useInFocusMode } from '@/composables/uiLayout'
import HomeDefault from './HomeDefault.vue'
import HomeFocus from './HomeFocus.vue'
import { injection } from '@/util/inject'
import { kCompact } from '@/composables/scrollTop'
import { useGlobalDrop } from '@/composables/dropHandler'
import { useDialog } from '@/composables/dialog'

// const isFocus = useInFocusMode()
const compact = injection(kCompact)
onMounted(() => {
  compact.value = false
})

const { show } = useDialog('HomeDropModpackDialog')

const layout = ref('default')
provide(kUILayout, layout)

useGlobalDrop({
  onDrop: async (e) => {
    const files = e.files
    const file = files?.[0]
    if (file) {
      const ext = file.name.split('.').pop()
      if (ext === 'zip' || ext === 'mrpack') {
        show(file.path)
        return
      }
    }
  },
})
</script>
