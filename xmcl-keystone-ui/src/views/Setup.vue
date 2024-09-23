<template>
  <v-card
    v-if="!data.fetching"
    class="setup flex flex-col overflow-auto"
  >
    <v-stepper
      v-model="data.step"
      class="non-moveable visible-scroll flex h-full flex-col overflow-auto bg-transparent"
    >
      <v-stepper-header>
        <v-stepper-step
          :complete="data.step > 1"
          :editable="data.step > 1"
          step="1"
        >
          {{ t('setup.locale.name') }}
        </v-stepper-step>

        <v-divider />

        <v-stepper-step
          :complete="data.step > 2"
          :editable="data.step > 2"
          step="2"
        >
          {{ t('setup.appearance.name') }}
        </v-stepper-step>

        <v-divider />

        <v-stepper-step
          :complete="data.step > 3"
          :editable="data.step > 3"
          step="3"
        >
          {{ t('setup.dataRoot.name') }}
        </v-stepper-step>

        <v-divider />

        <v-stepper-step step="4">
          {{ t('setup.account.name') }}
        </v-stepper-step>
      </v-stepper-header>

      <v-stepper-items class="h-full overflow-auto overflow-x-hidden">
        <v-stepper-content
          class="h-full overflow-auto overflow-x-hidden pt-2"
          step="1"
        >
          <SetLocale
            v-model="locale"
          />
        </v-stepper-content>
        <v-stepper-content
          class="h-full overflow-auto overflow-x-hidden pt-2"
          step="2"
        >
          <SetupAppearance
            v-model="data.path"
            class="h-full overflow-y-auto px-4"
            :default-path="data.defaultPath"
            :drives="data.drives"
          />
        </v-stepper-content>
        <v-stepper-content
          class="h-full overflow-auto overflow-x-hidden pt-2"
          step="3"
        >
          <SetDataRoot
            v-model="data.path"
            class="h-full overflow-auto"
            :error="data.pathError"
            :default-path="data.defaultPath"
            :drives="data.drives"
          />
        </v-stepper-content>
        <v-stepper-content
          class="h-full overflow-auto overflow-x-hidden pt-2"
          step="4"
        >
          <SetupAccount
            v-model="data.instancePath"
          />
        </v-stepper-content>
      </v-stepper-items>
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
  </v-card>
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

<script lang=ts setup>
import { useService } from '@/composables'
import { injection } from '@/util/inject'
import { BaseServiceKey, Drive } from '@xmcl/runtime-api'
import SetupAppearance from './SetupAppearance.vue'
import SetDataRoot from './SetupDataRoot.vue'
import SetupFooter from './SetupFooter.vue'
import SetupAccount from './SetupAccount.vue'
import SetLocale from './SetupLocale.vue'
import { kSettingsState } from '@/composables/setting'
import { kTheme } from '@/composables/theme'

const emit = defineEmits(['ready'])
const { validateDataDictionary } = useService(BaseServiceKey)

const next = () => {
  data.step = Number(data.step) + 1
}
const prev = () => {
  data.step = Number(data.step) - 1
}

const { locale, t } = useI18n()
const currentTitle = computed(() => {
  if (data.step === 1) return t('setup.locale.name')
  if (data.step === 2) return t('setup.dataRoot.name')
  return t('setup.game.name')
})
const data = reactive({
  step: 1,
  fetching: true,
  minecraftPath: '',
  instancePath: '',
  path: '',
  pathError: '' as '' | 'noperm' | 'bad' | 'nondictionary' | 'exists',
  defaultPath: '',
  loading: false,
  drives: [] as Drive[],
  theme: 'system',
})
provide('setup', data)
bootstrap.preset().then(({ minecraftPath, defaultPath, locale: locale_, drives }) => {
  data.fetching = false
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
  data.pathError = ''
  validateDataDictionary(newPath).then((reason) => {
    data.loading = false
    if (!reason) {
      data.path = newPath
    } else {
      data.pathError = reason
    }
  })
})

const { darkTheme } = injection(kTheme)

const updateTheme = (theme: 'dark' | 'system' | 'light') => {
  darkTheme.value = theme
}

updateTheme(data.theme as any)

watch(() => data.theme, () => {
  updateTheme(data.theme as any)
})

const { state } = injection(kSettingsState)

async function setup() {
  await bootstrap.bootstrap(data.path)
  emit('ready', data)
  const dismiss = watch(state, (s) => {
    if (s) {
      s.localeSet(locale.value)
      dismiss()
    }
  }, { immediate: true })
  data.loading = true
}
</script>

<style>
.setup .v-list__tile__content {
  margin-left: 7px;
}
.setup .v-list__tile__title {
  overflow: auto;
  text-overflow: unset;
}

.setup .v-stepper__wrapper {
  @apply h-full flex flex-col overflow-auto;
}

</style>
