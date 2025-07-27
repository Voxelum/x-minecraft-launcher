<template>
  <HomeCard
    icon="palette"
    :title="t('resourcepack.name', 2)"
    :text="dragover ? t('resourcepack.dropHint') : t('resourcepack.enable', { count: resourcePackCount })"
    :icons="icons"
    :class="{
      dragover,
    }"
    :highlighted="highlight > 0"
    :button="files.length > 0 ? {
      text: t('mod.manage'),
      icon: 'settings'
     } : undefined"
    :refreshing="false"
    :addition-button="{ 
      icon: 'file_download',
      text: t('install'),
     }"
    @navigate-addition="push('/resourcepacks?source=remote')"
    @navigate="push('/resourcepacks')"
    @dragenter="highlight += 1"
    @dragleave="highlight -= 1"
    @drop="onDrop"
  />
</template>
<script lang="ts" setup>
import { injection } from '@/util/inject'
import HomeCard from '@/components/HomeCard.vue'
import { kInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { kDropHandler } from '@/composables/dropHandler'
import { InstanceResourcePacksServiceKey } from '@xmcl/runtime-api'
import { kInstance } from '@/composables/instance'
import { useService } from '@/composables/service'

const props = defineProps<{ row: number; rowCount: number }>()

const { enabled, files } = injection(kInstanceResourcePacks)
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

const { dragover } = injection(kDropHandler)
const { install } = useService(InstanceResourcePacksServiceKey)
const { path } = injection(kInstance)

const highlight = ref(0)

function onDrop(e: DragEvent) {
  if (e.dataTransfer) {
    const filePaths = Array.from(e.dataTransfer.files).map(f => f.path)
    install(path.value, filePaths)
    e.preventDefault()
  }
  highlight.value = 0
}

</script>
