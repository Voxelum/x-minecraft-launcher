<template>
  <HomeCardBase
    icon="map"
    :title="t('save.name', 2)"
    :text="t('save.createdWorlds', { count: savesLength })"
    :icons="icons"
    :refreshing="false"
    :button="t('save.manage')"
    @navigate="push('/save')"
  />
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { InstanceSavesServiceKey } from '@xmcl/runtime-api'
import HomeCardBase from './HomeCardBase.vue'

const props = defineProps<{ row: number; rowCount: number }>()

const { state } = useService(InstanceSavesServiceKey)
const savesLength = computed(() => state.saves.length)
const all = computed(() => state.saves.map(s => ({ name: s.name, icon: s.icon?.replace(/\\/g, '\\\\') })))
const icons = computed(() => all.value.slice(0, props.row * props.rowCount))
const { t } = useI18n()
const { push } = useRouter()

</script>
