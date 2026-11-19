<template>
  <v-dialog v-model="isShown" class="java-update-dialog" max-width="480">
    <v-card>
      <div class="java-update-header">
        <div class="flex h-10 w-10 items-center justify-center">
          <v-icon color="primary" size="22">coffee</v-icon>
        </div>
        <v-card-title class="java-update-title text-base font-bold">
          {{ t('javaUpdate.title') }}
        </v-card-title>
      </div>
      <v-card-text class="java-update-body">
        <p class="text-sm text-medium-emphasis">
          {{ t('javaUpdate.description') }}
        </p>
        <div class="java-version-comparison gap-3 p-4">
          <div class="min-w-0 flex-1">
            <div class="text-xs text-medium-emphasis">{{ t('javaUpdate.currentVersion') }}</div>
            <div class="mt-1 break-all font-mono text-base font-semibold">
              {{ prompt?.currentVersion }}
            </div>
          </div>
          <v-icon aria-hidden="true" class="shrink-0" color="primary" size="20"
            >arrow_forward</v-icon
          >
          <div class="min-w-0 flex-1 text-right">
            <div class="text-xs text-medium-emphasis">{{ t('javaUpdate.newVersion') }}</div>
            <div class="mt-1 break-all font-mono text-base font-semibold text-primary">
              {{ prompt?.nextVersion }}
            </div>
          </div>
        </div>
      </v-card-text>
      <v-card-actions class="java-update-actions">
        <v-spacer />
        <v-btn variant="text" rounded="pill" @click="respond(false)">
          {{ t('javaUpdate.later') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          rounded="pill"
          class="px-5 font-semibold"
          @click="respond(true)"
        >
          {{ t('javaUpdate.ok') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useDialog } from '@/composables/dialog'
import { resolveJavaUpdatePrompt, type JavaUpdatePromptPayload } from '@/composables/javaUpdate'

const { t } = useI18n()
const activeId = ref<number>()
const { isShown, parameter, hide } = useDialog<JavaUpdatePromptPayload>(
  'java-update',
  (payload) => {
    activeId.value = payload.id
  },
  () => {
    if (activeId.value !== undefined) resolveJavaUpdatePrompt(activeId.value, false)
    activeId.value = undefined
  },
)
const prompt = parameter

function respond(update: boolean) {
  if (activeId.value !== undefined) resolveJavaUpdatePrompt(activeId.value, update)
  activeId.value = undefined
  hide()
}
</script>

<style scoped>
.java-update-dialog {
  user-select: none;
}

.java-update-header {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  padding: 20px 24px 12px;
}

.java-update-title {
  text-align: center;
  white-space: normal;
  line-height: 1.3;
}

.java-update-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 24px 16px;
}

.java-version-comparison {
  display: flex;
  align-items: center;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.java-update-actions {
  padding: 0 24px 20px;
}
</style>
