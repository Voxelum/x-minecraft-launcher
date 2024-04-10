<template>
  <div
    class="z-5 flex flex-shrink flex-grow-0 items-center gap-2"
    outlined
    elevation="1"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <div
      class="flex flex-grow-0 flex-row items-center justify-center gap-1"
    >
      <template
        v-for="ver of versions"
      >
        <AvatarItem
          :key="ver.title"
          :avatar="ver.icon"
          :title="ver.title"
          responsive
          :text="ver.version"
        />
        <v-divider
          :key="`${ver.title}-divider`"
          vertical
        />
      </template>
    </div>
    <v-spacer />
    <v-text-field
      class="max-w-60"
      small
      hide-details
      outlined
      filled
      dense
      prepend-inner-icon="search"
    />
    <!-- <v-btn
      text
      @click="isCopyFromDialogShown = true"
    >
      <v-icon left>
        input
      </v-icon>
      {{ t('save.copyFrom.title') }}
    </v-btn>
    <v-btn
      text
      @click="doImport"
    >
      <v-icon left>
        move_to_inbox
      </v-icon>
      {{ t('save.import') }}
    </v-btn> -->
  </div>
</template>

<script lang="ts" setup>
import AvatarItem from '@/components/AvatarItem.vue'
import { kInstance } from '@/composables/instance'
import { kCompact } from '@/composables/scrollTop'
import { injection } from '@/util/inject'

// const { importSave } = useInstanceSaves()
const { instance, runtime: version } = injection(kInstance)
const versions = computed(() => {
  const ver = version.value
  const result: Array<{icon: string; title: string; version: string}> = []
  if (ver.minecraft) {
    result.push({
      icon: 'http://launcher/icons/minecraft',
      title: 'Minecraft',
      version: ver.minecraft,
    })
  }
  if (ver.forge) {
    result.push({
      icon: 'http://launcher/icons/forge',
      title: 'Forge',
      version: ver.forge,
    })
  }
  if (ver.neoForged) {
    result.push({
      icon: 'http://launcher/icons/neoForged',
      title: 'NeoForged',
      version: ver.neoForged,
    })
  }
  if (ver.fabricLoader) {
    result.push({
      icon: 'http://launcher/icons/fabric',
      title: 'Fabric',
      version: ver.fabricLoader,
    })
  }
  if (ver.quiltLoader) {
    result.push({
      icon: 'http://launcher/icons/quilt',
      title: 'Quilt',
      version: ver.quiltLoader,
    })
  }
  if (ver.optifine) {
    result.push({
      icon: 'http://launcher/icons/optifine',
      title: 'Optifine',
      version: ver.optifine,
    })
  }
  if (ver.labyMod) {
    result.push({
      icon: 'http://launcher/icons/labyMod',
      title: 'LabyMod',
      version: ver.labyMod,
    })
  }
  return result
})
const { showOpenDialog } = windowController
// const { isShown: isCopyFromDialogShown } = useDialog('save-copy-from')
// async function doImport() {
//   const { filePaths } = await showOpenDialog({
//     title: t('save.importTitle'),
//     message: t('save.importMessage'),
//     filters: [{ extensions: ['zip'], name: 'zip' }],
//   })
//   for (const file of filePaths) {
//     importSave({ path: file })
//   }
// }
const compact = injection(kCompact)
</script>
