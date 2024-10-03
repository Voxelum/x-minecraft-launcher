<template>
  <HomeCard
    icon="extension"
    :title="t('mod.name', 2)"
    :class="{
      dragover,
    }"
    :text="dragover ? t('mod.dropHint') : t('mod.enabled', { count: enabledMods.length })"
    :icons="icons"
    :refreshing="isValidating"
    :button="t('mod.manage')"
    :error="error"
    @navigate="push('/mods')"
    @drop="onDrop"
  />
</template>
<script lang="ts" setup>
import { kInstanceModsContext } from '@/composables/instanceMods'
import { injection } from '@/util/inject'
import HomeCard from '@/components/HomeCard.vue'
import { kDropHandler } from '@/composables/dropHandler'
import { useService } from '@/composables'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'
import { kInstance } from '@/composables/instance'

const props = defineProps<{ row: number; rowCount: number }>()

const { mods, enabledMods, isValidating, error } = injection(kInstanceModsContext)
const icons = computed(() => mods.value.filter(i => i.enabled).map((m) => ({ name: m.name + ' (' + m.version + ')', icon: m.icon }))
  .slice(0, props.row * props.rowCount))
const { push } = useRouter()
const { t } = useI18n()

const { dragover } = injection(kDropHandler)
const { install } = useService(InstanceModsServiceKey)
const { path } = injection(kInstance)

function onDrop(e: DragEvent) {
  if (e.dataTransfer) {
    const filePaths = Array.from(e.dataTransfer.files).map(f => f.path)
    install({
      path: path.value,
      mods: filePaths,
    })
  }
}

</script>
