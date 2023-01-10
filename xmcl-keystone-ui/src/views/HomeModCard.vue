<template>
  <HomeCardBase
    title="Mod"
    icon="extension"
    :text="t('mod.enabled', { count: modCounts }) "
    :icons="icons"
    :refreshing="refreshing > 0"
    :button="t('mod.manage')"
    @navigate="push('/mod-setting')"
  />
</template>
<script lang="ts" setup>
import { useSemaphore, useService } from '@/composables'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'
import HomeCardBase from './HomeCardBase.vue'

const props = defineProps<{ row: number; rowCount: number }>()

const { state } = useService(InstanceModsServiceKey)
const modCounts = computed(() => state.mods.length)
const mods = computed(() => {
  const icons: { name: string; icon?: string }[] = []
  for (const m of state.mods) {
    icons.push({ name: m.name || m.fileName, icon: m.icons?.[0] })
  }
  return icons
})
const icons = computed(() => mods.value.slice(0, props.row * props.rowCount))
const { push } = useRouter()
const refreshing = useSemaphore(computed(() => 'instance:mods'))
const { t } = useI18n()
</script>
