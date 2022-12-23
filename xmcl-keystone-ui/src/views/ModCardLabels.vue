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
      {{ source.id }}
    </v-chip>
    <v-chip
      v-for="(com, i) in compatibility"
      :key="com.modId + ' ' + i"
      class="mod-tag"
      small
      label
      outlined
      @mouseenter="onEnter($event, com)"
      @mouseleave="onLeave"
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
import { useTheme } from '@/composables'
import { kSharedTooltip } from '@/composables/sharedTooltip'
import { getColor } from '@/util/color'
import { injection } from '@/util/inject'
import { CompatibleDetail } from '@/util/modCompatible'
import { kModsContext, ModItem } from '../composables/mod'

defineProps<{
  source: ModItem
  compatibility: CompatibleDetail[]
  onEditTag(event: Event, index: number): void
  onDeleteTag(tag: string): void
}>()

const { onLeave, onEnter } = injection(kSharedTooltip)
const { icons } = injection(kModsContext)

const getCompatibleIcon = (c?: CompatibleDetail) => {
  if (!c) return '❔'
  if (c.compatible === 'maybe') return '❔'
  return c.compatible ? '✔️' : '❌'
}

const getDepIcon = (name: string, icon?: string) => {
  if (icon) return icon
  if (name === 'forge') return 'image://builtin/forge'
  if (name === 'minecraft') return 'image://builtin/minecraft'
  if (name === 'fabricloader' || name.startsWith('fabric-')) return 'image://builtin/fabric'
  return ''
}
const { darkTheme } = useTheme()

const container = ref(null as null | HTMLElement)
const onWheel = (e: WheelEvent) => {
  container.value!.scrollLeft += (e.deltaY / 2)
  e.preventDefault()
}

</script>

<style scoped>
.mod-tag {
  overflow: unset;
}
</style>
