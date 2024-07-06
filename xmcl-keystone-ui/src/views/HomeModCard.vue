<template>
  <HomeCard
    icon="extension"
    :title="t('mod.name', 2)"
    :text="t('mod.enabled', { count: enabledModCounts })"
    :icons="icons"
    :refreshing="isValidating"
    :button="t('mod.manage')"
    :error="error"
    @navigate="push('/mods')"
  />
</template>
<script lang="ts" setup>
import { kInstanceModsContext } from '@/composables/instanceMods'
import { injection } from '@/util/inject'
import HomeCard from '@/components/HomeCard.vue'

const props = defineProps<{ row: number; rowCount: number }>()

const { mods, enabledModCounts, isValidating, error } = injection(kInstanceModsContext)
const icons = computed(() => mods.value.filter(i => i.enabled).map((m) => ({ name: m.name + ' (' + m.version + ')', icon: m.icon }))
  .slice(0, props.row * props.rowCount))
const { push } = useRouter()
const { t } = useI18n()
</script>
