<template>
  <div
    class="flex flex-1 flex-grow-0 flex-row items-center justify-start"
    :class="{
      'min-h-[52px] mb-3': !compact,
      'min-h-[40px] mb-1': compact && !collapseExtension,
      'min-h-0 mb-0': collapseExtension,
    }"
  >
    <div
      v-if="!isNarrow"
      class="flex flex-grow-0 flex-row items-center justify-center gap-1 home-metadata-box"
    >
      <Transition name="fade-transition" mode="out-in">
        <AvatarItemList
          :key="activeTab"
          :items="contextItems"
        />
      </Transition>
    </div>
    <div class="flex-grow mr-2" />
    <transition name="fade-transition" mode="out-in">
      <div
        key="launch-button-group"
        class="flex items-center justify-end overflow-visible"
        v-if="!targetQuery"
      >
        <HomeLaunchButtonStatus v-if="!isNarrow" :active="active" />
        <HomeLaunchButton
          class="ml-4"
          :compact="compact"
          @mouseenter="active = true"
          @mouseleave="active = false"
        />
      </div>
      <div
        v-else-if="targetQuery === 'modpack'"
        class="flex items-center justify-end overflow-hidden"
      >
        <v-btn
          rounded="pill"
          color="primary"
          :loading="exporting || loading"
          @click="exportModpack"
          size="large"
        >
          <span
            v-if="isGamepadActive"
            class="gp-btn__key gp-btn__key--primary mr-2"
            style="transform: scale(0.85); vertical-align: middle;"
          >{{ buttonX }}</span>
          <v-icon v-else start> build </v-icon>
          {{ t('modpack.export') }}
        </v-btn>
      </div>
      <div
        v-else-if="targetQuery === 'server' && !isBedrock"
        class="flex items-center justify-end gap-2 overflow-hidden"
      >
        <v-btn
          :color="serverLaunch.running.value ? 'error' : 'primary'"
          rounded="pill"
          :variant="serverLaunch.running.value ? 'tonal' : 'flat'"
          size="large"
          :prepend-icon="isGamepadActive ? undefined : (serverLaunch.running.value ? 'stop' : 'play_arrow')"
          data-testid="server-tab-launch"
          :loading="serverLaunch.loading.value"
          :disabled="serverLaunch.target.value === 'remote' && !serverLaunch.canLaunch.value"
          @click="serverLaunch.running.value ? serverLaunch.killServer() : serverLaunch.launchServer()"
        >
          <span
            v-if="isGamepadActive"
            class="gp-btn__key gp-btn__key--primary mr-2"
            style="transform: scale(0.85); vertical-align: middle;"
          >{{ buttonX }}</span>
          {{ serverLaunch.running.value ? t('server.stop') : t('server.launch') }}
        </v-btn>
      </div>
      <div
        v-else-if="targetQuery === 'modrinth-project'"
        class="flex items-center justify-end overflow-hidden"
      >
        <v-btn
          color="primary"
          rounded="pill"
          variant="flat"
          size="large"
          prepend-icon="save"
          data-testid="modrinth-project-page-save"
          :disabled="!projectEditorAction.state.available || !projectEditorAction.state.dirty"
          :loading="projectEditorAction.state.saving"
          @click="projectEditorAction.requestSave"
        >
          {{ t('modified.save') }}
        </v-btn>
      </div>
    </transition>
  </div>
</template>

<script lang="ts" setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import type { AvatarItemProps } from '@/components/AvatarItem.vue'
import { useExtensionItemsGamePlay, useExtensionItemsVersion } from '@/composables/extensionItems'
import { kInstance } from '@/composables/instance'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kInstanceTheme } from '@/composables/instanceTheme'
import { kCompact } from '@/composables/scrollTop'
import { injection } from '@/util/inject'
import HomeLaunchButton from './HomeLaunchButton.vue'
import HomeLaunchButtonStatus from './HomeLaunchButtonStatus.vue'
import { useQuery } from '@/composables/query'
import { kModpackExport } from '@/composables/modpack'
import { kInstanceServerLaunch } from '@/composables/instanceServerLaunch'
import { useGamepadInnerNav } from '@/composables/gamepad'
import { useGamepad } from '@/composables/gamepad'
import { useMediaQuery } from '@vueuse/core'
import { useInstanceModpackMetadata } from '@/composables/instanceModpackMetadata'
import { useModrinthProjectEditorAction } from '@/composables/modrinthProjectEditor'
import { useLatestBoundModrinthProject } from '@/composables/modrinthProjectBinding'
import { basename } from '@/util/basename'

import { isBedrockInstance } from '@xmcl/instance'

const { instance, runtime: version } = injection(kInstance)
const { versionHeader } = injection(kInstanceVersion)
const isBedrock = computed(() => isBedrockInstance(instance.value))

const active = ref(false)
const { t } = useI18n()
const compact = injection(kCompact)

// Below this width the expanded active-tab label would push the whole toolbar
// (tabs + action button) past the container and overflow. Collapse every tab
// to icon-only there; the shared tooltips keep them discoverable.
const isNarrow = useMediaQuery('(max-width: 900px)')

const versionItems = useExtensionItemsVersion(instance, versionHeader)
const gameplayItems = useExtensionItemsGamePlay(instance)

const targetQuery = useQuery('target')
const activeTab = computed<BaseSettingTab>(() => {
  const target = targetQuery.value
  return target === 'general' ? '' : (target || '') as BaseSettingTab
})
const collapseExtension = computed(() => isNarrow.value && targetQuery.value === 'appearance')

const { exportModpack, exporting, loading } = injection(kModpackExport)
const serverLaunch = injection(kInstanceServerLaunch)
const { isActive: isGamepadActive, buttonX } = useGamepad()
const projectEditorAction = useModrinthProjectEditorAction()
const { instanceTheme, customCss } = injection(kInstanceTheme)

type BaseSettingTab = '' | 'modpack' | 'modrinth-project' | 'server' | 'appearance'
const router = useRouter()
function navigate(target: BaseSettingTab) {
  if (router.currentRoute.value.query.target === target) {
    return
  }
  if (target === '') {
    router.replace({ query: {} })
  } else {
    router.replace({ query: { target } })
  }
}

// Gamepad triggers (L2/R2) cycle through the base-setting tabs.
const { modpackMetadata } = inject('modpackMetadata', useInstanceModpackMetadata, true)
const latestBoundProject = useLatestBoundModrinthProject()
const contextItems = computed<AvatarItemProps[]>(() => {
  if (activeTab.value === 'modpack') {
    const formats = [
      modpackMetadata.emitModrinth && 'Modrinth',
      modpackMetadata.emitCurseforge && 'CurseForge',
    ].filter(Boolean).join(' + ')
    return [{
      icon: 'sell',
      title: t('modpack.modpackVersion'),
      text: modpackMetadata.modpackVersion,
    }, {
      icon: 'person',
      title: t('shared.author'),
      text: instance.value.author || t('baseSetting.info.notSet'),
    }, {
      icon: 'ios_share',
      title: t('baseSetting.info.exportFormats'),
      text: formats || t('baseSetting.info.notSet'),
    }]
  }
  if (activeTab.value === 'modrinth-project') {
    const profileKey = `modpack.publishProfile${modpackMetadata.modrinth.profile[0].toUpperCase()}${modpackMetadata.modrinth.profile.slice(1)}`
    return [{
      icon: 'fingerprint',
      title: t('baseSetting.info.projectId'),
      text: modpackMetadata.modrinth.projectId || latestBoundProject.value?.id || t('baseSetting.info.notSet'),
    }, {
      icon: 'deployed_code',
      title: t('modpack.publishProfile'),
      text: t(profileKey),
    }, {
      icon: projectEditorAction.state.dirty ? 'edit' : 'check_circle',
      title: t('baseSetting.info.changes'),
      text: projectEditorAction.state.dirty ? t('modified.unsaved') : t('baseSetting.info.saved'),
      color: projectEditorAction.state.dirty ? 'warning' : 'success',
    }]
  }
  if (activeTab.value === 'server') {
    if (serverLaunch.target.value === 'remote') {
      const profile = instance.value.remoteServer
      return [{
        icon: 'dns',
        title: t('baseSetting.info.address'),
        text: profile?.host ? `${profile.host}:${profile.port}` : t('baseSetting.info.notConfigured'),
      }, {
        icon: 'person',
        title: t('user.name'),
        text: profile?.username || t('baseSetting.info.notSet'),
      }, {
        icon: serverLaunch.running.value ? 'play_circle' : 'stop_circle',
        title: t('baseSetting.info.status'),
        text: serverLaunch.running.value ? t('baseSetting.info.running') : t('baseSetting.info.stopped'),
        color: serverLaunch.running.value ? 'success' : undefined,
      }]
    }
    return [{
      icon: 'lan',
      title: t('server.port'),
      text: String(serverLaunch.port.value),
    }, {
      icon: 'group',
      title: t('server.maxPlayers'),
      text: String(serverLaunch.maxPlayers.value),
    }, {
      icon: serverLaunch.running.value ? 'play_circle' : 'stop_circle',
      title: t('baseSetting.info.status'),
      text: serverLaunch.running.value ? t('baseSetting.info.running') : t('baseSetting.info.stopped'),
      color: serverLaunch.running.value ? 'success' : undefined,
    }]
  }
  if (activeTab.value === 'appearance') {
    return [{
      icon: 'palette',
      title: t('setting.instanceTheme.name'),
      text: instanceTheme.value ? t('baseSetting.info.enabled') : t('baseSetting.info.disabled'),
      color: instanceTheme.value ? 'primary' : undefined,
    }, {
      icon: 'image',
      title: t('setting.backgroundImage'),
      text: instanceTheme.value?.backgroundImage ? t('baseSetting.info.custom') : t('baseSetting.info.inherited'),
    }, {
      icon: 'css',
      title: 'CSS',
      text: customCss.value ? t('baseSetting.info.custom') : t('baseSetting.info.notSet'),
    }]
  }
  const runtime = instance.value.runtime
  const loader = [
    ['NeoForge', runtime.neoForged],
    ['Forge', runtime.forge],
    ['Fabric', runtime.fabricLoader],
    ['Quilt', runtime.quiltLoader],
    ['OptiFine', runtime.optifine],
    ['LabyMod', runtime.labyMod],
  ].find(([, value]) => value)
  return [
    ...versionItems.value,
    {
      icon: 'extension',
      title: t('baseSetting.info.modLoader'),
      text: loader ? `${loader[0]} ${loader[1]}` : t('baseSetting.info.vanilla'),
    },
    {
      ...gameplayItems.value[0],
      text: gameplayItems.value[0]?.text || basename(instance.value.path),
    },
  ]
})
const tabGroup = computed<BaseSettingTab[]>(() => isBedrock.value
  ? ['', 'appearance']
  : [
      '',
      'modpack',
      ...(modpackMetadata.modrinth.projectId ? ['modrinth-project' as const] : []),
      'server',
      'appearance',
    ])
useGamepadInnerNav({
  handler: (dir) => {
    const raw = (targetQuery.value || '') as string
    const cur = raw === 'general' ? '' : raw
    let idx = tabGroup.value.indexOf(cur as BaseSettingTab)
    if (idx === -1) idx = 0
    const next = dir === 'next'
      ? (idx + 1) % tabGroup.value.length
      : (idx - 1 + tabGroup.value.length) % tabGroup.value.length
    navigate(tabGroup.value[next])
  },
})
</script>
