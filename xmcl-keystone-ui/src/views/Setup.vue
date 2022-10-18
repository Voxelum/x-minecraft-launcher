<template>
  <v-card
    v-if="!data.fetching"
    class="flex flex-col overflow-auto setup"
  >
    <v-card-title
      class="elevation-3 text-lg font-bold"
    >
      <h2>{{ t('setup.title') }}{{ currentTitle }}</h2>
    </v-card-title>
    <v-divider />
    <v-stepper
      v-model="data.step"
      class="non-moveable flex flex-col overflow-auto h-full"
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
          {{ t('setup.dataRoot.name') }}
        </v-stepper-step>

        <v-divider />

        <v-stepper-step step="3">
          {{ t('setup.game.name') }}
        </v-stepper-step>
      </v-stepper-header>

      <v-stepper-items class="h-full overflow-auto">
        <v-stepper-content
          class="h-full overflow-auto"
          step="1"
        >
          <SetLocale
            v-model="locale"
          />
          <div class="flex-grow" />
          <div class="flex flex-1 flex-grow-0 mt-5">
            <div class="flex-grow" />
            <v-btn
              color="primary"
              :disabled="data.loading"
              @click="data.step = 2"
            >
              {{ t('next') }}
            </v-btn>
          </div>
        </v-stepper-content>
        <v-stepper-content
          class="h-full overflow-auto"
          step="2"
        >
          <SetDataRoot
            v-model="data.path"
            class="h-full overflow-auto"
            :default-path="data.defaultPath"
            :drives="data.drives"
          />

          <div class="flex mt-5">
            <v-btn
              text
              :disabled="data.loading"
              @click="data.step -= 1"
            >
              {{ t('previous') }}
            </v-btn>
            <div class="flex-grow" />
            <v-btn
              color="primary"
              :disabled="data.loading"
              @click="data.step = 3"
            >
              {{ t('next') }}
            </v-btn>
          </div>
        </v-stepper-content>
        <v-stepper-content
          class="h-full overflow-auto"
          step="3"
        >
          <SelectGame
            v-model="data.instancePath"
            :default-path="data.minecraftPath"
          />

          <div class="flex-grow" />
          <div class="flex flex-grow-0 mt-5 ">
            <v-btn
              text
              :disabled="data.loading"
              @click="data.step -= 1"
            >
              {{ t('previous') }}
            </v-btn>
            <div class="flex-grow" />
            <v-btn
              color="primary"
              :loading="data.loading"
              @click="setup"
            >
              {{ t('confirm') }}
            </v-btn>
          </div>
        </v-stepper-content>
      </v-stepper-items>
    </v-stepper>
  </v-card>
  <v-card
    v-else
    style="height: 100%"
  >
    <v-container fill-height>
      <v-layout
        align-center
        justify-center
        row
        fill-height
      >
        <v-flex
          shrink
          style="text-align:center; user-select: none;"
        >
          <v-progress-circular
            :size="100"
            color="white"
            indeterminate
          />
        </v-flex>
      </v-layout>
    </v-container>
  </v-card>
</template>

<script lang=ts setup>
import SetDataRoot from './SetupDataRoot.vue'
import { Drive } from '@xmcl/runtime-api'
import SetLocale from './SetupLocale.vue'
import SelectGame from './SetupInstance.vue'
import { useBootstrap } from '@/composables/bootstrap'

const emit = defineEmits(['ready'])

const { locale, t } = useI18n()
const bootstrap = useBootstrap()
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
  defaultPath: '',
  loading: false,
  drives: [] as Drive[],
})
bootstrap.preset().then(({ minecraftPath, defaultPath, locale: locale_, drives }) => {
  data.fetching = false
  locale.value = locale_
  data.minecraftPath = minecraftPath
  data.instancePath = minecraftPath
  data.path = defaultPath
  data.defaultPath = defaultPath
  data.drives = drives
})
async function setup() {
  await bootstrap.bootstrap(data.path, data.instancePath, locale.value)
  emit('ready')
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
