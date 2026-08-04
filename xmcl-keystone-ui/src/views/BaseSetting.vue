<template>
  <div
    ref="root"
    data-testid="base-setting-page"
    class="base-setting relative h-full overflow-hidden"
    @wheel.stop
  >
    <div class="base-setting-layout">
      <nav
        data-testid="base-setting-navigation"
        class="base-setting-sidebar"
        :aria-label="t('baseSetting.title', 2)"
      >
        <div class="base-setting-sidebar__heading">
          <span class="base-setting-sidebar__eyebrow">{{ t('baseSetting.title') }}</span>
          <strong>{{ name }}</strong>
        </div>
        <v-list
          nav
          density="comfortable"
          color="transparent"
          class="base-setting-sidebar__list bg-transparent"
          :selected="[activeSection]"
          @update:selected="v => navigate((v[0] as string) ?? '')"
        >
          <v-list-item
            v-for="section in sections"
            :key="section.value"
            :value="section.value"
            class="base-setting-nav-item"
            color="primary"
            :title="section.title"
            :data-testid="section.value === 'server' ? 'base-setting-server-tab' : undefined"
            @click="navigate(section.value)"
          >
            <template #prepend>
              <span class="base-setting-nav-indicator" aria-hidden="true" />
              <v-icon size="20">{{ section.icon }}</v-icon>
            </template>
          </v-list-item>
        </v-list>
        <div class="base-setting-sidebar__meta">
          <v-icon size="16">deployed_code</v-icon>
          <span>Minecraft {{ runtime.minecraft }}</span>
        </div>
      </nav>

      <main class="base-setting-main">
        <v-tabs
          class="base-setting-tabs"
          :model-value="activeSection"
          color="primary"
          show-arrows
          @update:model-value="value => navigate(value as string)"
        >
          <v-tab
            v-for="section in sections"
            :key="section.value"
            :value="section.value"
          >
            <v-icon start size="18">{{ section.icon }}</v-icon>
            {{ section.title }}
          </v-tab>
        </v-tabs>

        <div class="base-setting-scroll">
          <div class="base-setting-content">
          <template v-if="!targetQuery || targetQuery === 'general'">
            <template v-if="isBedrock">
              <BaseSettingGeneral />
              <BaseSettingBedrockVersions />
            </template>
            <template v-else>
              <BaseSettingGeneral />
              <BaseSettingVersions />
              <BaseSettingJava />
              <BaseSettingSync />
              <BaseSettingLaunch />
              <BaseSettingServer />
            </template>
          </template>
          <template v-else-if="targetQuery === 'modpack'">
            <BaseSettingModpack />
            <BaseSettingModpackFiles />
          </template>
          <template v-else-if="targetQuery === 'modrinth-project'">
            <BaseSettingModrinthProject />
          </template>
          <template v-else-if="targetQuery === 'advanced'">
            <BaseSettingAdvanced />
          </template>
          <template v-else-if="targetQuery === 'appearance'">
            <BaseSettingAppearance />
          </template>
          <template v-else-if="targetQuery === 'server' && !isBedrock">
            <BaseSettingServerManage />
          </template>
          </div>
        </div>
      </main>
    </div>

    <v-snackbar
      :model-value="isModified"
      :color="snackbarColor"
      :class="{ 'shake-animation': hasAnimation }"
      :timeout="-1"
      @update:model-value="() => {}"
    >
      <div class="text-button mr-4">
        {{ t('modified.unsaved') }}
      </div>

      <template #actions>
        <v-btn
          variant="text"
          @click.stop="onReset"
        >
          {{ t('modified.reset') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          @click.stop="onSave"
        >
          {{ t('modified.save') }}
        </v-btn>
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
import { vibrateGamepad } from '@/composables/gamepad'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kInstances } from '@/composables/instances'
import { kModUpgrade } from '@/composables/modUpgrade'
import { usePresence } from '@/composables/presence'
import { useTutorial } from '@/composables/tutorial'
import { injection } from '@/util/inject'
import { useService } from '@/composables'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'
import { InstanceEditInjectionKey, useInstanceEdit } from '../composables/instanceEdit'
import BaseSettingGeneral from './BaseSettingGeneral.vue'
import BaseSettingBedrockVersions from './BaseSettingBedrockVersions.vue'
import BaseSettingJava from './BaseSettingJava.vue'
import BaseSettingLaunch from './BaseSettingLaunch.vue'
import BaseSettingSync from './BaseSettingSync.vue'
import BaseSettingVersions from './BaseSettingVersions.vue'
import { templateRef } from '@vueuse/core'
import { kCompact } from '@/composables/scrollTop'
import { useQuery } from '@/composables/query'
import BaseSettingModpack from './BaseSettingModpack.vue'
import BaseSettingServer from './BaseSettingServer.vue'
import BaseSettingServerManage from './BaseSettingServerManage.vue'
import BaseSettingAdvanced from './BaseSettingAdvanced.vue'
import { useInstanceModpackMetadata } from '@/composables/instanceModpackMetadata'
import BaseSettingModpackFiles from './BaseSettingModpackFiles.vue'
import BaseSettingAppearance from './BaseSettingAppearance.vue'
import BaseSettingModUpgradeDialog from './BaseSettingModUpgradeDialog.vue'
import BaseSettingModrinthProject from './BaseSettingModrinthProject.vue'
import { BaseSettingModUpgradeDialogKey } from '@/composables/instanceUpdate'
import { useLatestBoundModrinthProject } from '@/composables/modrinthProjectBinding'

const { isServer, name, instance, runtime } = injection(kInstance)
const isBedrock = computed(() => instance.value.edition === 'bedrock')
const { edit: _edit } = injection(kInstances)
const edit = useInstanceEdit(instance, _edit)
const { t } = useI18n()
const { disable: disableMods } = useService(InstanceModsServiceKey)
provide(InstanceEditInjectionKey, edit)
useAutoSaveLoad(() => {}, edit.load)
const { isModified } = edit
const root = ref<HTMLElement | null>(null)
provide('root', root)
const modpackMetadataContext = useInstanceModpackMetadata()
provide('modpackMetadata', modpackMetadataContext)

// Mod upgrade feature
const { mods } = injection(kInstanceModsContext)
const { refresh: checkUpgrade, upgrade, upgradePolicy, skipVersion, getModsWithoutUpgrade } = injection(kModUpgrade)
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
  // Disable mods that don't have an available update for the new version
  const modsToDisable = getModsWithoutUpgrade()
  if (modsToDisable.length > 0) {
    disableMods({ path: instance.value.path, files: modsToDisable })
  }
  upgrade()
}

async function onSkipUpgrade() {
  await edit.save()
}

const targetQuery = useQuery('target')
const latestBoundModrinthProject = useLatestBoundModrinthProject()
const boundModrinthProjectId = computed(() => modpackMetadataContext.modpackMetadata.modrinth.projectId || latestBoundModrinthProject.value?.id || '')
const sections = computed(() => [
  { value: '', title: t('BaseSettingGeneral.title'), icon: 'settings_heart' },
  ...(!isBedrock.value ? [
    { value: 'modpack', title: t('modpack.name', 1), icon: 'folder_zip' },
    ...(boundModrinthProjectId.value || targetQuery.value === 'modrinth-project' ? [
      { value: 'modrinth-project', title: 'Modrinth', icon: 'xmcl:modrinth' },
    ] : []),
    { value: 'server', title: t('server.launch'), icon: 'dns' },
  ] : []),
  { value: 'appearance', title: t('setting.appearance'), icon: 'invert_colors' },
])
const activeSection = computed(() => targetQuery.value === 'general' ? '' : targetQuery.value || '')
const router = useRouter()
function navigate(target: string) {
  if (router.currentRoute.value.query.target === target) {
    return
  }
  if (target === '') {
    router.replace({ query: {} })
  } else {
    router.replace({ query: { target } })
  }
}

watch([isBedrock, targetQuery], ([bedrock, target]) => {
  if (target === 'remote-server') {
    targetQuery.value = 'server'
  } else if (bedrock && (target === 'modpack' || target === 'server')) {
    targetQuery.value = 'general'
  }
}, { immediate: true })

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
    vibrateGamepad()
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

.base-setting-layout {
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  gap: 24px;
  height: 100%;
  padding: 0px 0 0 28px;
}

.base-setting-sidebar {
  align-self: start;
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 10px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.78);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(18px) saturate(1.15);
}

.base-setting-sidebar__heading {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px 12px;
}

.base-setting-sidebar__heading strong {
  overflow: hidden;
  font-size: 16px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-setting-sidebar__eyebrow {
  color: rgba(var(--v-theme-on-surface), 0.58);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.base-setting-sidebar__list {
  padding: 4px 0 !important;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.base-setting-nav-item {
  min-height: 42px !important;
  margin: 3px 0;
  border-radius: 6px !important;
}

.base-setting-nav-indicator {
  position: absolute;
  top: 50%;
  left: 0;
  z-index: 2;
  width: 3px;
  height: 22px;
  border-radius: 0 3px 3px 0;
  background: rgb(var(--v-theme-primary));
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%) scaleY(0.4);
  transform-origin: center;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.base-setting-nav-item.v-list-item--active .base-setting-nav-indicator {
  opacity: 1;
  transform: translateY(-50%) scaleY(1);
}

.base-setting-sidebar__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 8px;
  color: rgba(var(--v-theme-on-surface), 0.56);
  font-size: 12px;
}

.base-setting-main {
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.base-setting-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 0 20px 32px 0;
}

.base-setting-tabs {
  display: none;
}

.base-setting-content {
  width: min(100%, 1080px);
  margin: 0 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

@media (max-width: 900px) {
  .base-setting-layout {
    display: block;
    padding: 0;
  }

  .base-setting-sidebar {
    display: none;
  }

  .base-setting-main {
    display: flex;
    flex-direction: column;
  }

  .base-setting-tabs {
    display: flex;
    flex: 0 0 auto;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
    background: rgba(var(--v-theme-surface), 0.82);
    backdrop-filter: blur(16px);
  }

  .base-setting-scroll {
    height: auto;
    flex: 1 1 auto;
    padding: 20px 18px 28px;
  }
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
