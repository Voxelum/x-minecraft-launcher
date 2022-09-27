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
    <v-tooltip
      v-for="com of Object.entries(source.compatibility)"
      :key="com[0]"
      top
      color="black"
      transition="scroll-y-reverse-transition"
    >
      <template #activator="{ on }">
        <v-chip
          small
          label
          outlined
          v-on="on"
        >
          <v-avatar left>
            <img
              v-if="getDepIcon(com[0], source.dependenciesIcon[com[0]])"
              :src="getDepIcon(com[0], source.dependenciesIcon[com[0]])"
            >
            <v-icon v-else>
              $vuetify.icons.package
            </v-icon>
          </v-avatar>
          {{ com[0] }}
          {{ com[1].requirements || '⭕' }}
          <v-avatar right>
            {{ getCompatibleIcon(com[1]) }}
          </v-avatar>
        </v-chip>
      </template>
      {{ getCompatibleTooltip(com[1]) }}
    </v-tooltip>

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
      >
        {{ tag }}
      </div>
    </v-chip>
  </div>
</template>

<script lang=ts setup>
import { CompatibleDetail } from '@xmcl/runtime-api'
import { ModItem } from '../composables/mod'
import fabricPng from '/@/assets/fabric.png'
import forgePng from '/@/assets/forge.png'
import minecraftPng from '/@/assets/minecraft.png'
import { useI18n, useTheme } from '/@/composables'
import { getColor } from '/@/util/color'

const props = defineProps<{
  source: ModItem
  onEditTag(event: Event, index: number): void
  onDeleteTag(tag: string): void
}>()

const getCompatibleIcon = (c?: CompatibleDetail) => {
  if (!c) return '❔'
  if (c.compatible === 'maybe') return '❔'
  return c.compatible ? '✔️' : '❌'
}

const getDepIcon = (name: string, icon?: string) => {
  if (icon) return icon
  if (name === 'forge') return forgePng
  if (name === 'minecraft') return minecraftPng
  if (name === 'fabricloader' || name.startsWith('fabric-')) return fabricPng
  return ''
}

const { t } = useI18n()
const { darkTheme } = useTheme()

const getCompatibleTooltip = (dep: CompatibleDetail) => {
  const compatibleText = dep.compatible === 'maybe'
    ? t('mod.maybeCompatible')
    : dep.compatible
      ? t('mod.compatible')
      : t('mod.incompatible')
  return compatibleText + t('mod.acceptVersion', { version: dep.requirements }) + ', ' + t('mod.currentVersion', { current: dep.version || '⭕' }) + '.'
}
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
