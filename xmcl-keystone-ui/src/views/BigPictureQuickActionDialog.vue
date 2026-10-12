<template>
  <v-dialog
    :model-value="modelValue"
    max-width="740"
    content-class="elevation-0"
    transition="dialog-transition"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="bp-subpage-card !m-0 !p-6 max-h-[85vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-amber-500/20 ring-1 ring-amber-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <v-icon size="26" color="warning">bolt</v-icon>
          </div>
          <div>
            <h2 class="text-xl font-black text-white tracking-wide">
              {{ t('bigPicture.quickMenu') }}
            </h2>
            <div class="text-xs text-white/60">
              {{ t('bigPicture.quickMenuDesc') || 'Швидкий доступ до ігор, налаштувань та системних дій' }}
            </div>
          </div>
        </div>

        <button
          type="button"
          class="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center transition-colors text-white/70"
          data-gamepad-focusable
          @click="$emit('update:modelValue', false)"
        >
          <span v-if="gamepadConnected" class="bp-glyph bp-glyph--b !mr-0">{{ buttonBLabel }}</span>
          <v-icon v-else size="20">close</v-icon>
        </button>
      </div>

      <!-- Search Bar -->
      <div class="pt-4 pb-2">
        <v-text-field
          v-model="search"
          prepend-inner-icon="search"
          :append-inner-icon="gamepadConnected ? 'keyboard' : undefined"
          :placeholder="t('commandPalette.placeholder') || 'Пошук дій або екземплярів...'"
          variant="outlined"
          density="compact"
          rounded="xl"
          clearable
          hide-details
          class="bg-white/5"
          data-gamepad-focusable
          @click:append-inner="openVirtualKeyboard()"
        />
      </div>

      <!-- Content Scroll -->
      <div class="flex-1 overflow-y-auto py-2 custom-scrollbar flex flex-col gap-5">
        <!-- Quick Instances Shelf (if not searching or matching) -->
        <div v-if="filteredInstances.length > 0" class="flex flex-col gap-2">
          <div class="flex items-center justify-between px-1">
            <div class="text-xs font-bold text-white/50 uppercase tracking-wider">
              {{ t('bigPicture.recentInstances') }} ({{ filteredInstances.length }})
            </div>
            <div class="text-xs text-primary font-semibold">
              {{ currentInstance?.name }}
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div
              v-for="inst in filteredInstances.slice(0, 6)"
              :key="inst.path"
              class="p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-3 select-none"
              :class="inst.path === currentInstancePath
                ? 'bg-primary/20 border-primary/60 shadow-[0_0_15px_rgba(var(--v-theme-primary),0.25)]'
                : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/5 text-white/80'"
              tabindex="0"
              data-gamepad-focusable
              @click="onSelectInstance(inst.path)"
              @keydown.enter="onSelectInstance(inst.path)"
            >
              <img
                :src="inst.icon || BuiltinImages.minecraft"
                class="w-9 h-9 rounded-xl object-contain bg-black/30 p-1 shrink-0"
                alt="icon"
              />
              <div class="min-w-0 flex-1">
                <div class="text-xs font-bold text-white truncate">
                  {{ inst.name }}
                </div>
                <div class="text-[11px] text-white/50 truncate">
                  {{ inst.runtime?.minecraft || 'Minecraft' }}
                </div>
              </div>
              <v-icon
                v-if="inst.path === currentInstancePath"
                size="16"
                color="primary"
                class="shrink-0"
              >
                check_circle
              </v-icon>
            </div>
          </div>
        </div>

        <!-- Quick Actions Grid -->
        <div class="flex flex-col gap-2">
          <div class="text-xs font-bold text-white/50 uppercase tracking-wider px-1">
            {{ t('bigPicture.quickActions') || 'Швидкі дії' }}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div
              v-for="action in filteredActions"
              :key="action.id"
              class="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 select-none"
              :class="action.highlight ? 'ring-1 ring-primary/40 bg-primary/10' : ''"
              tabindex="0"
              data-gamepad-focusable
              @click="runAction(action)"
              @keydown.enter="runAction(action)"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  :class="action.badgeClass || 'bg-white/10 text-white'"
                >
                  <v-icon size="22" :color="action.iconColor || 'white'">{{ action.icon }}</v-icon>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-bold text-white truncate">
                    {{ action.title }}
                  </div>
                  <div class="text-xs text-white/50 truncate">
                    {{ action.subtitle }}
                  </div>
                </div>
              </div>

              <v-icon size="18" class="text-white/30 shrink-0">chevron_right</v-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Legend -->
      <div class="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5">
            <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a !mr-0">{{ buttonALabel }}</span>
            <span>{{ t('gamepad.guide.confirm') }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span v-if="gamepadConnected" class="bp-glyph bp-glyph--b !mr-0">{{ buttonBLabel }}</span>
            <span>{{ t('shared.close') }}</span>
          </div>
        </div>

        <button
          type="button"
          class="bp-play-btn !px-6 !py-2 font-bold !text-xs"
          data-gamepad-focusable
          @click="$emit('update:modelValue', false)"
        >
          <span>{{ t('shared.close') }}</span>
        </button>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { injection } from '@/util/inject'
import { kInstances } from '@/composables/instances'
import { kInstance } from '@/composables/instance'
import { useGamepad } from '@/composables/gamepad'
import { useBigPicture } from '@/composables/bigPicture'
import { BuiltinImages } from '@/constant'

const props = withDefaults(defineProps<{
  modelValue?: boolean
}>(), {
  modelValue: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'action', id: string): void
}>()

const { t } = useI18n()
const { instances } = injection(kInstances)
const { path: currentInstancePath, instance: currentInstance, select } = injection(kInstance)
const { openVirtualKeyboard } = useBigPicture()

const gamepad = useGamepad()
const gamepadConnected = gamepad.connected
const buttonALabel = gamepad.buttonA
const buttonBLabel = gamepad.buttonB

const search = ref('')

function onSelectInstance(path: string) {
  select(path)
  emit('update:modelValue', false)
}

function runAction(action: any) {
  emit('update:modelValue', false)
  emit('action', action.id)
}

const filteredInstances = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return instances.value
  return instances.value.filter(i =>
    i.name.toLowerCase().includes(q) ||
    (i.runtime?.minecraft && i.runtime.minecraft.toLowerCase().includes(q)),
  )
})

interface QuickActionItem {
  id: string
  title: string
  subtitle: string
  icon: string
  iconColor?: string
  badgeClass?: string
  highlight?: boolean
}

const allActions = computed<QuickActionItem[]>(() => [
  {
    id: 'launch',
    title: t('bigPicture.play'),
    subtitle: currentInstance.value?.name
      ? t('bigPicture.qaLaunchInstance', { name: currentInstance.value.name })
      : t('bigPicture.qaLaunchDesc'),
    icon: 'play_arrow',
    iconColor: 'primary',
    badgeClass: 'bg-primary/20 text-primary ring-1 ring-primary/40',
    highlight: true,
  },
  {
    id: 'add-instance',
    title: t('bigPicture.addInstance'),
    subtitle: t('bigPicture.qaAddInstanceDesc'),
    icon: 'add_circle',
    iconColor: 'primary',
    badgeClass: 'bg-primary/20 text-primary',
  },
  {
    id: 'tasks',
    title: t('task.manager'),
    subtitle: t('bigPicture.qaTasksDesc'),
    icon: 'downloading',
    iconColor: 'cyan',
    badgeClass: 'bg-cyan-500/20 text-cyan-400',
  },
  {
    id: 'mods',
    title: t('bigPicture.mods'),
    subtitle: t('bigPicture.qaModsDesc'),
    icon: 'extension',
    iconColor: 'amber',
    badgeClass: 'bg-amber-500/20 text-amber-400',
  },
  {
    id: 'instance-settings',
    title: t('bigPicture.instanceSettings'),
    subtitle: t('bigPicture.qaInstanceSettingsDesc'),
    icon: 'tune',
    iconColor: 'violet',
    badgeClass: 'bg-violet-500/20 text-violet-400',
  },
  {
    id: 'folder',
    title: t('bigPicture.openFolder'),
    subtitle: t('bigPicture.qaFolderDesc'),
    icon: 'folder_open',
    iconColor: 'amber',
    badgeClass: 'bg-amber-500/20 text-amber-400',
  },
  {
    id: 'background',
    title: t('bigPicture.changeBackground'),
    subtitle: t('bigPicture.qaBackgroundDesc'),
    icon: 'wallpaper',
    iconColor: 'pink',
    badgeClass: 'bg-pink-500/20 text-pink-400',
  },
  {
    id: 'account',
    title: t('bigPicture.accountSwitcherTitle'),
    subtitle: t('bigPicture.qaAccountDesc'),
    icon: 'account_circle',
    iconColor: 'emerald',
    badgeClass: 'bg-emerald-500/20 text-emerald-400',
  },
  {
    id: 'discover',
    title: t('bigPicture.discover'),
    subtitle: t('bigPicture.qaDiscoverDesc'),
    icon: 'explore',
    iconColor: 'blue',
    badgeClass: 'bg-blue-500/20 text-blue-400',
  },
  {
    id: 'help',
    title: t('gamepad.guideTitle'),
    subtitle: t('bigPicture.qaHelpDesc'),
    icon: 'help_outline',
    iconColor: 'indigo',
    badgeClass: 'bg-indigo-500/20 text-indigo-400',
  },
  {
    id: 'feedback',
    title: t('feedback.name'),
    subtitle: t('bigPicture.qaFeedbackDesc'),
    icon: 'bug_report',
    iconColor: 'rose',
    badgeClass: 'bg-rose-500/20 text-rose-400',
  },
  {
    id: 'exit-big-picture',
    title: t('bigPicture.exit'),
    subtitle: t('bigPicture.qaExitDesc'),
    icon: 'power_settings_new',
    iconColor: 'red',
    badgeClass: 'bg-red-500/20 text-red-400',
  },
])

const filteredActions = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return allActions.value
  return allActions.value.filter(a =>
    a.title.toLowerCase().includes(q) ||
    a.subtitle.toLowerCase().includes(q),
  )
})
</script>
