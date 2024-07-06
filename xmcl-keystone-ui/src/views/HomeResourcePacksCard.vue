<template>
  <HomeCard
    icon="palette"
    :title="t('resourcepack.name', 2)"
    :text="t('resourcepack.enable', { count: resourcePackCount })"
    :icons="icons"
    :button="t('resourcepack.manage')"
    :refreshing="false"
    @navigate="push('/resourcepacks')"
  />
</template>
<script lang="ts" setup>
import { injection } from '@/util/inject'
import HomeCard from '@/components/HomeCard.vue'
import { kInstanceResourcePacks } from '@/composables/instanceResourcePack'

const props = defineProps<{ row: number; rowCount: number }>()

const { enabled } = injection(kInstanceResourcePacks)
const resourcePackCount = computed(() => enabled.value?.length || 0)

const icons = computed(() => {
  if (!props.row) {
    return []
  }
  if (!enabled.value) {
    return []
  }
  const max = props.row * props.rowCount
  return enabled.value.slice(0, max)
})

const { t } = useI18n()
const { push } = useRouter()

</script>
