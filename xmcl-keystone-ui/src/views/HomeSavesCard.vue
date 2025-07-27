<template>
  <HomeCard
    icon="map"
    :title="t('save.name', 2)"
    :text="dragover ? t('save.dropHint') : t('save.createdWorlds', { count: savesLength })"
    :icons="icons"
    :refreshing="false"
    :class="{ dragover }"
    :button="saves.length > 0 ? {
      text: t('mod.manage'),
      icon: 'settings'
     } : undefined"
    :addition-button="{ 
      icon: 'file_download',
      text: t('install'),
     }"
    @navigate-addition="push('/save?source=remote')"
    @navigate="push('/save')"
    @drop="onDrop"
  />
</template>
<script lang="ts" setup>
import HomeCard from '@/components/HomeCard.vue'
import { injection } from '@/util/inject'
import { kInstanceSave } from '@/composables/instanceSave'
import { kDropHandler } from '@/composables/dropHandler'
import { InstanceSavesServiceKey } from '@xmcl/runtime-api'
import { kInstance } from '@/composables/instance'
import { useService } from '@/composables/service'

const props = defineProps<{ row: number; rowCount: number }>()

const { saves } = injection(kInstanceSave)
const savesLength = computed(() => saves.value.length)
const all = computed(() => saves.value.map(s => ({ name: s.name, icon: s.icon?.replace(/\\/g, '\\\\') })))
const icons = computed(() => all.value.slice(0, props.row * props.rowCount))
const { t } = useI18n()
const { push } = useRouter()

const { dragover } = injection(kDropHandler)
const { importSave } = useService(InstanceSavesServiceKey)
const { path } = injection(kInstance)

function onDrop(e: DragEvent) {
  if (e.dataTransfer) {
    const filePaths = Array.from(e.dataTransfer.files).map(f => f.path)
    importSave({ instancePath: path.value, path: filePaths[0] })
    e.preventDefault()
  }
}
</script>
