<template>
  <v-app class="relative h-full max-h-[100vh] overflow-auto">
    <v-card class="flex h-full flex-col overflow-auto">
      <v-toolbar class="moveable w-full" flat>
        <v-toolbar-title>{{ t('title') }}</v-toolbar-title>
        <v-spacer />
        <v-btn icon class="non-moveable" @click="hide">
          <v-icon>
            close
          </v-icon>
        </v-btn>
      </v-toolbar>
      <div v-if="progressRef" class="px-2 h-full flex-grow overflow-auto flex flex-col items-center justify-center">
        <!-- <div class="flex items-center justify-center"> -->
        <v-card-title>
          {{ progressRef.from }}
        </v-card-title>
        <!-- </div> -->
        <v-progress-linear :value="progressRef.progress" :total="progressRef.total"
          :indeterminate="progressRef.progress === 0" :height="10" class="rounded-none" />
        <v-card-title>
          {{ progressRef.to }}
        </v-card-title>
        <v-progress-circular class="mt-13" :size="40" indeterminate />
      </div>
    </v-card>
  </v-app>
</template>

<script lang=ts setup>
import { Migration } from '@xmcl/runtime-api'
import '@/assets/common.css'

const { t } = useI18n()
const { hide, close } = windowController

declare const migration: Migration

const errorRef = ref<any | null>(null)
const progressRef = shallowRef(undefined as undefined | {
  from: string
  to: string
  progress: number
  total: number
})
onMounted(() => {
  migration.getProgress().then((progress) => {
    progressRef.value = progress
  })
  migration.on('progress', ({ from, to, progress, total }) => {
    progressRef.value = { from, to, progress, total }
  })
  migration.on('error', ({ error }) => {
    errorRef.value = error
  })
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

.fade-enter,
.fade-leave-to

/* .fade-leave-active below version 2.1.8 */
  {
  opacity: 0;
}

.v-list__tile__content {
  margin-left: 7px;
}

.v-list__tile__title {
  overflow-x: auto;
  text-overflow: unset;
}
</style>
