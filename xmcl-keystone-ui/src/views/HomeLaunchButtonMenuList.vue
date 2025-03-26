<template>
  <v-list dense>
    <v-list-item @click="onStartLocalhost">
      <v-list-item-avatar size="20">
        <v-icon size="20">
          {{ serverCount > 0 ? 'cancel' : 'play_arrow' }}
        </v-icon>
      </v-list-item-avatar>
      <v-list-item-title>
        {{ text }}
      </v-list-item-title>
    </v-list-item>
    <v-list-item v-if="env && env.os !== 'osx'" @click="onCreateShortcut">
      <v-list-item-avatar size="20">
        <v-icon size="20">
          rocket_launch
        </v-icon>
      </v-list-item-avatar>
      <v-list-item-title>
        {{ t('launch.createShortcut') }}
      </v-list-item-title>
    </v-list-item>
  </v-list>
</template>
<script lang="ts" setup>
import { useService } from '@/composables';
import { useDialog } from '@/composables/dialog'
import { kEnvironment } from '@/composables/environment';
import { kInstance } from '@/composables/instance';
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kUserContext } from '@/composables/user';
import { join } from '@/util/basename';
import { getInstanceIcon } from '@/util/favicon';
import { injection } from '@/util/inject'
import { BaseServiceKey, LaunchServiceKey } from '@xmcl/runtime-api';

const { t } = useI18n()
defineProps<{}>()

const { serverCount, kill } = injection(kInstanceLaunch)

const text = computed(() => {
  if (serverCount.value > 0) {
    return t('launch.killServer')
  }
  return t('instance.launchServer')
})
const { show } = useDialog('launch-server')
const onStartLocalhost = async () => {
  if (serverCount.value > 0) {
    kill('server')
  } else {
    show()
  }
}

const { path, name, instance } = injection(kInstance)
const { createLaunchShortcut } = useService(LaunchServiceKey)
const { getDesktopDirectory } = useService(BaseServiceKey)
const env = injection(kEnvironment)
const { userProfile } = injection(kUserContext)
const onCreateShortcut = async () => {
  const dir = await getDesktopDirectory()
  const { filePath } = await windowController.showSaveDialog({
    defaultPath: join(dir, name.value),
    filters: env.value?.os === 'windows' ? [
      {
        name: 'Shortcut',
        extensions: ['lnk']
      }
    ] : [{
      name: 'Shortcut',
      extensions: ['desktop']
    }],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  })
  if (!filePath) {
    return
  }
  let icon = getInstanceIcon(instance.value, undefined)
  if (icon.endsWith('.webp')) {
    // render webp to png
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.src = icon
    await new Promise((resolve) => {
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx?.drawImage(img, 0, 0)
        resolve(true)
      }
    })
    const dataUrl = canvas.toDataURL('image/png')
    icon = dataUrl
  }
  await createLaunchShortcut({
    instancePath: path.value,
    destination: filePath,
    userId: userProfile.value.id,
    icon,
  })
}
</script>
