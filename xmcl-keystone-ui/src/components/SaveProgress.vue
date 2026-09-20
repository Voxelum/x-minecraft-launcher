<template>
  <div class="save-progress h-full flex flex-col select-none overflow-hidden relative">
    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center flex-1 gap-3">
      <v-progress-circular indeterminate color="primary" size="36" />
      <span class="text-xs text-neutral-400">{{ t('save.progress.loading') }}</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!progress || (!hasAdvancements && !hasQuests && !hasStats)" class="flex flex-col items-center justify-center flex-1 gap-2 text-neutral-500">
      <v-icon size="40">history_toggle_off</v-icon>
      <span class="text-sm font-medium">{{ t('save.progress.noData') }}</span>
      <span class="text-xs text-center max-w-sm">{{ t('save.progress.noDataHint') }}</span>
    </div>

    <!-- Main Content -->
    <template v-else>
      <div class="flex-1 flex flex-col overflow-hidden relative">
        <SaveProgressCanvas
          :progress="actualProgress"
          :category="category"
          @open-modal="isModalOpen = true"
        />
      </div>

      <!-- Full Window Modal Dialog -->
      <v-dialog
        v-model="isModalOpen"
        fullscreen
        transition="dialog-bottom-transition"
        @keydown.esc="isModalOpen = false"
      >
        <v-card class="h-full w-full flex flex-col bg-[#12141a] overflow-hidden">
          <!-- Window Header Bar -->
          <v-toolbar density="compact" color="surface" class="border-b border-white/10 px-3 flex-shrink-0">
            <v-icon start color="primary">{{ category === 'quests' ? 'military_tech' : 'emoji_events' }}</v-icon>
            <v-toolbar-title class="text-sm font-bold">{{ category === 'quests' ? t('save.progress.quests') : t('save.progress.advancements') }}</v-toolbar-title>
            <v-spacer />
            <v-btn icon size="small" variant="text" :aria-label="t('shared.close')" @click="isModalOpen = false">
              <v-icon>close</v-icon>
            </v-btn>
          </v-toolbar>

          <!-- Modal Canvas Body -->
          <div class="flex-1 flex flex-col overflow-hidden relative">
            <SaveProgressCanvas
              v-if="isModalOpen"
              :progress="actualProgress"
              :category="category"
              is-modal
              @close-modal="isModalOpen = false"
            />
          </div>
        </v-card>
      </v-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useInstanceSaveProgress } from '@/composables/instanceSaveProgress'
import { InstanceSaveProgress } from '@xmcl/runtime-api'
import { toRef, ref, computed } from 'vue'
import SaveProgressCanvas from './SaveProgressCanvas.vue'

const props = defineProps<{
  savePath: string
  instancePath?: string
  category?: 'advancements' | 'quests'
  progress?: InstanceSaveProgress
  loading?: boolean
}>()

const { t } = useI18n()
const savePathRef = toRef(props, 'savePath')
const instancePathRef = toRef(props, 'instancePath')

const internal = props.progress === undefined
  ? useInstanceSaveProgress(savePathRef, instancePathRef)
  : { progress: ref(undefined), loading: ref(false) }

const actualProgress = computed(() => props.progress !== undefined ? props.progress : internal.progress.value)
const actualLoading = computed(() => props.loading !== undefined ? props.loading : internal.loading.value)

const hasAdvancements = computed(() => (actualProgress.value?.advancements?.items?.length ?? 0) > 0)
const hasQuests = computed(() => !!actualProgress.value?.quests && actualProgress.value.quests.chapters.length > 0)
const hasStats = computed(() => !!actualProgress.value?.stats)

const isModalOpen = ref(false)
</script>
