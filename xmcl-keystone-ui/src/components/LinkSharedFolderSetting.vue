<template>
  <div class="link-shared px-2">
    <div class="link-shared__header">
      <v-icon size="16" class="link-shared__icon">hub</v-icon>
      <span class="link-shared__title">{{ title }}</span>
      <v-spacer />
      <v-switch
        class="link-shared__switch"
        color="primary"
        density="compact"
        hide-details
        inset
        :loading="loading"
        :disabled="loading"
        :model-value="!!linked"
        :data-testid="`link-shared-${domain}-switch`"
        @update:model-value="onToggle(!!$event)"
      />
    </div>
    <p class="link-shared__desc">
      {{ description }}
    </p>
  </div>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'
import { InstanceResourcePacksServiceKey, InstanceSavesServiceKey, InstanceShaderPacksServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'

const props = defineProps<{
  domain: 'saves' | 'resourcepacks' | 'shaderpacks'
}>()

const emit = defineEmits<{
  (event: 'changed'): void
}>()

const { t } = useI18n()
const { path } = injection(kInstance)

const savesService = useService(InstanceSavesServiceKey)
const resourcePacksService = useService(InstanceResourcePacksServiceKey)
const shaderPacksService = useService(InstanceShaderPacksServiceKey)

const api = computed(() => {
  if (props.domain === 'saves') {
    return {
      isLinked: savesService.isSaveLinked,
      link: savesService.linkSharedSave,
      unlink: savesService.unlinkSharedSave,
    }
  }
  if (props.domain === 'resourcepacks') {
    return {
      isLinked: resourcePacksService.isLinked,
      link: resourcePacksService.linkShared,
      unlink: resourcePacksService.unlinkShared,
    }
  }
  return {
    isLinked: shaderPacksService.isLinked,
    link: shaderPacksService.linkShared,
    unlink: shaderPacksService.unlinkShared,
  }
})

const title = computed(() => {
  if (props.domain === 'saves') return t('save.linkShared')
  if (props.domain === 'resourcepacks') return t('resourcepack.linkShared')
  return t('shaderPack.linkShared')
})

const description = computed(() => {
  if (props.domain === 'saves') return t('save.linkSharedHint')
  if (props.domain === 'resourcepacks') return t('resourcepack.linkSharedHint')
  return t('shaderPack.linkSharedHint')
})

const { data: linked, isValidating, mutate } = useSWRV(
  computed(() => path.value ? `link-shared-${props.domain}://${path.value}` : undefined),
  () => api.value.isLinked(path.value),
)

const toggling = ref(false)
const loading = computed(() => toggling.value || isValidating.value)

async function onToggle(value: boolean) {
  toggling.value = true
  try {
    if (value) {
      await api.value.link(path.value)
    } else {
      await api.value.unlink(path.value)
    }
  } finally {
    toggling.value = false
    await mutate()
    emit('changed')
  }
}
</script>
<style scoped>
.link-shared {
  margin-top: 12px;
}

.link-shared__header {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
}

.link-shared__icon {
  opacity: 0.7;
  flex: 0 0 auto;
}

.link-shared__title {
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.25;
}

.link-shared__switch {
  flex: 0 0 auto;
  margin: 0;
}

.link-shared__desc {
  margin-top: 2px;
  font-size: 0.72rem;
  line-height: 1.4;
  opacity: 0.6;
}
</style>
