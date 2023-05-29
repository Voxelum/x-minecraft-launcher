<template>
  <div
    ref="container"
    class="flex gap-1 mt-1 overflow-x-auto"
    @wheel="onWheel"
  >
    <v-chip
      small
      class="mod-tag"
      :outlined="darkTheme"
      color="orange en-1"
      label
      style="margin-left: 1px;"
      @mousedown.stop
    >
      {{ source.mod.id }}
    </v-chip>
    <v-chip
      v-for="(com, i) in compatibility"
      :key="com.modId + ' ' + i"
      v-shared-tooltip="getTooltip(com)"
      class="mod-tag"
      small
      label
      outlined
    >
      <v-avatar left>
        <img
          v-if="getDepIcon(com.modId, icons[com.modId])"
          :src="getDepIcon(com.modId, icons[com.modId])"
        >
        <v-icon v-else>
          $vuetify.icons.package
        </v-icon>
      </v-avatar>
      {{ com.modId }}
      {{ com.requirements || '⭕' }}
      <v-avatar right>
        {{ getCompatibleIcon(com) }}
      </v-avatar>
    </v-chip>

    <v-chip
      v-for="(tag, index) in source.tags"
      :key="`${tag}-${index}`"
      :outlined="darkTheme"
      class="mod-tag"
      small
      label
      :color="getColor(tag)"
      style="margin-left: 1px;"
      close
      @click.stop
      @mousedown.stop
      @click:close="onDeleteTag(tag)"
    >
      <div
        contenteditable
        @input.stop="onEditTag($event, index)"
        @blur="onEditTag($event, 0)"
      >
        {{ tag }}
      </div>
    </v-chip>
  </div>
</template>

<script lang=ts setup>
import { useScrollRight, useTheme } from '@/composables'
import { getCompatibleIcon } from '@/composables/compatibleIcon'
import { useModCompatibleTooltip } from '@/composables/modCompatibleTooltip'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { getColor } from '@/util/color'
import { injection } from '@/util/inject'
import { CompatibleDetail } from '@/util/modCompatible'
import { ModItem } from '@/composables/instanceModItems'
import { kInstanceModsContext } from '@/composables/instanceMods'

defineProps<{
  source: ModItem
  compatibility: CompatibleDetail[]
  onEditTag(event: Event, index: number): void
  onDeleteTag(tag: string): void
}>()

const { modsIconsMap: icons } = injection(kInstanceModsContext)

const { getTooltip } = useModCompatibleTooltip()

const getDepIcon = (name: string, icon?: string) => {
  if (icon) return icon
  if (name === 'forge') return 'image://builtin/forge'
  if (name === 'minecraft') return 'image://builtin/minecraft'
  if (name === 'fabricloader' || name.startsWith('fabric-')) return 'image://builtin/fabric'
  return ''
}
const { darkTheme } = useTheme()

const container = ref(null as null | HTMLElement)
const { onWheel } = useScrollRight(container)

</script>

<style scoped>
.mod-tag {
  overflow: unset;
}
</style>
