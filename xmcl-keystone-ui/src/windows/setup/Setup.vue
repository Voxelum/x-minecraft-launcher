<template>
  <v-app
    dark
    class="moveable rounded-lg"
    fill-height
  >
    <!-- <v-container> -->
    <v-card
      v-if="!fetching"
      style="height: 100%; display: flex; flex-direction: column;"
      class="rounded-lg"
    >
      <v-card-title
        style="background-color: black"
        class="elevation-3 text-lg font-bold"
      >
        <h2>{{ $t('title') }}</h2>
      </v-card-title>
      <v-divider />
      <v-list
        class="non-moveable"
        three-line
        subheader
        style="background: transparent; width: 100%"
      >
        <v-list-tile>
          <v-list-tile-content>
            <v-list-tile-title>{{ $t('defaultPath') }}</v-list-tile-title>
            <v-list-tile-sub-title>{{ defaultPath }}</v-list-tile-sub-title>
          </v-list-tile-content>
        </v-list-tile>
        <v-list-tile>
          <v-list-tile-content>
            <v-list-tile-title>{{ $t('path') }}</v-list-tile-title>
            <v-list-tile-sub-title>{{ path }}</v-list-tile-sub-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-btn
              outline
              flat
              style="margin-right: 10px;"
              @click="browse"
            >
              {{ $t('browse') }}
            </v-btn>
          </v-list-tile-action>
        </v-list-tile>
        <v-list-tile
          v-for="d of drives"
          :key="d.mounted"
          v-ripple
          class="hover:bg-[rgba(123,123,123,0.5)] cursor-pointer rounded-lg m-2 mx-3"
          @click="onSelect(d)"
        >
          <v-list-tile-avatar>
            <v-icon>storage</v-icon>
          </v-list-tile-avatar>

          <v-list-tile-content>
            <v-list-tile-title class="flex p-0 flex-grow-0 align-baseline">
              {{ d.mounted }}
              <div class="flex-grow" />

              <span
                class="text-[hsla(0,0%,100%,.7)] whitespace-normal"
                style="font-size: 14px;"
              >
                {{ d.selectedPath }}
              </span>
            </v-list-tile-title>
            <v-progress-linear
              class="p-0 my-2"
              :value="d.used / (d.available + d.used) * 100"
            />
            <v-list-tile-sub-title>
              <span class="">
                {{ $t('disk.available') }}:
                {{ (d.available / 1024 / 1024 / 1024).toFixed(2) }}G
                {{ $t('disk.used') }}:
                {{ (d.used / 1024 / 1024 / 1024).toFixed(2) }}G
              </span>
              <div class="flex-grow" />
              <span>
                {{ d.capacity }}
              </span>
            </v-list-tile-sub-title>
          </v-list-tile-content>
        </v-list-tile>
      </v-list>
      <div style="flex-grow: 1" />
      <v-card-actions
        class="non-moveable"
        style="justify-content: center; display: flex;"
      >
        <v-btn
          large
          block
          flat
          color="green"
          :loading="loading"
          @click="setup"
        >
          {{ $t('confirm') }}
        </v-btn>
      </v-card-actions>
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
    <!-- </v-container> -->
  </v-app>
</template>

<script lang=ts>
import { defineComponent, reactive, toRefs, inject } from '@vue/composition-api'
import { useI18n } from '/@/hooks'
import { I18N_KEY } from '/@/constant'
import { SetupAPI, Drive } from '@xmcl/runtime-api/setup'

declare const api: SetupAPI

export default defineComponent({
  setup() {
    const i18n = inject(I18N_KEY)
    const { $t } = useI18n()
    const dialog = windowController
    const data = reactive({
      fetching: true,
      minecraftPath: '',
      path: '',
      defaultPath: '',
      loading: false,
      drives: [] as Drive[],
    })
    api.preset().then(({ minecraftPath, defaultPath, locale, drives }) => {
      data.fetching = false
      i18n!.locale = locale
      data.minecraftPath = minecraftPath
      data.path = defaultPath
      data.defaultPath = defaultPath
      data.drives = drives
    })
    function setup() {
      api.setup(data.path)
      data.loading = true
    }
    function onSelect(drive: Drive) {
      data.path = drive.selectedPath
    }
    async function browse() {
      const { filePaths } = await dialog.showOpenDialog({
        title: $t('browse'),
        defaultPath: data.path,
        properties: ['openDirectory', 'createDirectory'],
      })
      if (filePaths && filePaths.length !== 0) {
        data.path = filePaths[0]
      }
    }
    return {
      ...toRefs(data),
      setup,
      browse,
      onSelect,
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
</style>
