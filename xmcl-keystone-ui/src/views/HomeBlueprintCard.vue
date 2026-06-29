<template>
  <HomeCard
    class="home-blueprint-card"
    icon="view_in_ar"
    :title="t('blueprint.name', 2)"
    :text="blueprints.length > 0 ? t('blueprint.blocks', { count: totalBlocks }) : t('blueprint.empty')"
    :icons="[]"
    :refreshing="isValidating"
    :button="{
      text: t('shared.manage'),
      icon: 'settings',
    }"
    :addition-button="{
      icon: 'file_download',
      text: t('blueprint.market'),
    }"
    @navigate-addition="push('/blueprints')"
    @navigate="push('/blueprints')"
  />
</template>
<script lang="ts" setup>
import HomeCard from '@/components/HomeCard.vue'
import { kInstance } from '@/composables/instance'
import { useInstanceBlueprints } from '@/composables/instanceBlueprints'
import { injection } from '@/util/inject'

const { t } = useI18n()
const { push } = useRouter()
const { path } = injection(kInstance)
const { blueprints, isValidating } = useInstanceBlueprints(path)

const totalBlocks = computed(() => blueprints.value.reduce((sum, b) => sum + (b.blockCount ?? 0), 0))
</script>
