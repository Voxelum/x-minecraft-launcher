<template>
  <HomeCard
    icon="gradient"
    :title=" t('shaderPack.name', 2)"
    :text="dragover ? t('shaderPack.dropHint') : shaderPack ? t('shaderPack.enable', { name: shaderPack }) : t('shaderPack.empty')"
    :icons="[]"
    :button="t('shaderPack.manage')"
    :class="{ dragover }"
    :refreshing="refreshing"
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

const { shaderPack, refreshing, error } = injection(kInstanceShaderPacks)
const { t } = useI18n()
const { push } = useRouter()

const { dragover } = injection(kDropHandler)
const { install } = useService(InstanceShaderPacksServiceKey)
const { path } = injection(kInstance)

function onDrop(e: DragEvent) {
  if (e.dataTransfer) {
    const filePaths = Array.from(e.dataTransfer.files).map(f => f.path)
    install(path.value, filePaths)
  }
}

</script>
