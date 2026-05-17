<template>
  <v-card
    class="upstream-header relative overflow-hidden"
    :class="{ 'upstream-header--dense': dense }"
    :color="cardColor"
    :style="{ 'backdrop-filter': `blur(${blurCard}px)` }"
    outlined
  >
    <!-- Source brand badge -->
    <div
      v-if="sourceLabel"
      class="upstream-header__source absolute top-3 right-3 z-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md"
    >
      <v-icon
        v-if="sourceIcon"
        size="14"
        :color="sourceColor"
      >
        {{ sourceIcon }}
      </v-icon>
      <span class="text-[10px] font-bold uppercase tracking-wider">
        {{ sourceLabel }}
      </span>
    </div>

    <!-- Hero block: icon + title -->
    <div
      class="upstream-header__hero flex"
      :class="dense ? 'flex-row items-center gap-4 p-4 pr-14' : 'flex-col items-center gap-4 px-6 pt-8'"
    >
      <v-img
        :src="value.icon"
        :height="dense ? 72 : 128"
        :width="dense ? 72 : 128"
        :max-width="dense ? 72 : 128"
        class="upstream-header__icon rounded-xl shrink-0"
        cover
      />

      <div
        class="flex flex-col gap-1 min-w-0 flex-1"
        :class="dense ? 'items-start text-left' : 'items-center text-center'"
      >
        <a
          class="upstream-header__title font-bold text-2xl leading-tight overflow-hidden text-ellipsis max-w-full"
          :class="{ 'whitespace-nowrap': !dense }"
          target="browser"
          :href="dense ? undefined : value.url"
          @click="dense ? push(value.store) : undefined"
        >
          {{ value.title }}
        </a>
        <p
          class="upstream-header__description text-sm text-medium-emphasis"
          :class="{ 'text-center': !dense }"
        >
          {{ value.description }}
        </p>
      </div>
    </div>

    <!-- Categories -->
    <div
      v-if="value.categories.length > 0"
      class="upstream-header__categories flex justify-center gap-1.5 px-6 mt-4"
      :class="{ 'flex-wrap': !dense }"
    >
      <CategoryChip
        v-for="v of value.categories"
        :key="v.id"
        :item="v"
        :small="dense"
        outlined
      />
    </div>

    <!-- Info stats (compact pill rows) -->
    <div
      class="upstream-header__infos px-6 mt-5"
    >
      <div class="upstream-header__infos-grid">
        <div
          v-for="info of value.infos"
          :key="info.name"
          class="upstream-header__info-cell"
          v-shared-tooltip="`${info.name}: ${info.value}`"
        >
          <div class="upstream-header__info-text">
            <div class="upstream-header__info-value">{{ info.value }}</div>
            <div class="upstream-header__info-label">
              <v-icon size="11" class="material-icons-outlined upstream-header__info-label-icon">{{ info.icon }}</v-icon>
              <span>{{ info.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div
      v-if="!dense"
      class="upstream-header__cta px-6 pb-6 pt-5 flex justify-center"
    >
      <v-btn
        color="primary"
        variant="tonal"
        append-icon="open_in_new"
        @click="push(value.store)"
      >
        {{ t('store.name') }}
      </v-btn>
    </div>
    <div v-else class="pb-4" />
  </v-card>
</template>
<script lang="ts" setup>
import CategoryChip, { CategoryChipProps } from '@/components/CategoryChip.vue'
import { Highlight } from '@/components/InfoHighlight.vue'
import { kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'

export interface UpstreamHeaderProps {
  url: string
  icon: string
  title: string
  description: string
  infos: Highlight[]
  categories: CategoryChipProps[]
  type: 'curseforge' | 'modrinth' | 'ftb'
  store: string
}

const { push } = useRouter()
const { t } = useI18n()
const props = defineProps<{
  value: UpstreamHeaderProps
  dense?: boolean
}>()

const { cardColor, blurCard } = injection(kTheme)

const sourceIcon = computed(() => {
  switch (props.value.type) {
    case 'modrinth': return 'xmcl:modrinth'
    case 'curseforge': return 'xmcl:curseforge'
    default: return ''
  }
})

const sourceColor = computed(() => {
  switch (props.value.type) {
    case 'modrinth': return '#00AF5C'
    case 'curseforge': return '#F16436'
    default: return undefined
  }
})

const sourceLabel = computed(() => {
  switch (props.value.type) {
    case 'modrinth': return 'Modrinth'
    case 'curseforge': return 'CurseForge'
    case 'ftb': return 'FTB'
    default: return ''
  }
})
</script>
<style scoped>
.upstream-header {
  border-radius: 16px;
  border: 1px solid transparent;
  transition: border-color 0.5s ease;
}

.upstream-header:hover {
  border-color: rgba(var(--v-theme-primary), 0.45);
}

.upstream-header__source {
  background-color: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: white;
}

.upstream-header__icon {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(128, 128, 128, 0.2);
}

.upstream-header__title {
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: color 0.15s ease;
}

.upstream-header__title:hover {
  color: rgb(var(--v-theme-primary));
}

.upstream-header__description {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  line-height: 1.45;
}

.upstream-header__infos-grid {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 1024px) {
  .upstream-header__infos-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .upstream-header--dense .upstream-header__infos-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .upstream-header--dense .upstream-header__infos-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1530px) {
  .upstream-header__infos-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.upstream-header__info-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background-color: rgba(128, 128, 128, 0.08);
  transition: background-color 0.15s ease;
  min-width: 0;
}

.upstream-header__info-cell:hover {
  background-color: rgba(128, 128, 128, 0.14);
}

.upstream-header__info-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.upstream-header__info-value {
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upstream-header__info-label {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  opacity: 0.65;
  overflow: hidden;
}

.upstream-header__info-label-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.upstream-header__info-label > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>