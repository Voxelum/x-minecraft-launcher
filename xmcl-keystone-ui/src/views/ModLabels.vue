<template>
  <div
    ref="container"
    class="flex gap-1"
    @wheel="onWheel"
  >
    <v-chip
      v-if="modid"
      size="x-small"
      class="mod-tag font-mono text-[11px]"
      variant="tonal"
      color="secondary"
      :disabled="disabled"
      rounded="md"
      @mousedown.stop
    >
      {{ modid }}
    </v-chip>
    <v-chip
      v-for="(com, i) in sortedCompatibility"
      :key="com.modId + ' ' + i"
      v-shared-tooltip="getTooltip(com)"
      class="mod-tag cursor-pointer font-medium text-[11px]"
      :disabled="disabled"
      size="x-small"
      rounded="md"
      variant="tonal"
      :color="com.compatible === false ? 'error' : undefined"
      @click.stop="emit('click-dependency', com.modId)"
      @mousedown.stop
    >
      <template #prepend v-if="com.compatible === true">
        <v-avatar start size="14">
          <v-img
            v-if="getDepIcon(com.modId, icons[com.modId])"
            :src="getDepIcon(com.modId, icons[com.modId])"
          />
          <v-icon v-else size="12">
            xmcl:package
          </v-icon>
        </v-avatar>
      </template>
      <span class="text-secondary mr-1 text-[10px]" v-if="com.optional">
        {{ t('optional') }}
      </span>
      <span>{{ com.modId }}</span>
      <template #append>
        <v-icon
          v-if="com.compatible === true"
          size="13"
          color="success"
          class="ml-0.5 opacity-80"
        >
          check
        </v-icon>
        <v-icon
          v-else-if="com.compatible === false"
          size="13"
          color="error"
          class="ml-0.5"
        >
          close
        </v-icon>
        <v-icon
          v-else
          size="13"
          color="warning"
          class="ml-0.5"
        >
          help_outline
        </v-icon>
      </template>
    </v-chip>

    <v-chip
      v-for="(tag, index) in tags"
      :key="`${tag}-${index}`"
      variant="tonal"
      class="mod-tag font-medium"
      size="x-small"
      rounded="md"
      :disabled="disabled"
      :color="getColor(tag)"
      closable
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
  (event: 'click-dependency', modId: string): void
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
function onWheel(e: WheelEvent) {
  // Walk up to find the nearest horizontally-scrollable ancestor.
  // The container itself may not scroll because the parent (MarketItem.market-item__tags)
  // is the actual overflow:auto container, so we need to scroll that.
  let el: HTMLElement | null = container.value
  while (el) {
    const style = getComputedStyle(el)
    const overflowX = style.overflowX
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += e.deltaY / 2
      e.preventDefault()
      return
    }
    el = el.parentElement
  }
}

const { t } = useI18n()

</script>

<style scoped>
.mod-tag {
  overflow: unset !important;
  flex-shrink: 0;
}
</style>
