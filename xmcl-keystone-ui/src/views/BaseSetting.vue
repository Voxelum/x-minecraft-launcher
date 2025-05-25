<template>
  <div class="base-setting px-10 overflow-auto" @wheel.stop>
    <div>
      <BaseSettingGeneral class="" />
      <BaseSettingVersions :isExpanded="isExpanded" class=""  />
      <v-divider v-if="!isExpanded" />
    </div>
    <div>
      <BaseSettingJava class="" />
      <BaseSettingSync class="" />
      <BaseSettingLaunch class="" />
      <BaseSettingResolution class="" />
      <BaseSettingModpack class="" v-if="!isServer" />
      <BaseSettingServer class="" v-else />
    </div>

    <v-snackbar
      :color="snackbarColor"
      :class="{ 'shake-animation': hasAnimation }"
      :timeout="-1"
      :value="isModified"
    >
      <div class="text-button mr-4">
        {{ t('modified.unsaved') }}
      </div>

      <template #action="{ attrs }">
        <div
          class="mr-2 flex gap-1"
          v-bind="attrs"
        >
          <v-btn
            text
            @click="onReset"
          >
            {{ t('modified.reset') }}
          </v-btn>
          <v-btn
            color="primary"
            @click="edit.save"
          >
            {{ t('modified.save') }}
          </v-btn>
        </div>
      </template>
    </v-snackbar>
  </div>
</template>

<script lang=ts setup>
import { useAutoSaveLoad } from '@/composables'
import { useBeforeLeave } from '@/composables/beforeLeave'
import { kInstance } from '@/composables/instance'
import { kInstances } from '@/composables/instances'
import { usePresence } from '@/composables/presence'
import { useTutorial } from '@/composables/tutorial'
import { injection } from '@/util/inject'
import { InstanceEditInjectionKey, useInstanceEdit } from '../composables/instanceEdit'
import BaseSettingGeneral from './BaseSettingGeneral.vue'
import BaseSettingJava from './BaseSettingJava.vue'
import BaseSettingLaunch from './BaseSettingLaunch.vue'
import BaseSettingModpack from './BaseSettingModpack.vue'
import BaseSettingServer from './BaseSettingServer.vue'
import BaseSettingSync from './BaseSettingSync.vue'
import BaseSettingVersions from './BaseSettingVersions.vue'
import BaseSettingResolution from './BaseSettingResolution.vue'
import { useMediaQuery } from '@vueuse/core'
import { kCompact } from '@/composables/scrollTop'

const { isServer, name, instance } = injection(kInstance)
const { edit: _edit } = injection(kInstances)
const edit = useInstanceEdit(instance, _edit)
const { t } = useI18n()
provide(InstanceEditInjectionKey, edit)
useAutoSaveLoad(() => {}, edit.load)
const { isModified } = edit

function onReset() {
  edit.load()
}

const snackbarColor = ref('black')
const hasAnimation = ref(false)
useBeforeLeave(() => {
  if (isModified.value) {
    if (edit.data.path !== instance.value.path) {
      edit.load()
      return true
    }
    snackbarColor.value = 'error'
    hasAnimation.value = true
    setTimeout(() => {
      snackbarColor.value = 'black'
      hasAnimation.value = false
    }, 500)
    return false
  }
  return true
})

// Page compact
const compact = injection(kCompact)
onMounted(() => {
  compact.value = true
})

const isExpanded = useMediaQuery('(min-width: 1360px)')

usePresence(computed(() => t('presence.instanceSetting', { instance: name.value })))

useTutorial(computed(() => [{
  element: '#instance-icon',
  popover: { title: t('tutorial.instance.iconTitle'), description: t('tutorial.instance.iconDescription') },
}, {
  element: '#java-list',
  popover: { title: t('tutorial.instance.javaTitle'), description: t('tutorial.instance.javaDescription') },
}, {
  element: '#java-import',
  popover: { title: t('tutorial.instance.javaImportTitle'), description: t('tutorial.instance.javaImportDescription') },
}]))

</script>

<style>
.local-version .v-select__selection--comma {
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.base-setting {
  background: transparent !important;
}

/* only if width > 1360px */
@media (min-width: 1360px) {
  .base-setting {
    display: grid;
    /* grid-template-columns: 1fr 1fr; */
    grid-template-columns: calc(50% - 16px) calc(50% - 16px);

    grid-gap: 32px;
  }
}


.base-setting .v-list-item {
  @apply rounded-xl;
}

.base-setting .v-list-item:before {
  @apply rounded-xl;
}

.base-setting .v-list-item:hover:before {
  @apply rounded-xl;
}

.base-setting .v-text-field--box input,
.v-text-field--full-width input,
.v-text-field--outlined input {
  margin-top: 0
}

.v-snack__wrapper {
  transition-property: all !important;
  transition-delay: 0ms;
  transition-duration: 0.3s;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes shake {
  0% { transform: translate(0, 0); }
  10% { transform: translate(-10px, 0); }
  20% { transform: translate(10px, 0); }
  30% { transform: translate(-10px, 0); }
  40% { transform: translate(10px, 0); }
  50% { transform: translate(-10px, 0); }
  60% { transform: translate(10px, 0); }
  70% { transform: translate(-10px, 0); }
  80% { transform: translate(10px, 0); }
  90% { transform: translate(-10px, 0); }
  100% { transform: translate(0, 0); }
}

.shake-animation {
  animation-name: shake;
  animation-duration: .5s;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
</style>
