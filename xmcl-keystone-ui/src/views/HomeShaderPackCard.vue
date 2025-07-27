<template>
  <HomeCard
    icon="gradient"
    :title=" t('shaderPack.name', 2)"
    :text="dragover ? t('shaderPack.dropHint') : shaderPack ? t('shaderPack.enable', { name: shaderPack }) : t('shaderPack.empty')"
    :icons="[]"
    :class="{ dragover }"
    :refreshing="refreshing"
    :button="shaderPacks.length > 0 ? {
      text: t('mod.manage'),
      icon: 'settings'
     } : undefined"
    :addition-button="{ 
      icon: 'file_download',
      text: t('install'),
     }"
    @navigate-addition="push('/shaderpacks?source=remote')"
    @navigate="push('/shaderpacks')"
    @drop="onDrop"
  />
</template>
<script lang="ts" setup>
import HomeCard from '@/components/HomeCard.vue'
import { kDropHandler } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { useService } from '@/composables/service'
import { injection } from '@/util/inject'
import { InstanceShaderPacksServiceKey } from '@xmcl/runtime-api'

const { shaderPack, shaderPacks, refreshing, error } = injection(kInstanceShaderPacks)
const { t } = useI18n()
const { push } = useRouter()

const { dragover } = injection(kDropHandler)
const { install } = useService(InstanceShaderPacksServiceKey)
const { path } = injection(kInstance)

function onDrop(e: DragEvent) {
  if (e.dataTransfer) {
    const filePaths = Array.from(e.dataTransfer.files).map(f => f.path)
    install(path.value, filePaths)
    e.preventDefault()
  }
}

</script>
