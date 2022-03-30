<template>
  <div
    class="display-1 flex w-full align-center max-h-20 gap-3"
  >
    <span
      style="margin-right: 10px;"
    >{{ name || `Minecraft ${version.minecraft}` }}</span>
    <v-chip
      v-if="!isServer && author"
      label
      color="primary"
      small
      :input-value="false"
    >
      <v-avatar left>
        <v-icon>person</v-icon>
      </v-avatar>
      {{ author }}
    </v-chip>
    <v-chip
      label
      class="pointer"
      :color="!localVersion.id ? 'warning' : 'primary'"
      small
      :input-value="false"
      @click="$router.push('/version-setting')"
    >
      <v-avatar left>
        <img
          v-if="isServer"
          :src="status.favicon || unknownServer"
        >
        <v-icon v-else>
          power
        </v-icon>
      </v-avatar>
      {{ $tc('version.name', 2) }}: {{ !localVersion.id ? $t('version.notInstalled') : localVersion.id }}
    </v-chip>
    <v-chip
      label
      small
      :input-value="false"
      @click.stop
    >
      <v-avatar left>
        <img
          :src="minecraftPng"
          alt="minecraft"
        >
      </v-avatar>
      {{ version.minecraft }}
    </v-chip>
    <v-chip
      v-if="version.forge"
      small
      label
    >
      <v-avatar left>
        <img
          :src="forgePng"
          alt="forge"
        >
      </v-avatar>
      {{ version.forge }}
    </v-chip>
    <v-chip
      v-if="version.fabricLoader"
      small
      label
    >
      <v-avatar left>
        <img
          :src="fabricPng"
          alt="fabric"
        >
      </v-avatar>
      {{ version.fabricLoader }}
    </v-chip>
    <v-chip
      v-if="isServer"
      label
      class="pointer"
      small
      :input-value="false"
      outlined
    >
      <v-avatar left>
        <v-icon>people</v-icon>
      </v-avatar>
      {{ status.players.online }} / {{ status.players.max }}
    </v-chip>
    <v-chip
      v-if="isServer"
      :style="{ color: status.ping < 100 ? 'green' : status.ping < 300 ? 'orange' : 'red' }"
      label
      class="pointer"
      outlined
      small
      :input-value="false"
    >
      <v-avatar left>
        <v-icon
          :style="{ color: status.ping < 100 ? 'green' : status.ping < 300 ? 'orange' : 'red' }"
        >
          signal_cellular_alt
        </v-icon>
      </v-avatar>
      {{ status.ping }} ms
    </v-chip>
  </div>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'
import fabricPng from '/@/assets/fabric.png'
import forgePng from '/@/assets/forge.png'
import minecraftPng from '/@/assets/minecraft.png'
import unknownServer from '/@/assets/unknown_server.png'
import { useInstance, useInstanceVersion } from '../composables/instance'
import { useInstanceServerStatus } from '../composables/serverStatus'

export default defineComponent({
  setup() {
    const { runtime, name, author, isServer } = useInstance()
    const { localVersion } = useInstanceVersion()
    const { status } = useInstanceServerStatus()
    return {
      localVersion,
      version: runtime,
      name,
      author,
      isServer,
      status,
      unknownServer,
      forgePng,
      minecraftPng,
      fabricPng,
    }
  },
})
</script>
