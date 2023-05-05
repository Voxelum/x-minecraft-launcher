<template>
  <HomeCardBase
    title="Mod"
    icon="extension"
    :text="t('mod.enabled', { count: enabledModCounts }) "
    :icons="icons"
    :refreshing="refreshing > 0"
    :button="t('mod.manage')"
    @navigate="push('/mod-setting')"
  />
</template>
<script lang="ts" setup>
import { useSemaphore } from '@/composables'
import { kInstanceContext } from '@/composables/instanceContext'
import { injection } from '@/util/inject'
import HomeCardBase from './HomeCardBase.vue'

const props = defineProps<{ row: number; rowCount: number }>()

const { mods: { items, enabledModCounts } } = injection(kInstanceContext)
const icons = computed(() => items.value.filter(i => i.enabled).map((m) => ({ name: m.name + ' (' + m.version + ')', icon: m.icon }))
  .slice(0, props.row * props.rowCount))
const { push } = useRouter()
const refreshing = useSemaphore(computed(() => 'instance:mods'))
const { t } = useI18n()
</script>
