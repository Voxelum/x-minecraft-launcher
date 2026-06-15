<template>
  <AppMoodBackground
    v-if="!data.fetching"
    variant="ambient"
    data-testid="setup-root"
    class="setup flex h-full w-full flex-col overflow-hidden select-none"
  >
    <v-stepper
      v-model="data.step"
      flat
      class="setup-stepper non-moveable flex h-full min-h-0 flex-col overflow-hidden bg-transparent"
    >
      <v-stepper-header class="setup-stepper-header px-4 py-2">
        <v-stepper-item
          :complete="data.step > 1"
          :editable="data.step > 1"
          :value="1"
          color="primary"
          class="setup-stepper-item"
        >
          {{ t('setup.locale.name') }}
        </v-stepper-item>

        <v-divider class="mx-1" />

        <v-stepper-item
          :complete="data.step > 2"
          :editable="data.step > 2"
          :value="2"
          color="primary"
          class="setup-stepper-item"
        >
          {{ t('setup.appearance.name') }}
        </v-stepper-item>

        <v-divider class="mx-1" />

        <v-stepper-item
          :complete="data.step > 3"
          :editable="data.step > 3"
          :value="3"
          color="primary"
          class="setup-stepper-item"
        >
          {{ t('setup.dataRoot.name') }}
        </v-stepper-item>

        <v-divider class="mx-1" />

        <v-stepper-item :value="4" color="primary" class="setup-stepper-item">
          {{ t('setup.account.name') }}
        </v-stepper-item>
      </v-stepper-header>

      <v-stepper-window
        class="setup-stepper-window"
        transition="setup-step-forward"
        reverse-transition="setup-step-back"
      >
        <v-stepper-window-item
          class="setup-stepper-window-item"
          :value="1"
        >
          <div class="setup-pane-wrap">
            <AppMoodSurface fill>
              <SetLocale
                v-model="localeRef"
              />
            </AppMoodSurface>
          </div>
        </v-stepper-window-item>
        <v-stepper-window-item
          class="setup-stepper-window-item"
          :value="2"
        >
          <div class="setup-pane-wrap">
            <AppMoodSurface fill>
              <SetupAppearance
                v-model="data.path"
                class="h-full"
                :default-path="data.defaultPath"
                :drives="data.drives"
              />
            </AppMoodSurface>
          </div>
        </v-stepper-window-item>
        <v-stepper-window-item
          class="setup-stepper-window-item"
          :value="3"
        >
          <div class="setup-pane-wrap">
            <AppMoodSurface fill>
              <SetDataRoot
                v-model="data.path"
                class="h-full"
                :error="data.pathError"
                :default-path="data.defaultPath"
                :drives="data.drives"
              />
            </AppMoodSurface>
          </div>
        </v-stepper-window-item>
        <v-stepper-window-item
          class="setup-stepper-window-item"
          :value="4"
        >
          <div class="setup-pane-wrap">
            <AppMoodSurface fill>
              <SetupAccount
                v-model="data.instancePath"
                @skip="setup"
              />
            </AppMoodSurface>
          </div>
        </v-stepper-window-item>
      </v-stepper-window>
      <slot name="actions">
        <SetupFooter
          :prev="data.step !== 1"
          next
          :disabled="data.step === 3 && hasError"
          :loading="data.loading"
          :finish="data.step === 4"
          @prev="prev"
          @next="data.step === 4 ? setup() : next()"
        />
      </slot>
    </v-stepper>
  </AppMoodBackground>
  <v-card
    v-else
    class="flex h-full w-full items-center justify-center"
  >
    <v-img
      class="max-w-50"
      src="http://launcher/icons/logoDark"
    />
  </v-card>
</template>

<script lang="ts" setup>
import AppMoodBackground from '@/components/AppMoodBackground.vue'
import AppMoodSurface from '@/components/AppMoodSurface.vue'
import { useService } from '@/composables'
import { kSettingsState } from '@/composables/setting'
import { BackgroundType, kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'
import { BaseServiceKey, Drive, InvalidDirectoryErrorCode } from '@xmcl/runtime-api'
import SetupAccount from './SetupAccount.vue'
import SetupAppearance from './SetupAppearance.vue'
import SetDataRoot from './SetupDataRoot.vue'
import SetupFooter from './SetupFooter.vue'
import SetLocale from './SetupLocale.vue'

const emit = defineEmits(['ready'])
const { validateDataDictionary, getEnvironment } = useService(BaseServiceKey)

const next = () => {
  data.step = Number(data.step) + 1
}
const prev = () => {
  data.step = Number(data.step) - 1
}

const { locale, t } = useI18n()
const localeRef = computed({
  get: () => state.value?.locale ?? locale.value,
  set: (v) => {
    state.value?.localeSet(v ?? locale.value)
  },
})

const data = reactive({
  step: 1,
  fetching: true,
  minecraftPath: '',
  instancePath: '',
  path: '',
  pathError: '' as InvalidDirectoryErrorCode,
  defaultPath: '',
  loading: false,
  drives: [] as Drive[],
  theme: 'system',
})
provide('setup', data)
bootstrap.preset().then(({ minecraftPath, defaultPath, locale: locale_, drives }) => {
  data.fetching = false
  if (locale_.startsWith('en')) {
    locale_ = 'en'
  }
  locale.value = locale_
  data.minecraftPath = minecraftPath
  data.instancePath = minecraftPath
  data.path = defaultPath
  data.defaultPath = defaultPath
  data.drives = drives
})

const hasError = computed(() => !!data.pathError && data.pathError !== 'exists')
watch(() => data.path, (newPath) => {
  data.loading = true
  data.pathError = undefined
  validateDataDictionary(newPath).then((reason) => {
    data.loading = false
    if (!reason) {
      data.path = newPath
    } else {
      data.pathError = reason
    }
  })
})

const { isDark, currentTheme, saveCurrentTheme } = injection(kTheme)

const updateTheme = (theme: 'dark' | 'system' | 'light') => {
  if (theme === 'system') {
    currentTheme.value.dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  } else if (theme === 'dark') {
    currentTheme.value.dark = true
  } else {
    currentTheme.value.dark = false
  }
}

updateTheme(data.theme as any)

watch(() => data.theme, () => {
  updateTheme(data.theme as any)
})

const { state } = injection(kSettingsState)

async function setup() {
  await bootstrap.bootstrap(data.path)
  // The wizard mutates `currentTheme` in-place when it picks defaults
  // (dark mode + Halo background on GPU machines). `useTheme()` does not
  // auto-persist those mutations, so we must explicitly save here —
  // otherwise the first launch shows Halo but `theme.json` is never
  // written and the next launch falls back to `BackgroundType.NONE`.
  //
  // Await the environment lookup so the Halo assignment is in place
  // before we serialize, instead of racing with the wizard unmounting.
  try {
    const e = await getEnvironment()
    if (e.gpu && isDark.value) {
      currentTheme.value.backgroundType = BackgroundType.HALO
    }
  } catch (err) {
    console.error('Failed to detect environment during setup', err)
  }
  try {
    await saveCurrentTheme()
  } catch (err) {
    console.error('Failed to persist initial theme during setup', err)
  }
  emit('ready', data)
  if (state.value) {
    state.value.localeSet(locale.value)
  } else {
    const dismiss = watch(state, (s) => {
      if (s) {
        s.localeSet(locale.value)
        dismiss()
      }
    })
  }
  data.loading = true
}
</script>

<style>
.setup .v-stepper-header {
  flex: 0 0 auto;
}

.setup-stepper-header {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  backdrop-filter: blur(10px);
}

.setup-stepper-item {
  border-radius: 12px;
  transition:
    background-color 0.18s ease,
    transform 0.18s ease;
}

.setup-stepper-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
  transform: translateY(-1px);
}

.setup .v-stepper-window {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  overflow: hidden;
}

.setup .v-stepper-window .v-window__container {
  height: 100%;
}

.setup .v-stepper-window-item {
  height: 100%;
  overflow: auto;
  overflow-x: hidden;
}

.setup-pane-wrap {
  padding: 12px 16px 16px;
}

.setup .v-stepper.v-sheet {
  overflow: hidden;
}

.setup-step-forward-enter-active,
.setup-step-forward-leave-active,
.setup-step-back-enter-active,
.setup-step-back-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.setup-step-forward-enter-from,
.setup-step-back-leave-to {
  opacity: 0;
  transform: translateX(22px) scale(0.985);
}

.setup-step-forward-leave-to,
.setup-step-back-enter-from {
  opacity: 0;
  transform: translateX(-22px) scale(0.985);
}

@media (prefers-reduced-motion: reduce) {
  .setup-step-forward-enter-active,
  .setup-step-forward-leave-active,
  .setup-step-back-enter-active,
  .setup-step-back-leave-active,
  .setup-stepper-item {
    transition: none;
  }
}

</style>
