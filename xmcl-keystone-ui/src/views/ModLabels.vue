<template>
  <div
    ref="container"
    class="mt-1 flex gap-1 overflow-x-auto"
    @wheel="onWheel"
  >
    <v-chip
      v-if="modid"
      small
      class="mod-tag"
      :outlined="isDark"
      color="orange en-1"
      :disabled="disabled"
      label
      style="margin-left: 1px;"
      @mousedown.stop
    >
      {{ modid }}
    </v-chip>
    <v-chip
      v-for="(com, i) in sortedCompatibility"
      :key="com.modId + ' ' + i"
      v-shared-tooltip="getTooltip(com)"
      class="mod-tag"
      :disabled="disabled"
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
      v-for="(tag, index) in tags"
      :key="`${tag}-${index}`"
      :outlined="isDark"
      class="mod-tag"
      small
      label
      :disabled="disabled"
      :color="getColor(tag)"
      style="margin-left: 1px;"
      close
      @click.stop
      @mousedown.stop
      @click:close="emit('delete-tag', tag)"
    >
      <div
        contenteditable
        @input.stop="emit('edit-tag', $event, index)"
        @blur="emit('edit-tag', $event, 0)"
      >
        {{ tag }}
      </div>
    </v-chip>
  </div>
</template>

<script lang=ts setup>
import { useScrollRight } from '@/composables'
import { getCompatibleIcon } from '@/composables/compatibleIcon'
import { useModCompatibleTooltip } from '@/composables/modCompatibleTooltip'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { getColor } from '@/util/color'
import { injection } from '@/util/inject'
import { CompatibleDetail } from '@/util/modCompatible'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kTheme } from '@/composables/theme'
import { BuiltinImages } from '../constant'

const props = defineProps<{
  modid?: string
  tags: string[]
  disabled?: boolean
  compatibility: CompatibleDetail[]
}>()

const sortedCompatibility = computed(() => [...props.compatibility].sort((a, b) => a.compatible !== true ? -1 : b.compatible !== true ? 1 : 0))

const emit = defineEmits<{
  (event: 'edit-tag', e: Event, index: number): void
  (event: 'delete-tag', tag: string): void
}>()

const { modsIconsMap: icons } = injection(kInstanceModsContext)

const { getTooltip } = useModCompatibleTooltip()

const getDepIcon = (name: string, icon?: string) => {
  if (icon) return icon
  if (name === 'forge') return BuiltinImages.forge
  if (name === 'minecraft') return BuiltinImages.minecraft
  if (name === 'fabricloader' || name.startsWith('fabric-') || name === 'fabric') return BuiltinImages.fabric
  return ''
}
const { isDark } = injection(kTheme)

const container = ref(null as null | HTMLElement)
const { onWheel } = useScrollRight(container)

</script>

<style scoped>
.mod-tag {
  overflow: unset;
}
</style>
