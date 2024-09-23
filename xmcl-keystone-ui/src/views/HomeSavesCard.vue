<template>
  <HomeCard
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
import HomeCard from '@/components/HomeCard.vue'
import { injection } from '@/util/inject'
import { kInstanceSave } from '@/composables/instanceSave'

const props = defineProps<{ row: number; rowCount: number }>()

const { saves } = injection(kInstanceSave)
const savesLength = computed(() => saves.value.length)
const all = computed(() => saves.value.map(s => ({ name: s.name, icon: s.icon?.replace(/\\/g, '\\\\') })))
const icons = computed(() => all.value.slice(0, props.row * props.rowCount))
const { t } = useI18n()
const { push } = useRouter()

</script>
