<template>
  <div class="flex gap-1 flex-wrap mt-1">
    <v-chip
      small
      :outlined="darkTheme"
      color="orange en-1"
      label
      style="margin-left: 1px;"
      @mousedown.stop
    >
      {{ source.id }}
    </v-chip>
    <v-chip
      v-for="com of compatibility"
      :key="com.modId"
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
        class="max-w-50 overflow-auto"
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

</script>

<style scoped>

.draggable-card:hover {
  color: rgba(255,255,255, 0.9) !important;
}
.draggable-card:hover {
  background-color: #388e3c;
}

.unknown:hover {
  background-color: #bb724b;
}
.maybe:hover {
  background-color: #679793 !important;
}
.title {
  max-width: 100%;
  white-space: nowrap;
}
.subsequence {
  margin-left: 45px;
}
.incompatible.draggable-card:hover {
  background-color: #e65100;
}

.dark .subsequence.draggable-card {
  /* background-color: rgba(255, 255, 255, 0.15); */
  border-color: rgba(255, 255, 255, 0.15);
  background-color: rgba(52, 52, 52, 0.15);
  /* border-color: #343434; */
}
.subsequence.draggable-card {
  background-color: rgba(0, 0, 0, 0.1);
  border-color: rgba(0, 0, 0, 0.1);
}

.subsequence.draggable-card:hover {
  background-color: #388e3c;
}
.subsequence.incompatible.draggable-card:hover {
  background-color: #e65100 !important;
}
.mod-card .avatar {
  min-height: 50px;
  max-height: 50px;
  max-width:  50px;
  min-width:  50px;
  margin: 0 10px 0 0;
}
</style>
