<template>
  <v-card
    v-draggable-card
    v-context-menu="contextMenuItems"
    :ripple="!isBusy"
    class="draggable-card w-full flex flex-col"
    :color="isSelected ? 'primary' : ''"
    :dark="isSelected"
    outlined
    :shaped="isSelected"
    :class="{ selected: isSelected }"
    style="padding: 0;"
    hover
    :draggable="!isBusy"
    @click="$emit('click', $event)"
  >
    <div
      v-if="isBusy"
      class="absolute w-full h-full flex items-center justify-center"
    >
      <v-progress-circular
        class="z-10"
        :size="100"
        :width="4"
        indeterminate
      />
    </div>
    <v-img
      class="white--text favicon grey en-2 max-h-50"
      :src="image"
    >
      <v-layout
        fill-height
        class="justify-center flex-col relative"
      >
        <v-flex
          flexbox
          class="justify-center items-center"
        >
          <!-- <v-icon left>
            {{ instance.server ? 'storage' : 'layers' }}
          </v-icon> -->
          <span class="headline">{{ instance.name || `Minecraft ${instance.runtime.minecraft}` }}</span>
        </v-flex>
        <v-flex
          v-if="instance.server"
          class="justify-center absolute bottom-0 w-full"
        >
          <v-chip
            color="green"
            label
            small
            style
          >
            {{ instance.server.host }}:{{ instance.server.port }}
          </v-chip>
        </v-flex>
      </v-layout>
    </v-img>

    <v-card-text
      v-if="description"
      class="font-weight-bold"
    >
      <text-component
        :source="typeof description === 'object' ? description : { text: description }"
      />
    </v-card-text>

    <v-card-actions>
      <div class="flex flex-wrap flex-row justify-center gap-2">
        <v-chip
          v-if="instance.server"
          small
          label
          outlined
          :input-value="false"
          @click.stop
        >
          <text-component :source="status.version.name" />
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
              :src="'image://builtin/minecraft'"
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
              :src="'image://builtin/forge'"
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
              :src="'image://builtin/quilt'"
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
              :src="'image://builtin/fabric'"
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
import { BaseServiceKey, Instance, InstanceServiceKey, LockKey } from '@xmcl/runtime-api'
import { ContextMenuItem } from '../composables/contextMenu'
import { useInstanceServerStatus } from '../composables/serverStatus'
import { vContextMenu } from '../directives/contextMenu'
import unknownServer from '@/assets/unknown_server.png'
import { useBusy, useService } from '@/composables'
import { getBanner } from '@/util/banner'
import { vDraggableCard } from '@/directives/draggableCard'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'

const props = defineProps<{ instance: Instance }>()
const isBusy = useBusy(LockKey.instance(props.instance.path))
const { path } = injection(kInstance)
const isSelected = computed(() => path.value === props.instance.path)
const { status } = useInstanceServerStatus(computed(() => props.instance))
const { showItemInDirectory } = useService(BaseServiceKey)

const emit = defineEmits(['delete'])

const image = computed(() => {
  if (status.value.favicon && status.value.favicon !== unknownServer) {
    return status.value.favicon
  }
  const banner = getBanner(props.instance.runtime.minecraft)
  if (banner) {
    return banner
  }
  return unknownServer
})
const description = computed(() => props.instance.description)
const { t } = useI18n()
const contextMenuItems = computed(() => {
  const items: ContextMenuItem[] = [{
    text: t('instance.showInstance', { file: props.instance.path }),
    onClick: () => {
      showItemInDirectory(props.instance.path)
    },
    icon: 'folder',
  }, {
    text: t('delete.name', { name: props.instance.path }),
    onClick: () => {
      emit('delete')
    },
    color: 'error',
    icon: 'delete',
  }]

  return items
})

</script>

<style>
.favicon .v-image__image {
  filter: blur(2px);
}
</style>
