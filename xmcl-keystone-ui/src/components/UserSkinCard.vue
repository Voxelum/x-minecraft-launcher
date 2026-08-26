<template>
  <div
    class="user-skin-card relative flex flex-col items-center rounded-xl cursor-pointer select-none group overflow-hidden"
    :class="[
      isSelected ? 'selected' : '',
      isEquipped ? 'is-equipped' : ''
    ]"
    role="button"
    tabindex="0"
    @click="$emit('select', skin)"
    @keydown.enter.prevent="$emit('select', skin)"
    @keydown.space.prevent="$emit('select', skin)"
  >
    <!-- Skin Preview Area -->
    <div class="skin-preview-area relative w-full flex items-center justify-center py-5 px-3">
      <!-- Equipped glow -->
      <div
        v-if="isEquipped"
        class="absolute inset-0 rounded-t-xl"
        style="background: radial-gradient(ellipse at center bottom, rgba(76,175,80,0.12) 0%, transparent 70%);"
      />

      <!-- 2D Skin -->
      <PlayerSkin2D
        :src="skin.url"
        :slim="skin.slim"
        :width="56"
        :height="112"
        class="relative z-10 skin-figure"
      />

      <!-- Equipped checkmark -->
      <div
        v-if="isEquipped"
        class="absolute top-2 left-2 z-20 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-sm"
      >
        <v-icon size="12" color="white">check</v-icon>
      </div>

      <!-- Model type pill -->
      <div
        class="absolute top-2 right-2 z-20 px-1.5 py-px rounded-md text-[9px] font-bold uppercase tracking-wide"
        :class="skin.slim
          ? 'bg-purple-500/20 text-purple-300'
          : 'bg-blue-500/20 text-blue-300'"
      >
        {{ skin.slim ? 'Slim' : 'Classic' }}
      </div>

      <!-- Hover action buttons — float at bottom without overlay -->
      <div
        class="action-bar absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-1.5 z-30"
      >
        <v-btn
          v-if="!isEquipped"
          v-shared-tooltip.top="() => t('userSkin.equip')"
          icon
          size="x-small"
          color="success"
          variant="flat"
          @click.stop="$emit('equip', skin)"
        >
          <v-icon size="14">check</v-icon>
        </v-btn>

        <v-btn
          v-shared-tooltip.top="() => t('userSkin.edit')"
          icon
          size="x-small"
          variant="flat"
          color="surface"
          @click.stop="$emit('edit', skin)"
        >
          <v-icon size="14">edit</v-icon>
        </v-btn>

        <v-btn
          v-shared-tooltip.top="() => t('shared.delete')"
          icon
          size="x-small"
          color="error"
          variant="flat"
          @click.stop="$emit('delete', skin)"
        >
          <v-icon size="14">delete</v-icon>
        </v-btn>
      </div>
    </div>

    <!-- Name bar -->
    <div class="w-full px-2.5 py-2 text-center">
      <div class="text-[11px] font-semibold truncate leading-tight opacity-80" :title="skin.name">
        {{ skin.name }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import PlayerSkin2D from '@/components/PlayerSkin2D.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { SkinLibraryItem } from '@/composables/userSkinLibrary'

const props = defineProps<{
  skin: SkinLibraryItem
  isSelected: boolean
  isEquipped: boolean
}>()

defineEmits<{
  (e: 'select', skin: SkinLibraryItem): void
  (e: 'equip', skin: SkinLibraryItem): void
  (e: 'edit', skin: SkinLibraryItem): void
  (e: 'delete', skin: SkinLibraryItem): void
}>()

const { t } = useI18n()
</script>

<style scoped>
.user-skin-card {
  background: rgba(var(--v-theme-on-surface), 0.03);
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.user-skin-card:hover {
  background: rgba(var(--v-theme-on-surface), 0.07);
}

.user-skin-card.selected {
  background: rgba(var(--v-theme-primary), 0.1);
  box-shadow: inset 0 0 0 1.5px rgba(var(--v-theme-primary), 0.5);
}

.user-skin-card.is-equipped {
  background: rgba(76, 175, 80, 0.05);
}

.skin-preview-area {
  min-height: 140px;
}

.skin-figure {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
  transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.user-skin-card:hover .skin-figure {
  transform: scale(1.08);
}

.action-bar {
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.user-skin-card:hover .action-bar {
  opacity: 1;
  transform: translateY(0);
}
</style>
