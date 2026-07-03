<template>
  <v-dialog
    v-model="dialogShown"
    max-width="500"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <div class="gp-dialog gp-mod-dialog">
      <div class="gp-dialog__glow gp-dialog__glow--accent" />

      <div class="gp-dialog__content">
        <div class="gp-dialog__icon-wrap">
          <div class="gp-dialog__icon-badge gp-dialog__icon-badge--accent">
            <v-icon size="28">extension</v-icon>
          </div>
        </div>

        <div class="text-lg font-bold tracking-tight mt-4 mb-1" style="color: rgba(var(--v-theme-on-surface), 0.95)">
          {{ $t('gamepad.modSuggestTitle') }}
        </div>

        <p class="text-sm mb-5" style="color: rgba(var(--v-theme-on-surface), 0.55); line-height: 1.6;">
          {{ $t('gamepad.modSuggestBody') }}
        </p>

        <!-- Mod card -->
        <div
          v-if="suggestedMod"
          class="gp-mod-card mb-5"
        >
          <div class="gp-mod-card__icon">
            <v-icon size="24" color="primary">extension</v-icon>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-bold mb-0.5" style="color: rgba(var(--v-theme-on-surface), 0.9)">
              {{ suggestedMod.name }}
            </div>
            <div class="text-xs" style="color: rgba(var(--v-theme-on-surface), 0.5); line-height: 1.5;">
              {{ suggestedMod.description }}
            </div>
            <div class="flex items-center gap-2 mt-2">
              <span class="gp-tag">
                <v-icon size="11" class="mr-0.5">settings</v-icon>
                {{ suggestedMod.loader }}
              </span>
              <span class="gp-tag">
                <v-icon size="11" class="mr-0.5">public</v-icon>
                Modrinth
              </span>
            </div>
          </div>
        </div>

        <!-- Status alerts -->
        <Transition name="gp-fade">
          <div
            v-if="modInstallError"
            class="gp-status gp-status--error mb-4"
          >
            <v-icon size="16" color="error" class="mr-2 flex-shrink-0">error</v-icon>
            <span class="text-xs">{{ modInstallError }}</span>
          </div>
        </Transition>

        <Transition name="gp-fade">
          <div
            v-if="modInstallSuccess"
            class="gp-status gp-status--success mb-4"
          >
            <v-icon size="16" color="success" class="mr-2 flex-shrink-0">check_circle</v-icon>
            <span class="text-xs">{{ $t('gamepad.modInstalled') }}</span>
          </div>
        </Transition>

        <!-- Actions -->
        <div class="flex gap-3 w-full">
          <v-btn
            class="flex-1 gp-btn gp-btn--secondary"
            variant="flat"
            size="large"
            @click="hide"
          >
            <span class="gp-btn__key mr-2">{{ buttonBLabel }}</span>
            {{ $t('gamepad.modSkip') }}
          </v-btn>
          <v-btn
            v-if="!modInstallSuccess"
            class="flex-1 gp-btn gp-btn--primary"
            variant="flat"
            size="large"
            :loading="modInstalling"
            @click="installSuggestedMod"
          >
            <span class="gp-btn__key gp-btn__key--primary mr-2">{{ buttonALabel }}</span>
            {{ $t('gamepad.modInstall') }}
          </v-btn>
          <v-btn
            v-else
            class="flex-1 gp-btn gp-btn--success"
            variant="flat"
            size="large"
            @click="hide"
          >
            <span class="gp-btn__key gp-btn__key--primary mr-2">{{ buttonALabel }}</span>
            {{ $t('gamepad.modDone') }}
          </v-btn>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotifier } from '@/composables/notifier'
import { useDialog } from '@/composables/dialog'
import { useService } from '@/composables/service'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'
import { InstanceModsServiceKey, MarketType } from '@xmcl/runtime-api'
import { clientModrinthV2, clientCurseforgeV1 } from '@/util/clients'
import { kGamepad } from '@/composables/gamepad'
import './gamepad.css'

const { t } = useI18n()
const { notify } = useNotifier()

const gamepad = injection(kGamepad)
const buttonALabel = gamepad.buttonA
const buttonBLabel = gamepad.buttonB

const { installFromMarket } = useService(InstanceModsServiceKey)
const { runtime, path: instancePath } = injection(kInstance)

const { isShown: dialogShown, show, hide } = useDialog('gamepadMod')

const modInstalling = ref(false)
const modInstallError = ref('')
const modInstallSuccess = ref(false)

// Known controller mods on Modrinth / CurseForge
const CONTROLLER_MODS: Record<string, { slug: string; name: string; description: string; loader: string }> = {
  fabric: {
    slug: 'midnightcontrols',
    name: 'MidnightControls',
    description: 'Full controller support with on-screen hints for Fabric/Quilt',
    loader: 'Fabric',
  },
  quilt: {
    slug: 'midnightcontrols',
    name: 'MidnightControls',
    description: 'Full controller support with on-screen hints for Fabric/Quilt',
    loader: 'Quilt',
  },
  forge: {
    slug: 'controllable',
    name: 'Controllable',
    description: 'Xbox / PlayStation controller support for Forge',
    loader: 'Forge',
  },
  neoforge: {
    slug: 'controllable',
    name: 'Controllable',
    description: 'Xbox / PlayStation controller support for NeoForge',
    loader: 'NeoForge',
  },
}

const detectedLoader = computed(() => {
  const rt = runtime.value
  if (rt.fabricLoader) return 'fabric'
  if (rt.quiltLoader) return 'quilt'
  if (rt.neoForged) return 'neoforge'
  if (rt.forge) return 'forge'
  return null
})

const suggestedMod = computed(() => {
  const loader = detectedLoader.value
  if (!loader) return null
  return CONTROLLER_MODS[loader] ?? null
})

async function installSuggestedMod() {
  const mod = suggestedMod.value
  const loader = detectedLoader.value
  if (!mod || !loader) return

  modInstalling.value = true
  modInstallError.value = ''
  modInstallSuccess.value = false

  try {
    const mcVersion = runtime.value.minecraft

    if (loader === 'forge' || loader === 'neoforge') {
      // Forge & NeoForge: Install Controllable from CurseForge
      const loaderType = loader === 'neoforge' ? 5 : 1
      const { data: files } = await clientCurseforgeV1.getModFiles({
        modId: 317269, // Controllable CurseForge ID
        gameVersion: mcVersion,
        modLoaderType: loaderType,
      })

      if (!files || files.length === 0) {
        modInstallError.value = t('gamepad.modNotFound', { loader: mod.loader, version: mcVersion })
        return
      }

      const latestFile = files[0]

      await installFromMarket({
        market: MarketType.CurseForge,
        file: { fileId: latestFile.id },
        instancePath: instancePath.value,
      })
    } else {
      // Fabric & Quilt: Install MidnightControls from Modrinth
      const versions = await clientModrinthV2.getProjectVersions(
        mod.slug,
        { loaders: [loader], gameVersions: [mcVersion] },
      )

      if (!versions || versions.length === 0) {
        modInstallError.value = t('gamepad.modNotFound', { loader: mod.loader, version: mcVersion })
        return
      }

      const version = versions[0]

      await installFromMarket({
        market: MarketType.Modrinth,
        version: { versionId: version.id },
        instancePath: instancePath.value,
      })
    }

    modInstallSuccess.value = true
    localStorage.setItem(`gamepad_mod_offered_${instancePath.value}`, 'installed')

    notify({
      title: t('gamepad.modSuggestTitle'),
      body: t('gamepad.modInstalledNotify', { name: mod.name }),
      level: 'success',
    })
  } catch (e: any) {
    modInstallError.value = e?.message ?? String(e)
  } finally {
    modInstalling.value = false
  }
}

// Offer the controller mod once per instance when the gamepad is active.
function maybeSuggestControllerMod() {
  if (!gamepad.enabled.value || !gamepad.connected.value) return
  if (!suggestedMod.value) return
  const key = `gamepad_mod_offered_${instancePath.value}`
  if (localStorage.getItem(key)) return
  localStorage.setItem(key, 'offered')
  modInstallError.value = ''
  modInstallSuccess.value = false
  show()
}

// Trigger when the gamepad is turned on, when the instance changes, and on mount.
watch(gamepad.enabled, (value, old) => {
  if (value && !old && gamepad.connected.value) {
    setTimeout(() => maybeSuggestControllerMod(), 500)
  }
})
watch(instancePath, () => maybeSuggestControllerMod())
onMounted(() => {
  if (gamepad.enabled.value && gamepad.connected.value) {
    setTimeout(() => maybeSuggestControllerMod(), 1000)
  }
})

// Route A/B while the dialog is open.
watch(dialogShown, (shown) => {
  if (shown) {
    gamepad.registerContext('mod-suggest', {
      onConfirm: () => {
        if (!modInstallSuccess.value) installSuggestedMod()
        else hide()
      },
      onCancel: () => hide(),
      root: () => document.querySelector('.gp-mod-dialog'),
    })
  } else {
    gamepad.unregisterContext('mod-suggest')
  }
})
</script>
