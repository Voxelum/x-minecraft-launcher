<template>
  <v-list v-roving-tabindex role="menu" min-width="300">
    <v-list-item :title="text" @click="onStartLocalhost">
      <template #prepend>
        <v-icon size="20">
          {{ serverCount > 0 ? 'cancel' : 'play_arrow' }}
        </v-icon>
      </template>
    </v-list-item>
    <v-menu
      v-if="otherUsers.length > 0"
      location="start"
      :close-on-content-click="true"
      open-on-hover
      :open-delay="200"
      :close-delay="100"
    >
      <template #activator="{ props: menuProps }">
        <v-list-item v-bind="menuProps" :title="t('launch.launchAs')" append-icon="chevron_left">
          <template #prepend>
            <v-icon size="20">
              person
            </v-icon>
          </template>
        </v-list-item>
      </template>
      <v-list v-roving-tabindex role="menu" min-width="220">
        <v-list-item
          v-for="user in otherUsers"
          :key="user.id"
          :title="isUserRunning(user) ? t('launch.kill') : getGameProfileName(user)"
          :subtitle="user.username"
          @click="onLaunchAs(user)"
        >
          <template #prepend>
            <PlayerAvatar
              class="overflow-hidden rounded-full mr-3"
              :src="user.profiles[user.selectedProfile]?.textures?.SKIN?.url"
              :dimension="28"
            />
          </template>
          <template v-if="isUserRunning(user)" #append>
            <v-icon size="16" color="error">cancel</v-icon>
          </template>
        </v-list-item>
      </v-list>
    </v-menu>
    <v-list-item v-if="env && env.os !== 'osx'" :title="t('launch.createShortcut')" @click="onCreateShortcut">
      <template #prepend>
        <v-icon size="20">
          rocket_launch
        </v-icon>
      </template>
    </v-list-item>
  </v-list>
</template>
<script lang="ts" setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { useService } from '@/composables';
import { useDialog } from '@/composables/dialog'
import { kEnvironment } from '@/composables/environment';
import { kInstance } from '@/composables/instance';
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kUserContext } from '@/composables/user';
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { join } from '@/util/basename';
import { getInstanceIcon } from '@/util/favicon';
import { injection } from '@/util/inject'
import { BaseServiceKey, LaunchServiceKey, UserProfile } from '@xmcl/runtime-api';

const { t } = useI18n()
defineProps<{}>()

const { serverCount, kill, launchAs, killPid, gameProcesses } = injection(kInstanceLaunch)
const { users, userProfile } = injection(kUserContext)

const otherUsers = computed(() => users.value?.filter((u) => u.id !== userProfile.value.id) ?? [])

function isUserRunning(user: UserProfile) {
  return gameProcesses.value.some((p) => p.options.user.selectedProfile === user.selectedProfile)
}

function getGameProfileName(user: UserProfile) {
  return user.profiles[user.selectedProfile]?.name || user.username
}

function onLaunchAs(user: UserProfile) {
  if (isUserRunning(user)) {
    const proc = gameProcesses.value.find((p) => p.options.user.selectedProfile === user.selectedProfile)
    if (proc) {
      killPid(proc.pid)
    }
  } else {
    launchAs(user)
  }
}

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
