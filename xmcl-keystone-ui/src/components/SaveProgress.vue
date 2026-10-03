<template>
  <div class="save-progress h-full flex flex-col select-none overflow-hidden relative">
    <!-- Loading State -->
    <div v-if="actualLoading" class="flex flex-col items-center justify-center flex-1 gap-3">
      <v-progress-circular indeterminate color="primary" size="36" />
      <span class="text-sm text-medium-emphasis" role="status">{{ t('save.progress.loading') }}</span>
    </div>

    <ErrorView v-else-if="actualError" class="min-h-0 flex-1 overflow-auto" :error="actualError" @refresh="refresh" />

    <!-- Empty State -->
    <div v-else-if="!actualProgress || (!hasAdvancements && !hasQuests && !hasStats)" class="flex flex-col items-center justify-center flex-1 gap-2 px-4 text-medium-emphasis" role="status">
      <v-icon size="40">history_toggle_off</v-icon>
      <span class="text-sm font-medium">{{ t('save.progress.noData') }}</span>
      <span class="text-sm text-center max-w-sm">{{ t('save.progress.noDataHint') }}</span>
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
        <v-card class="save-progress-dialog h-full w-full flex flex-col overflow-hidden">
          <!-- Window Header Bar -->
          <v-toolbar density="compact" color="surface" class="border-b px-3 flex-shrink-0">
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
import ErrorView from './ErrorView.vue'

const props = defineProps<{
  savePath: string
  instancePath?: string
  category?: 'advancements' | 'quests'
  progress?: InstanceSaveProgress
  loading?: boolean
  error?: unknown
}>()

const emit = defineEmits<{ (event: 'refresh'): void }>()
const { t } = useI18n()
const savePathRef = toRef(props, 'savePath')
const instancePathRef = toRef(props, 'instancePath')

const internal = props.loading === undefined && props.progress === undefined
  ? useInstanceSaveProgress(savePathRef, instancePathRef)
  : undefined

const actualProgress = computed(() => internal ? internal.progress.value : props.progress)
const actualLoading = computed(() => internal ? internal.loading.value : props.loading)
const actualError = computed(() => internal ? internal.error.value : props.error)
function refresh() {
  if (internal) internal.refresh()
  else emit('refresh')
}

const hasAdvancements = computed(() => (actualProgress.value?.advancements?.items?.length ?? 0) > 0)
const hasQuests = computed(() => !!actualProgress.value?.quests && actualProgress.value.quests.chapters.length > 0)
const hasStats = computed(() => !!actualProgress.value?.stats)

const isModalOpen = ref(false)
</script>

<style scoped>
.save-progress-dialog {
  border-radius: 0 !important;
}
</style>
