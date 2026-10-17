<template>
  <v-dialog
    :model-value="modelValue"
    max-width="650"
    content-class="elevation-0"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="bp-subpage-card !m-0 !p-6 max-h-[85vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <v-icon color="primary" size="24">bug_report</v-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold">{{ t('feedback.name') }}</h2>
            <div class="text-xs text-white/60">
              {{ t('feedback.description') }}
            </div>
          </div>
        </div>

        <v-btn
          icon="close"
          variant="text"
          size="small"
          data-gamepad-focusable
          @click="$emit('update:modelValue', false)"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto py-4 custom-scrollbar flex flex-col gap-4">
        <!-- Community Channels -->
        <div class="flex flex-col gap-3">
          <!-- GitHub -->
          <div
            class="bp-setting-row !p-4 cursor-pointer"
            tabindex="0"
            role="button"
            data-gamepad-focusable
            @click="openUrl('https://github.com/Voxelum/x-minecraft-launcher/issues')"
            @keydown.enter="openUrl('https://github.com/Voxelum/x-minecraft-launcher/issues')"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              </div>
              <div class="flex flex-col">
                <div class="font-bold text-sm text-white">{{ t('feedback.github') }}</div>
                <div class="text-xs text-white/50">{{ t('feedback.githubDescription') }}</div>
              </div>
            </div>
            <v-icon size="20" class="text-white/40">open_in_new</v-icon>
          </div>

          <!-- Discord -->
          <div
            class="bp-setting-row !p-4 cursor-pointer"
            tabindex="0"
            role="button"
            data-gamepad-focusable
            @click="openUrl('https://discord.gg/WUm4HAqmBn')"
            @keydown.enter="openUrl('https://discord.gg/WUm4HAqmBn')"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-[#5865F2]/20 flex items-center justify-center">
                <v-icon size="24">xmcl:discord</v-icon>
              </div>
              <div class="flex flex-col">
                <div class="font-bold text-sm text-white">{{ t('feedback.discord') }}</div>
                <div class="text-xs text-white/50">{{ t('feedback.discordDescription') }}</div>
              </div>
            </div>
            <v-icon size="20" class="text-white/40">open_in_new</v-icon>
          </div>

          <!-- Reddit -->
          <div
            class="bp-setting-row !p-4 cursor-pointer"
            tabindex="0"
            role="button"
            data-gamepad-focusable
            @click="openUrl('https://www.reddit.com/r/XMCL/')"
            @keydown.enter="openUrl('https://www.reddit.com/r/XMCL/')"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-[#FF4500]/20 flex items-center justify-center">
                <v-icon size="24" color="#FF4500">xmcl:reddit</v-icon>
              </div>
              <div class="flex flex-col">
                <div class="font-bold text-sm text-white">{{ t('feedback.reddit') }}</div>
                <div class="text-xs text-white/50">{{ t('feedback.redditDescription') }}</div>
              </div>
            </div>
            <v-icon size="20" class="text-white/40">open_in_new</v-icon>
          </div>

          <!-- Export Diagnostic Logs -->
          <div
            class="bp-setting-row !p-4 cursor-pointer"
            tabindex="0"
            role="button"
            data-gamepad-focusable
            @click="exportLogs"
            @keydown.enter="exportLogs"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <v-icon size="24" color="warning">folder_zip</v-icon>
              </div>
              <div class="flex flex-col">
                <div class="font-bold text-sm text-white">{{ t('feedback.generateReport') }}</div>
                <div class="text-xs text-white/50">{{ t('feedback.description') }}</div>
              </div>
            </div>
            <v-icon size="20" class="text-white/40">folder</v-icon>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="pt-3 border-t border-white/10 flex items-center justify-end">
        <v-btn
          color="primary"
          variant="tonal"
          class="rounded-xl font-semibold"
          data-gamepad-focusable
          @click="$emit('update:modelValue', false)"
        >
          <span v-if="gamepadConnected" class="bp-glyph bp-glyph--b mr-1">{{ buttonBLabel }}</span>
          {{ t('shared.close') }}
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDialog } from '@/composables/dialog'
import { useService } from '@/composables/service'
import { useGamepad } from '@/composables/gamepad'
import { BaseServiceKey } from '@xmcl/runtime-api'

const props = withDefaults(defineProps<{
  modelValue?: boolean
}>(), {
  modelValue: false,
})

defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const { t } = useI18n()
const { handleUrl } = useService(BaseServiceKey)
const { show: showLogDialog } = useDialog('log')

const gamepad = useGamepad()
const gamepadConnected = gamepad.connected
const buttonBLabel = gamepad.buttonB

function openUrl(url: string) {
  handleUrl(url)
}

function exportLogs() {
  showLogDialog()
}
</script>
