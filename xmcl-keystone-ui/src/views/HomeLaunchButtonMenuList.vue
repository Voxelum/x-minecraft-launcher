<template>
  <v-list dense>
    <v-list-item @click="onStartLocalhost">
      <v-list-item-avatar size="20">
        <v-icon size="20">
          {{ serverCount > 0 ? 'cancel' : 'play_arrow' }}
        </v-icon>
      </v-list-item-avatar>
      <v-list-item-title>
        {{ text }}
      </v-list-item-title>
    </v-list-item>
  </v-list>
</template>
<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { injection } from '@/util/inject'

const { t } = useI18n()
defineProps<{ }>()

const { serverCount, kill } = injection(kInstanceLaunch)

const text = computed(() => {
  if (serverCount.value > 0) {
    return t('launch.killServer')
  }
  return t('instance.launchServer')
})
const { show } = useDialog('launch-server')
const onStartLocalhost = async () => {
  if (serverCount.value > 0) {
    kill('server')
  } else {
    show()
  }
}
</script>
