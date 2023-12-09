<template>
  <v-card
    v-draggable-card
    v-context-menu.force="contextMenuItems"
    :ripple="!isBusy"
    class="draggable-card flex w-full flex-col"
    :color="isSelected ? 'primary' : ''"
    :dark="isSelected"
    outlined
    :shaped="isSelected"
    :class="{ selected: isSelected }"
    style="padding: 0;"
    hover
    :draggable="!isBusy"
    @click="emit('click', $event)"
  >
    <div
      v-if="isBusy"
      class="absolute flex h-full w-full items-center justify-center"
    >
      <v-progress-circular
        class="z-10"
        :size="100"
        :width="4"
        indeterminate
      />
    </div>
    <v-img
      class="white--text favicon grey en-2 flex max-h-40 items-center"
      :src="image"
    >
      <div
        class="flex items-center justify-center"
      >
        <span class="headline">{{ instance.name || `Minecraft ${instance.runtime.minecraft}` }}</span>
      </div>
      <div
        v-if="instance.server"
        class="absolute bottom-0 w-full justify-center"
      >
        <v-chip
          color="green"
          label
          small
          style
        >
          {{ instance.server.host }}:{{ instance.server.port }}
        </v-chip>
      </div>
    </v-img>

    <v-card-text
      v-if="description"
      class="font-weight-bold"
    >
      <TextComponent
        :source="typeof description === 'object' ? description : { text: description }"
      />
    </v-card-text>

    <v-card-actions class="flex flex-col">
      <div class="flex-grow" />
      <div class="flex flex-grow-0 flex-row flex-wrap justify-center gap-2">
        <v-chip
          v-if="instance.server"
          small
          label
          outlined
          :input-value="false"
          @click.stop
        >
          <TextComponent :source="status.version.name" />
        </v-chip>
        <v-chip
          v-if="instance.server"
          small
          outlined
          label
          :input-value="false"
          @click.stop
        >
          <v-avatar left>
            <v-icon
              :style="{ color: status.ping < 0 ? 'grey' : status.ping < 100 ? 'green' : status.ping < 300 ? 'orange' : 'error' }"
            >
              signal_cellular_alt
            </v-icon>
          </v-avatar>
          {{ status.ping }} ms
        </v-chip>
        <v-chip
          v-if="instance.server"
          small
          outlined
          label
          :input-value="false"
          @click.stop
        >
          <v-avatar left>
            <v-icon>people</v-icon>
          </v-avatar>
          {{ status.players.online }} / {{ status.players.max }}
        </v-chip>
        <v-chip
          label
          outlined
          small
          :input-value="false"
          @click.stop
        >
          <v-avatar left>
            <img
              :src="'http://launcher/icons/minecraft'"
              alt="minecraft"
            >
            <!-- <v-icon>power</v-icon> -->
          </v-avatar>
          {{ instance.runtime.minecraft }}
        </v-chip>
        <v-chip
          v-if="!instance.server && instance.author"
          outlined
          small
          label
          :input-value="false"
          @click.stop
        >
          <v-avatar left>
            <v-icon>person</v-icon>
          </v-avatar>
          {{ instance.author }}
        </v-chip>
        <v-chip
          v-if="instance.runtime.forge"
          outlined
          small
          label
        >
          <v-avatar left>
            <img
              :src="'http://launcher/icons/forge'"
              alt="forge"
            >
          </v-avatar>
          {{ instance.runtime.forge }}
        </v-chip>
        <v-chip
          v-if="instance.runtime.quiltLoader"
          outlined
          small
          label
        >
          <v-avatar
            left
            class="rounded-none"
          >
            <img
              :src="'http://launcher/icons/quilt'"
              alt="quilt"
            >
          </v-avatar>
          {{ instance.runtime.quiltLoader }}
        </v-chip>
        <v-chip
          v-if="instance.runtime.fabricLoader"
          outlined
          small
          label
        >
          <v-avatar left>
            <img
              :src="'http://launcher/icons/fabric'"
              alt="fabric"
            >
          </v-avatar>
          {{ instance.runtime.fabricLoader }}
        </v-chip>
      </div>
    </v-card-actions>
  </v-card>
</template>
<script lang=ts setup>
import unknownServer from '@/assets/unknown_server.png'
import TextComponent from '@/components/TextComponent'
import { useBusy } from '@/composables'
import { kInstance } from '@/composables/instance'
import { useInstanceContextMenuItems } from '@/composables/instanceContextMenu'
import { vDraggableCard } from '@/directives/draggableCard'
import { getBanner } from '@/util/banner'
import { injection } from '@/util/inject'
import { Instance, LockKey } from '@xmcl/runtime-api'
import { useInstanceServerStatus } from '../composables/serverStatus'
import { vContextMenu } from '../directives/contextMenu'

const props = defineProps<{ instance: Instance }>()
const isBusy = useBusy(LockKey.instance(props.instance.path))
const { path } = injection(kInstance)
const isSelected = computed(() => path.value === props.instance.path)
const { status } = useInstanceServerStatus(computed(() => props.instance))

const emit = defineEmits(['delete', 'click'])

const image = computed(() => {
  if (status.value.favicon && status.value.favicon !== unknownServer) {
    return status.value.favicon
  }
  if (props.instance.icon) {
    return props.instance.icon
  }
  const banner = getBanner(props.instance.runtime.minecraft)
  if (banner) {
    return banner
  }
  return unknownServer
})
const description = computed(() => props.instance.description)
const contextMenuItems = useInstanceContextMenuItems(computed(() => props.instance))

</script>

<style>
.favicon .v-image__image {
  filter: blur(2px);
}
</style>
