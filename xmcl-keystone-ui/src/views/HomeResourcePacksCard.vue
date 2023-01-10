<template>
  <HomeCardBase
    icon="palette"
    :title="t('resourcepack.name', 2)"
    :text="t('resourcepack.enable', { count: resourcePackCount })"
    :icons="icons"
    :button="t('resourcepack.manage')"
    :refreshing="false"
    @navigate="push('/resource-pack-setting')"
  />
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { InstanceOptionsServiceKey, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import HomeCardBase from './HomeCardBase.vue'

const props = defineProps<{ row: number; rowCount: number }>()

const { state } = useService(InstanceOptionsServiceKey)
const { getResourcesUnder } = useService(ResourceServiceKey)
const resourcePackCount = computed(() => state.options.resourcePacks.length)
const resourcePacks = ref([] as { name: string; icon?: string }[])

const icons = computed(() => {
  if (!props.row) {
    return []
  }
  const max = props.row * props.rowCount
  const icons: { name: string; icon?: string }[] = []
  for (const m of resourcePacks.value) {
    icons.push({ name: m.name, icon: m.icon })
    if (icons.length === max) break
  }
  return icons
})

const builtinImage = 'image://builtin/minecraft'

const update = async (packs: string[]) => {
  packs = packs.map(p => p.startsWith('file/') ? p.substring('file/'.length) : p)
  if (packs.length > 0) {
    const result = await getResourcesUnder({ domain: ResourceDomain.ResourcePacks, fileNames: packs })
    resourcePacks.value = result.map((v, i) => !v ? { name: packs[i] === 'vanilla' ? 'Minecraft' : packs[i], icon: packs[i] === 'vanilla' ? builtinImage : undefined } : { name: v.name, icon: v.icons?.[0] })
  }
}

watch(computed(() => state.options.resourcePacks), (packs) => {
  update(packs)
})

onMounted(() => {
  update(state.options.resourcePacks)
})

const { t } = useI18n()
const { push } = useRouter()

</script>
