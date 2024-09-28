<template>
  <v-card
    v-draggable-card
    v-context-menu.force="getContextMenuItems"
    :ripple="!isBusy"
    class="draggable-card flex flex-grow-0 flex-col"
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
      class="absolute flex size-full items-center justify-center"
    >
      <v-progress-circular
        class="z-10"
        :size="100"
        :width="4"
        indeterminate
      />
    </div>
    <v-img
      class="white--text favicon grey en-2 min-h-34 max-h-34 flex items-center"
      :src="image"
    >
      <div
        class="flex flex-col items-center justify-center"
      >
        <span class="text-center text-lg">{{ instance.name || `Minecraft ${instance.runtime.minecraft}` }}</span>
        <div
          v-if="instance.server"
          class="text-sm dark:text-gray-300"
        >
          {{ instance.server.host }}:{{ instance.server.port }}
        </div>
      </div>
      <div
        v-if="instance.server"
        class="absolute top-2 flex w-full flex-wrap justify-center gap-2"
      >
        <v-chip
          small
          label
          outlined
          :input-value="false"
          @click.stop
        >
          <TextComponent :source="status.version.name" />
        </v-chip>
      </div>
      <div
        v-if="instance.server"
        class="absolute bottom-2 flex w-full flex-wrap justify-around gap-2"
      >
        <v-chip
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

    <v-card-actions class="flex flex-col items-start gap-2">
      <div class="flex flex-row gap-2">
        <template
          v-for="version of versions"
        >
          <div
            :key="version.text"
            class="flex items-center gap-2 px-1 text-sm"
          >
            <v-img
              width="24"
              class="rounded"
              :src="version.icon"
            />
            {{ version.text }}
          </div>
          <v-divider
            v-if="version !== versions[versions.length - 1]"
            :key="version.text + 'divider'"
            class="h-full"
            vertical
          />
        </template>
      </div>

      <div class="flex w-full items-center">
        <v-chip
          small
          outlined
          label
          :input-value="false"
        >
          <v-icon left>
            update
          </v-icon>
          {{ getDateString(instance.lastAccessDate, { dateStyle: 'long' }) }}
        </v-chip>
        <div class="flex-grow" />
        <v-btn
          small
          icon
          @click.stop="onSettingClick"
        >
          <v-icon>more_vert</v-icon>
        </v-btn>
      </div>
    </v-card-actions>
  </v-card>
</template>
<script lang=ts setup>
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
import { useDateString } from '@/composables/date'
import { useContextMenu } from '@/composables/contextMenu'
import { useVersionsWithIcon } from '@/composables/versionLocal'
import { BuiltinImages } from '@/constant'

const props = defineProps<{ instance: Instance }>()
const isBusy = useBusy(LockKey.instance(props.instance.path))
const { path } = injection(kInstance)
const isSelected = computed(() => path.value === props.instance.path)
const { status } = useInstanceServerStatus(computed(() => props.instance))
const { getDateString } = useDateString()

const versions = useVersionsWithIcon(computed(() => props.instance.runtime))
const emit = defineEmits(['delete', 'click'])

const image = computed(() => {
  if (status.value.favicon && status.value.favicon !== BuiltinImages.unknownServer) {
    return status.value.favicon
  }
  if (props.instance.icon) {
    return props.instance.icon
  }
  const banner = getBanner(props.instance.runtime.minecraft)
  if (banner) {
    return banner
  }
  return BuiltinImages.unknownServer
})
const description = computed(() => props.instance.description)
const { open } = useContextMenu()
const getContextMenuItems = useInstanceContextMenuItems(computed(() => props.instance))
const onSettingClick = (event: MouseEvent) => {
  const button = event.target as any // Get the button element
  const rect = button.getBoundingClientRect() // Get the position of the button
  const bottomLeftX = rect.left // X-coordinate of the bottom-left corner
  const bottomLeftY = rect.bottom // Y-coordinate of the bottom-left corner

  const items = getContextMenuItems()
  if (items) {
    open(bottomLeftX, bottomLeftY, items)
  }
}

</script>

<style>
.favicon .v-image__image {
  filter: blur(2px);
}
</style>
