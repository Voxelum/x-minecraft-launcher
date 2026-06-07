<template>
  <div
    ref="el"
    data-testid="store-project-card"
    class="explore-card surface-card-clickable group relative overflow-hidden flex flex-col h-full"
    role="button"
    tabindex="0"
    :aria-label="value?.title || ''"
    @click="$emit('click')"
    @keydown.enter.prevent="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <!-- Image Area -->
    <div class="explore-card__media aspect-[16/9] relative overflow-hidden">
      <transition name="fade-transition" mode="out-in">
        <img
          :key="imgSrc"
          :src="imgSrc"
          class="explore-card__img w-full h-full object-cover"
          loading="lazy"
        />
      </transition>

      <!-- Gradient overlay -->
      <div class="explore-card__gradient absolute inset-0 pointer-events-none" />

      <!-- Source badge (top-left) -->
      <div class="absolute top-3 left-3 flex items-center gap-1.5">
        <div
          class="explore-card__source flex items-center gap-1.5 px-2 py-1 rounded-full backdrop-blur-md"
          :class="sourceBadgeClass"
        >
          <v-icon v-if="sourceIcon" size="14" :color="sourceIconColor">
            {{ sourceIcon }}
          </v-icon>
          <span class="text-[10px] font-bold uppercase tracking-wider">
            {{ sourceLabel }}
          </span>
        </div>
      </div>

      <!-- Version pill (top-right) -->
      <div v-if="value.version" class="absolute top-3 right-3">
        <div
          class="explore-card__version flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 backdrop-blur-md"
        >
          <v-icon size="12" color="white" class="material-icons-outlined"> sell </v-icon>
          <span class="text-[10px] font-semibold text-white">
            {{ value.version }}
          </span>
        </div>
      </div>
    </div>

    <!-- Content Area -->
    <div class="explore-card__content p-4 flex flex-col flex-1 gap-2.5">
      <!-- Header row: floating avatar + title/author inline -->
      <div class="flex items-center gap-3">
        <img
          :src="value.iconUrl"
          class="explore-card__avatar w-12 h-12 rounded-xl object-cover bg-surface-variant shrink-0"
        />
        <div class="overflow-hidden min-w-0 flex-1">
          <h3
            v-shared-tooltip="value.localizedTitle || value.title"
            class="my-0 mt-1 font-bold text-base leading-tight truncate text-gray-900 dark:text-white group-hover:text-primary transition-colors"
          >
            {{ value.localizedTitle || value.title }}
          </h3>
          <p
            v-if="value.author"
            class="text-xs mt-1 text-gray-500 dark:text-gray-400 truncate flex items-center gap-1"
          >
            <v-icon size="11" class="material-icons-outlined">person</v-icon>
            {{ value.author }}
          </p>
        </div>
      </div>

      <p
        v-shared-tooltip.bottom="value.localizedDescription || value.description"
        class="text-xs text-gray-700 dark:text-gray-400 line-clamp-2 h-9 leading-relaxed"
      >
        {{ value.localizedDescription || value.description }}
      </p>

      <!-- Stats row -->
      <div
        class="explore-card__stats mt-auto pt-2.5 flex items-center justify-between gap-2 text-[11px] text-gray-600 dark:text-gray-400"
      >
        <div
          v-shared-tooltip="t('modrinth.downloads')"
          class="flex items-center gap-1 font-semibold"
        >
          <v-icon size="13" class="material-icons-outlined" color="grey">file_download</v-icon>
          {{ value.downloadCount }}
        </div>
        <div v-shared-tooltip="t('modrinth.updateAt')" class="flex items-center gap-1">
          <v-icon size="13" class="material-icons-outlined" color="grey">schedule</v-icon>
          {{ value.updatedAt }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { useElementHover, useInterval } from '@vueuse/core'

const props = defineProps<{ value: ExploreProjectModern }>()

defineEmits(['click'])

const { t } = useI18n()

const el = ref<HTMLElement | null>(null)
const hover = useElementHover(el)
const { pause, reset, resume, counter } = useInterval(2000, { controls: true, immediate: false })

watch(hover, (isHovering) => {
  if (isHovering) {
    resume()
  } else {
    pause()
    reset()
  }
})

const imgSrc = computed(() => {
  if (props.value.gallery && props.value.gallery.length > 0) {
    return props.value.gallery[counter.value % props.value.gallery.length]
  }
  return props.value.iconUrl
})

const sourceIcon = computed(() => {
  switch (props.value.type) {
    case 'modrinth':
      return 'xmcl:modrinth'
    case 'curseforge':
      return 'xmcl:curseforge'
    case 'ftb':
      return ''
    default:
      return ''
  }
})

const sourceIconColor = computed(() => {
  switch (props.value.type) {
    case 'modrinth':
      return '#00AF5C'
    case 'curseforge':
      return '#F16436'
    default:
      return 'white'
  }
})

const sourceLabel = computed(() => {
  switch (props.value.type) {
    case 'modrinth':
      return 'Modrinth'
    case 'curseforge':
      return 'CurseForge'
    case 'ftb':
      return 'FTB'
    default:
      return props.value.type
  }
})

const sourceBadgeClass = computed(() => {
  return 'bg-black/55 text-white'
})

export interface ExploreProjectModern {
  id: string
  type: 'modrinth' | 'curseforge' | 'ftb'
  title: string
  iconUrl: string
  description: string
  author: string
  downloadCount: string
  updatedAt: string
  version?: string
  gallery?: string[]
  localizedTitle?: string
  localizedDescription?: string
}
</script>

<style scoped>
/* Card shape + interaction live in the global `.surface-card-prominent`
   + `.surface-card-clickable` utilities (see assets/common.css). Only
   keep the component-specific media/CTA/avatar polish here. */
.explore-card {
  z-index: 1;
}

.explore-card__media {
  background-color: rgba(0, 0, 0, 0.05);
}

.explore-card__img {
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
}

.explore-card:hover .explore-card__img {
  transform: scale(1.08);
}

.explore-card__gradient {
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.65) 0%,
    rgba(0, 0, 0, 0.15) 35%,
    rgba(0, 0, 0, 0) 60%
  );
  transition: opacity 0.3s ease;
}

.explore-card:hover .explore-card__gradient {
  opacity: 0.4;
}

.explore-card__source {
  font-size: 10px;
  letter-spacing: 0.06em;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.explore-card__avatar {
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 2px solid rgb(var(--v-theme-surface));
  background-color: rgb(var(--v-theme-surface));
  position: relative;
  z-index: 1;
}

.explore-card__stats {
  border-top: 1px solid rgba(128, 128, 128, 0.15);
}
</style>
