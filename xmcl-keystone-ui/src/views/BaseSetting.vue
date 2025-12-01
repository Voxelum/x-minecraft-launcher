<template>
  <div class="base-setting px-10 overflow-auto" ref="root" @wheel.stop>
    <template v-if="!targetQuery || targetQuery === 'general'">
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
      </div>
    </template>
    <template v-else-if="targetQuery === 'modpack'">
      <BaseSettingModpack />
      <BaseSettingModpackFiles />
    </template>
    <template v-else-if="targetQuery === 'advanced'">
      <BaseSettingAdvanced />
    </template>
    <template v-else-if="targetQuery === 'appearance'">
      <BaseSettingAppearance />
    </template>
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
            @click="onSave"
          >
            {{ t('modified.save') }}
          </v-btn>
        </div>
      </template>
    </v-snackbar>
    <BaseSettingModUpgradeDialog
      @upgrade="onUpgradeMods"
      @skip="onSkipUpgrade"
    />
  </div>
</template>

<script lang=ts setup>
import { useAutoSaveLoad } from '@/composables'
import { useBeforeLeave } from '@/composables/beforeLeave'
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kInstances } from '@/composables/instances'
import { kModUpgrade } from '@/composables/modUpgrade'
import { usePresence } from '@/composables/presence'
import { useTutorial } from '@/composables/tutorial'
import { injection } from '@/util/inject'
import { InstanceEditInjectionKey, useInstanceEdit } from '../composables/instanceEdit'
import BaseSettingGeneral from './BaseSettingGeneral.vue'
import BaseSettingJava from './BaseSettingJava.vue'
import BaseSettingLaunch from './BaseSettingLaunch.vue'
import BaseSettingSync from './BaseSettingSync.vue'
import BaseSettingVersions from './BaseSettingVersions.vue'
import BaseSettingResolution from './BaseSettingResolution.vue'
import { templateRef, useMediaQuery } from '@vueuse/core'
import { kCompact } from '@/composables/scrollTop'
import { useQuery } from '@/composables/query'
import BaseSettingModpack from './BaseSettingModpack.vue'
import BaseSettingAdvanced from './BaseSettingAdvanced.vue'
import { useInstanceModpackMetadata } from '@/composables/instanceModpackMetadata'
import BaseSettingModpackFiles from './BaseSettingModpackFiles.vue'
import BaseSettingAppearance from './BaseSettingAppearance.vue'
import BaseSettingModUpgradeDialog from './BaseSettingModUpgradeDialog.vue'
import { BaseSettingModUpgradeDialogKey } from '@/composables/instanceUpdate'

const { isServer, name, instance, runtime } = injection(kInstance)
const { edit: _edit } = injection(kInstances)
const edit = useInstanceEdit(instance, _edit)
const { t } = useI18n()
provide(InstanceEditInjectionKey, edit)
useAutoSaveLoad(() => {}, edit.load)
const { isModified } = edit
const root = ref<HTMLElement | null>(null)
provide('root', root)
provide('modpackMetadata', useInstanceModpackMetadata())

// Mod upgrade feature
const { mods } = injection(kInstanceModsContext)
const { refresh: checkUpgrade, upgrade, upgradePolicy, skipVersion } = injection(kModUpgrade)
const { show: showModUpgradeDialog } = useDialog(BaseSettingModUpgradeDialogKey)

// Check if the instance is modded (has a mod loader)
const isModdedInstance = computed(() => {
  const r = runtime.value
  return !!(r.forge || r.fabricLoader || r.quiltLoader || r.neoForged)
})

// Check if Minecraft version changed
const isMinecraftVersionChanged = computed(() => {
  return instance.value.runtime.minecraft !== edit.data.runtime.minecraft
})

async function onSave() {
  // If Minecraft version changed and instance is modded with mods installed, show upgrade dialog
  if (isMinecraftVersionChanged.value && isModdedInstance.value && mods.value.length > 0) {
    showModUpgradeDialog({ minecraftVersion: edit.data.runtime.minecraft })
  } else {
    await edit.save()
  }
}

async function onUpgradeMods() {
  await edit.save()
  // Trigger mod upgrade check with current runtime
  const policy = upgradePolicy.value as 'modrinth' | 'curseforge' | 'modrinthOnly' | 'curseforgeOnly'
  await checkUpgrade({ skipVersion: skipVersion.value, policy })
  upgrade()
}

async function onSkipUpgrade() {
  await edit.save()
}

const targetQuery = useQuery('target')

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
