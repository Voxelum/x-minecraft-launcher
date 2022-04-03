<template>
  <v-app
    class="moveable rounded-lg overflow-auto h-full"
  >
    <v-card
      v-if="!fetching"
      class="rounded-lg flex flex-col overflow-auto h-full"
    >
      <v-card-title
        class="elevation-3 text-lg font-bold"
      >
        <h2>{{ $t('title') }}{{ currentTitle }}</h2>
      </v-card-title>
      <v-divider />
      <v-stepper
        v-model="step"
        class="non-moveable flex flex-col overflow-auto h-full"
      >
        <v-stepper-header>
          <v-stepper-step
            :complete="step > 1"
            :editable="step > 1"
            step="1"
          >
            {{ $t('step.locale.name') }}
          </v-stepper-step>

          <v-divider />

          <v-stepper-step
            :complete="step > 2"
            :editable="step > 2"
            step="2"
          >
            {{ $t('step.dataRoot.name') }}
          </v-stepper-step>

          <v-divider />

          <v-stepper-step step="3">
            {{ $t('step.game.name') }}
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
                :disabled="loading"
                @click="step = 2"
              >
                {{ $t('next') }}
              </v-btn>
            </div>
          </v-stepper-content>
          <v-stepper-content
            class="h-full overflow-auto"
            step="2"
          >
            <SetDataRoot
              v-model="path"
              :default-path="defaultPath"
              :drives="drives"
            />

            <div class="flex mt-5">
              <v-btn
                text
                :disabled="loading"
                @click="step -= 1"
              >
                {{ $t('previous') }}
              </v-btn>
              <div class="flex-grow" />
              <v-btn
                color="primary"
                :disabled="loading"
                @click="step = 3"
              >
                {{ $t('next') }}
              </v-btn>
            </div>
          </v-stepper-content>
          <v-stepper-content
            class="h-full overflow-auto"
            step="3"
          >
            <SelectGame
              v-model="instancePath"
              :default-path="minecraftPath"
            />

            <div class="flex-grow" />
            <div class="flex flex-grow-0 mt-5 ">
              <v-btn
                text
                :disabled="loading"
                @click="step -= 1"
              >
                {{ $t('previous') }}
              </v-btn>
              <div class="flex-grow" />
              <v-btn
                color="primary"
                :loading="loading"
                @click="setup"
              >
                {{ $t('confirm') }}
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
  </v-app>
</template>

<script lang=ts>
import { defineComponent, reactive, toRefs, inject, computed } from '@vue/composition-api'
import { I18N_KEY, useI18n } from '/@/composables'
import { SetupAPI, Drive } from '@xmcl/runtime-api/setup'
import SetDataRoot from './SetDataRoot.vue'
import SetLocale from './SetLocale.vue'
import SelectGame from './SelectGame.vue'

declare const api: SetupAPI

export default defineComponent({
  components: { SetDataRoot, SetLocale, SelectGame },
  setup() {
    const i18n = inject(I18N_KEY)
    const { $t } = useI18n()
    const locale = computed({
      get() { return i18n!.locale },
      set(v: string) { i18n!.locale = v },
    })
    const currentTitle = computed(() => {
      if (data.step === 1) return $t('step.locale.name')
      if (data.step === 2) return $t('step.dataRoot.name')
      return $t('step.game.name')
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
    api.preset().then(({ minecraftPath, defaultPath, locale, drives }) => {
      data.fetching = false
      i18n!.locale = locale
      data.minecraftPath = minecraftPath
      data.instancePath = minecraftPath
      data.path = defaultPath
      data.defaultPath = defaultPath
      data.drives = drives
    })
    function setup() {
      api.setup(data.path, data.instancePath, locale.value)
      data.loading = true
    }
    return {
      ...toRefs(data),
      locale,
      currentTitle,
      setup,
    }
  },
})
</script>

<style>
.moveable {
  -webkit-app-region: drag;
  user-select: none;
}

.non-moveable {
  -webkit-app-region: no-drag;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.01s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
.v-list__tile__content {
  margin-left: 7px;
}
.v-list__tile__title {
  overflow: auto;
  text-overflow: unset;
}
::-webkit-scrollbar {
  display: none;
}

body {
  height: 100%;
}
.moveable {
  -webkit-app-region: drag;
  user-select: none;
}

.non-moveable {
  -webkit-app-region: no-drag;
}
.v-stepper__wrapper {
  @apply h-full flex flex-col overflow-auto absolute left-0 top-0 p-10;
}
</style>
