<template>
  <v-dialog
    v-model="isShown"
    data-testid="add-instance-dialog"
    width="900"
    :persistent="true"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <div class="surface-dialog-shell flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center px-6 pt-6 pb-4">
        <div class="flex items-center gap-3 flex-grow">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style="background-color: rgba(var(--v-theme-primary), 0.12)"
          >
            <v-icon size="22" color="primary">add</v-icon>
          </div>
          <div
            class="text-base font-bold tracking-tight"
            style="color: rgba(var(--v-theme-on-surface), 0.9)"
          >
            <template v-if="steps[step - 1] === 'config'">
              {{ t('instances.add') }}
            </template>
            <template v-if="steps[step - 1] === 'server'">
              {{ t('AppAddInstanceDialog.serverTitle') }}
            </template>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <v-btn-toggle
            v-if="steps[step - 1] === 'config' && hasMinecraftLicense && bedrockSupported"
            data-testid="add-instance-edition"
            :model-value="creation.data.edition"
            mandatory
            color="primary"
            variant="outlined"
            rounded="pill"
            density="compact"
            divided
            @update:model-value="onEditionChange"
          >
            <v-btn
              data-testid="add-instance-edition-java"
              value="java"
              size="small"
              :disabled="loading"
            >
              <v-icon start size="16">code</v-icon>
              {{ t('instances.editionJava') }}
            </v-btn>
            <v-btn
              data-testid="add-instance-edition-bedrock"
              value="bedrock"
              size="small"
              :disabled="loading || !bedrockSupported"
            >
              <v-icon start size="16">view_in_ar</v-icon>
              {{ t('instances.editionBedrock') }}
            </v-btn>
          </v-btn-toggle>
          <v-btn
            color="primary"
            variant="tonal"
            rounded="pill"
            size="small"
            @click="onMigrateFromOther"
          >
            <v-icon start size="16">local_shipping</v-icon>
            {{ t('setting.migrateFromOther') }}
          </v-btn>
        </div>
      </div>

      <v-divider class="mx-6 opacity-20" />

      <div
        v-if="steps[step - 1] === 'config' && creation.data.edition === 'bedrock'"
        class="px-6 pt-3 text-caption"
        style="color: rgba(var(--v-theme-on-surface), 0.6);"
      >
        {{ t('instances.editionBedrockHint') }}
      </div>

      <v-alert
        v-if="existingInstance"
        type="info"
        variant="tonal"
        density="compact"
        rounded="lg"
        class="mx-6 mt-4"
      >
        <div class="flex items-center gap-3 flex-wrap">
          <span class="flex-grow">
            {{ t('modpackUpdateOrCreate.description', { name: existingInstance.name }) }}
          </span>
          <v-btn
            color="primary"
            variant="tonal"
            rounded="pill"
            size="small"
            :loading="loading"
            @click="onUpdateExisting"
          >
            <v-icon start size="16">update</v-icon>
            {{ t('modpackUpdateOrCreate.update') }}
          </v-btn>
        </div>
      </v-alert>

      <v-window v-model="step" class="visible-scroll overflow-y-auto">
        <v-window-item v-for="(tStep, i) in steps" :key="tStep" class="max-h-[70vh]" :value="i + 1">
          <StepConfig v-if="tStep === 'config'" :loading="loading" v-model:valid="valid">
            <!-- TODO: rethink how to integrate collections into the Add Instance flow.
            <template #collection>
              <div v-if="localCollectionOptions.length > 0" class="mb-4">
                <v-select
                  v-model="selectedCollectionId"
                  :items="localCollectionOptions"
                  item-title="title"
                  item-value="value"
                  :label="t('localCollection.title')"
                  :hint="t('localCollection.installAllHint')"
                  persistent-hint
                  clearable
                  density="comfortable"
                  variant="outlined"
                  prepend-inner-icon="bookmarks"
                  data-testid="add-instance-collection"
                />
              </div>
            </template>
            -->
          </StepConfig>
          <StepServer v-if="tStep === 'server'" v-model:valid="valid" />
        </v-window-item>
      </v-window>
      <v-divider class="mx-6 opacity-20" />
      <StepperFooter
        class="px-6 pb-6 pt-4"
        :disabled="!valid || loading"
        :creating="loading"
        :next="step !== steps.length"
        :create="step === steps.length"
        @create="onCreate"
        @next="next"
        @quit="quit"
      >
        <div v-if="type === 'template' || type === 'manual' || !type" class="flex justify-end">
          <v-menu location="top end">
            <template #activator="{ props }">
              <v-btn
                data-testid="add-instance-import"
                v-bind="props"
                :loading="loading || urlLoading"
                variant="tonal"
                color="primary"
                rounded="pill"
              >
                <v-icon start> folder_zip </v-icon>
                {{ t('importModpack.name') }}
                <v-icon end> arrow_drop_down </v-icon>
              </v-btn>
            </template>
            <v-list class="surface-card rounded-xl">
              <v-list-item
                data-testid="add-instance-import-file"
                @click="onImportModpack"
              >
                <template #prepend>
                  <v-icon color="primary">folder</v-icon>
                </template>
                <v-list-item-title>{{ t('importModpack.fromFile') }}</v-list-item-title>
                <v-list-item-subtitle class="text-xs opacity-60">.zip, .mrpack</v-list-item-subtitle>
              </v-list-item>
              <v-list-item
                data-testid="add-instance-import-url"
                @click="openUrlDialog"
              >
                <template #prepend>
                  <v-icon color="primary">link</v-icon>
                </template>
                <v-list-item-title>{{ t('importModpack.fromUrl') }}</v-list-item-title>
                <v-list-item-subtitle class="text-xs opacity-60">http://, https://, curseforge://</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
        <div v-if="error" class="pointer-events-none left-0 flex w-full justify-center">
          <v-alert density="compact" variant="tonal" rounded="lg" class="w-[50%]" type="error">
            {{ errorText }}
          </v-alert>
        </div>
      </StepperFooter>
    </div>

    <!-- Import Modpack from URL Dialog -->
    <v-dialog v-model="showUrlDialog" max-width="520">
      <v-card class="rounded-2xl p-4">
        <v-card-title class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
            <v-icon color="primary">link</v-icon>
          </div>
          <span>{{ t('importModpack.fromUrlTitle') }}</span>
        </v-card-title>
        <v-card-text class="pt-3">
          <p class="text-sm opacity-80 mb-3">
            {{ t('importModpack.fromUrlDescription') }}
          </p>
          <v-text-field
            v-model="modpackUrl"
            variant="filled"
            density="comfortable"
            prepend-inner-icon="link"
            clearable
            :placeholder="t('importModpack.fromUrlPlaceholder')"
            :error-messages="urlError"
            @keydown.enter="submitModpackUrl"
          />
        </v-card-text>
        <v-card-actions class="justify-end gap-2 px-4 pb-2">
          <v-btn variant="text" @click="showUrlDialog = false">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :loading="urlLoading"
            :disabled="!modpackUrl.trim()"
            @click="submitModpackUrl"
          >
            <v-icon start>download</v-icon>
            {{ t('importModpack.import') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Version Select Dialog -->
    <v-dialog v-model="showVersionSelectDialog" max-width="560">
      <v-card class="rounded-2xl p-4">
        <v-card-title class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
            <v-icon color="primary" size="24" :icon="selectedSourceIcon" />
          </div>
          <div class="flex flex-col">
            <span class="text-base font-bold">{{ t('importModpack.selectVersion') }}</span>
            <span class="text-xs opacity-60 font-normal">{{ selectedProjectName }}</span>
          </div>
        </v-card-title>
        <v-card-text class="pt-3">
          <p class="text-sm opacity-80 mb-3">
            {{ t('importModpack.selectVersionDescription', { name: selectedProjectName }) }}
          </p>
          <v-select
            v-model="selectedVersionId"
            :items="availableVersions"
            item-title="title"
            item-value="id"
            variant="filled"
            density="comfortable"
            hide-details
          />
        </v-card-text>
        <v-card-actions class="justify-end gap-2 px-4 pb-2">
          <v-btn variant="text" @click="showVersionSelectDialog = false">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :loading="versionLoading"
            :disabled="!selectedVersionId"
            @click="confirmVersionSelect"
          >
            <v-icon start>download</v-icon>
            {{ t('importModpack.importVersion') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script lang="ts" setup>
import StepConfig from '@/components/StepConfig.vue'
import StepServer from '@/components/StepServer.vue'
import StepperFooter from '@/components/StepperFooter.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { kInstances } from '@/composables/instances'
import { kJavaContext } from '@/composables/java'
import { useNotifier } from '@/composables/notifier'
import { kUserContext } from '@/composables/user'
import { getFTBTemplateAndFile } from '@/util/ftb'
import { injection } from '@/util/inject'
import { findInstanceForModpack, InstanceEdition } from '@xmcl/instance'
import {
  CachedFTBModpackVersionManifest,
  InstanceManifest,
  isException,
  ModpackException,
  ModpackServiceKey,
  waitModpackFiles,
  BedrockServiceKey,
  BaseServiceKey,
  MarketType,
} from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { kInstanceCreation, useInstanceCreation } from '../composables/instanceCreation'
import { AddInstanceDialogKey } from '../composables/instanceTemplates'
import { useModpackFinishInstall } from '@/composables/modpackInstaller'
import { useHasMinecraftLicense } from '@/composables/minecraftLicense'
// TODO: collection integration for Add Instance is disabled pending a redesign.
// import { kLocalCollections } from '@/composables/localCollections'
// import { runBulkInstall, candidateToMarketOption } from '@/composables/collectionInstall'
// import { resolveCollectionEntry } from '@/composables/collectionResolver'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
// import { getModrinthModLoaders } from '@/util/modrinth'
// import {
//   CollectionContentType,
//   InstanceModsServiceKey,
//   InstanceResourcePacksServiceKey,
//   InstanceShaderPacksServiceKey,
// } from '@xmcl/runtime-api'

const type = ref(
  undefined as
    | 'modrinth'
    | 'mmc'
    | 'server'
    | 'vanilla'
    | 'manual'
    | 'template'
    | 'prism'
    | undefined,
)

// Dialog model
const { openModpack } = useService(ModpackServiceKey)
const { all: javas } = injection(kJavaContext)
// The modpack file currently loaded into the creation form (if any), and the
// existing instance that already corresponds to it. Used to offer updating the
// existing instance instead of always creating a new one.
const modpackFilePath = ref('')
const existingInstance = ref(undefined as { path: string; name: string } | undefined)
const onSelectModpack = async (modpack: string) => {
  try {
    loading.value = true
    existingInstance.value = undefined
    modpackFilePath.value = modpack
    const openedModpack = await openModpack(modpack)
    if (openedModpack.error) {
      error.value = openedModpack.error
    }
    if (openedModpack.config) {
      if (selectedProjectName.value) {
        openedModpack.config.name = selectedProjectName.value
      }
      await update(openedModpack.config, waitModpackFiles(openedModpack))
      const matched = findInstanceForModpack(instances.value, {
        upstream: openedModpack.config.upstream,
        name: openedModpack.config.name,
      })
      existingInstance.value = matched ? { path: matched.path, name: matched.name } : undefined
    }
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}
const onSelectFTB = async (ftb: CachedFTBModpackVersionManifest) => {
  try {
    loading.value = true
    existingInstance.value = undefined
    modpackFilePath.value = ''
    const [config, files] = getFTBTemplateAndFile(ftb, javas.value)
    if (!config) return
    await update(config, Promise.resolve(files))
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}
const onSelectManifest = async (man: InstanceManifest) => {
  try {
    loading.value = true
    existingInstance.value = undefined
    modpackFilePath.value = ''
    await update(
      {
        name: man.name ?? '',
        description: man.description,
        minMemory: man.minMemory,
        maxMemory: man.maxMemory,
        vmOptions: man.vmOptions,
        mcOptions: man.mcOptions,
        runtime: man.runtime,
      },
      Promise.resolve(man.files),
    )
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

const { isShown, show, hide } = useDialog(
  AddInstanceDialogKey,
  (param) => {
    if (loading.value) {
      return
    }

    step.value = 1
    type.value = 'template'
    valid.value = true
    existingInstance.value = undefined
    modpackFilePath.value = ''

    windowController.focus()

    if (!param) return

    if (typeof param === 'object') {
      const after = () => {
        type.value = 'template'
        nextTick(() => {
          step.value = 1
        })
      }
      if (param.format === 'modpack') {
        onSelectModpack(param.path).then(after)
      } else if (param.format === 'ftb') {
        onSelectFTB(param.manifest).then(after)
      } else if (param.format === 'manifest') {
        onSelectManifest(param.manifest).then(after)
      }
    }
  },
  () => {
    if (loading.value) {
      return
    }
    setTimeout(() => {
      step.value = 1
      valid.value = true
      type.value = 'template'
      existingInstance.value = undefined
      modpackFilePath.value = ''
      // selectedCollectionId.value = undefined
      reset()
    }, 500)
  },
)
watch(isShown, (v) => {
  if (v) {
    windowController.focus()
  }
})
function quit() {
  if (loading.value) return
  hide()
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hide()
  }
})

const { t } = useI18n()

// Instance create data
const { gameProfile } = injection(kUserContext)
const { instances } = injection(kInstances)
const { path } = injection(kInstance)
const creation = useInstanceCreation(gameProfile, instances)
const { create, reset, error, update, loading } = creation
provide(kInstanceCreation, creation)

// Install
const router = useRouter()
const { getInstallation, install: installBedrock, isSupported } = useService(BedrockServiceKey)
const { fix } = injection(kInstanceVersionInstall)
const { hasMinecraftLicense } = useHasMinecraftLicense()

// Edition selector (in the dialog header). Only offered when the account is
// licensed and the platform supports Bedrock.
const bedrockSupported = ref(false)
isSupported().then((v) => { bedrockSupported.value = v }).catch(() => { bedrockSupported.value = false })

// Fall back to the Java edition if the Bedrock option is no longer available
// (e.g. the account lost its license or on unsupported platform), so the
// mandatory toggle always has a valid selection.
watch([hasMinecraftLicense, bedrockSupported], ([licensed, supported]) => {
  if ((!licensed || !supported) && creation.data.edition === 'bedrock') {
    creation.data.edition = 'java'
  }
}, { immediate: true })

const onEditionChange = (edition: InstanceEdition) => {
  creation.data.edition = edition ?? 'java'
  if (edition === 'bedrock') {
    creation.data.name = 'Bedrock'
  } else if (creation.data.name === 'Bedrock') {
    creation.data.name = ''
  }
}

/* TODO: Create-from-collection is disabled pending a redesign of how
 * collections integrate with the Add Instance dialog.
const localCollectionsCtx = injection(kLocalCollections)
const selectedCollectionId = ref<string | undefined>(undefined)
const localCollectionOptions = computed(() => localCollectionsCtx.collections.value
  .map((c) => {
    const count = c.mods.length + c.resourcepacks.length + c.shaderpacks.length
    return {
      value: c.id,
      title: `${c.name} (${count})`,
      count,
    }
  })
  .filter((c) => c.count > 0))

const { installFromMarket: installCollectionMods } = useService(InstanceModsServiceKey)
const { installFromMarket: installCollectionResourcePacks } = useService(InstanceResourcePacksServiceKey)
const { installFromMarket: installCollectionShaderPacks } = useService(InstanceShaderPacksServiceKey)

async function installCollectionToInstance(newPath: string) {
  const id = selectedCollectionId.value
  if (!id) return
  const collection = localCollectionsCtx.getCollection(id)
  if (!collection) return
  const runtime = creation.data.runtime
  const installers: Record<CollectionContentType, (o: any) => Promise<any>> = {
    mods: installCollectionMods,
    resourcepacks: installCollectionResourcePacks,
    shaderpacks: installCollectionShaderPacks,
  }
  const summary = { installed: 0, skipped: 0, failed: 0 }
  for (const contentType of ['mods', 'resourcepacks', 'shaderpacks'] as CollectionContentType[]) {
    const entries = collection[contentType]
    if (entries.length === 0) continue
    const target = {
      minecraft: runtime.minecraft,
      loaders: contentType === 'mods' ? getModrinthModLoaders(runtime, false) : [],
      contentType,
    }
    const result = await runBulkInstall(entries, {
      resolve: (e, signal) => resolveCollectionEntry(e, target, { modrinth: clientModrinthV2, curseforge: clientCurseforgeV1 }, signal),
      isInstalled: () => false,
      install: (candidate) => installers[contentType](candidateToMarketOption(candidate, newPath)),
    })
    summary.installed += result.installed.length
    summary.skipped += result.skipped.length
    summary.failed += result.failed.length
  }
  // Report incompatible/failed items without silently dropping them.
  if (summary.skipped + summary.failed > 0) {
    notify({
      level: 'warning',
      title: t('localCollection.result.title'),
      body: `${t('localCollection.result.installed')}: ${summary.installed}, ${t('localCollection.result.skipped')}: ${summary.skipped}, ${t('localCollection.result.failed')}: ${summary.failed}`,
    })
  }
}
*/

const onCreate = async () => {
  const isBedrock = creation.data.edition === 'bedrock'
  if (isBedrock) {
    if (!hasMinecraftLicense.value) {
      notify({
        level: 'error',
        title: t('bedrock.installFailed'),
        body: t('bedrock.licenseRequired'),
      })
      return
    }
  }
  const newPath = await create((newPath) => {
    path.value = newPath
    if (router.currentRoute.value.path !== '/') router.push('/')
    hide()
  })
  if (isBedrock) {
    try {
      const instStatus = await getInstallation()
      if (!instStatus.installed) {
        installBedrock().catch((err) => {
          console.error('Failed to auto install Bedrock:', err)
        })
      }
    } catch (e) {
      console.error(e)
    }
  } else if (newPath === path.value) {
    await fix().catch(() => {})
  }
  // TODO: re-enable installing a selected collection into the new instance
  // once the Add Instance collection UX is redesigned.
  // if (!isBedrock && newPath) {
  //   await installCollectionToInstance(newPath).catch((e) => console.error(e))
  // }
}

const finishModpackInstall = useModpackFinishInstall()
const onUpdateExisting = async () => {
  const existing = existingInstance.value
  if (!existing || !modpackFilePath.value) return
  try {
    loading.value = true
    await finishModpackInstall(
      modpackFilePath.value,
      creation.data.icon || undefined,
      creation.data.upstream,
      existing.path,
    )
    hide()
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

// Stepper model
const valid = ref(false)
const step = ref(1)
const errorText = computed(() => {
  const err = error.value
  if (isException(ModpackException, err)) {
    if (err.exception.type === 'invalidModpack') {
      return t('errors.BadInstanceType', {
        type: err.exception.path
      })
    } else if (err.exception.type === 'requireModpackAFile') {
      return 'errors.RequireModpackAFile'
    }
  }
  return t('errors.BadInstanceType', {
    type:
      type.value === 'mmc'
        ? 'MultiMC'
        : type.value === 'modrinth'
          ? 'Modrinth'
          : type.value === 'prism'
            ? 'PrismLauncher'
            : '',
  })
})
const steps = computed(() => {
  if (type.value === 'server') {
    return ['server', 'config']
  }

  return ['config']
})
function next() {
  if (step.value < steps.value.length) {
    step.value += 1
  }
}
function back() {
  if (step.value > 1) {
    step.value -= 1
  }
}

function onSelectTemplate() {
  type.value = 'template'
  step.value = 1
}

// Manuall import
const onImportModpack = () => {
  windowController
    .showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: t('modpack.name', 2), extensions: ['zip', 'mrpack'] }],
    })
    .then(async (res) => {
      if (res.canceled || !res.filePaths[0]) return
      const file = res.filePaths[0]
      try {
        loading.value = true
        await onSelectModpack(file)
        type.value = 'template'
        nextTick(() => {
          step.value = 1
        })
      } catch (e) {
        error.value = e
      } finally {
        loading.value = false
      }
    })
}

// URL Import & Version Selection
const { installModapckFromMarket } = useService(ModpackServiceKey)
const { handleUrl } = useService(BaseServiceKey)
const showUrlDialog = ref(false)
const modpackUrl = ref('')
const urlLoading = ref(false)
const urlError = ref('')

const showVersionSelectDialog = ref(false)
const selectedProjectName = ref('')
const selectedVersionId = ref<number | string | undefined>(undefined)
const availableVersions = ref<{ id: number | string; title: string }[]>([])
const selectedMarketType = ref<MarketType>(MarketType.Modrinth)
const selectedSource = ref<'modrinth' | 'curseforge' | 'github' | 'technic' | 'url'>('url')
const selectedSourceIcon = computed(() => {
  switch (selectedSource.value) {
    case 'modrinth': return 'xmcl:modrinth'
    case 'curseforge': return 'xmcl:curseforge'
    case 'github': return 'xmcl:github'
    case 'technic': return 'xmcl:technic'
    default: return 'folder_zip'
  }
})
const versionLoading = ref(false)

function openUrlDialog() {
  modpackUrl.value = ''
  urlError.value = ''
  showUrlDialog.value = true
}

async function confirmVersionSelect() {
  if (!selectedVersionId.value) return
  versionLoading.value = true
  try {
    if (
      typeof selectedVersionId.value === 'string' &&
      (selectedVersionId.value.startsWith('http://') || selectedVersionId.value.startsWith('https://'))
    ) {
      showVersionSelectDialog.value = false
      showUrlDialog.value = false
      await onSelectModpack(selectedVersionId.value)
      type.value = 'template'
      nextTick(() => {
        step.value = 1
      })
      return
    }

    const [downloadedFile] = await installModapckFromMarket(
      selectedMarketType.value === MarketType.CurseForge
        ? {
            market: MarketType.CurseForge,
            file: { fileId: selectedVersionId.value as number },
          }
        : {
            market: MarketType.Modrinth,
            version: { versionId: selectedVersionId.value as string },
          }
    )
    if (downloadedFile) {
      showVersionSelectDialog.value = false
      showUrlDialog.value = false
      await onSelectModpack(downloadedFile)
      type.value = 'template'
      nextTick(() => {
        step.value = 1
      })
    }
  } catch (e: any) {
    urlError.value = e?.message || String(e)
  } finally {
    versionLoading.value = false
  }
}

async function submitModpackUrl() {
  const inputUrl = modpackUrl.value.trim()
  if (!inputUrl) return

  if (
    !inputUrl.startsWith('http://') &&
    !inputUrl.startsWith('https://') &&
    !inputUrl.startsWith('xmcl://') &&
    !inputUrl.startsWith('curseforge://') &&
    !inputUrl.startsWith('modrinth://')
  ) {
    urlError.value = t('importModpack.invalidUrl')
    return
  }

  urlLoading.value = true
  urlError.value = ''

  try {
    // 1. Resolve Modrinth web URL: e.g. https://modrinth.com/modpack/zombie-invade-100-days?version=1.20.1&loader=forge
    const modrinthMatch = inputUrl.match(/modrinth\.com\/modpack\/([a-zA-Z0-9\-\_]+)/i)
    if (modrinthMatch) {
      const slug = modrinthMatch[1]
      let reqVersion: string | null = null
      let reqLoader: string | null = null
      try {
        const urlObj = new URL(inputUrl)
        reqVersion = urlObj.searchParams.get('version')
        reqLoader = urlObj.searchParams.get('loader')
      } catch { }

      const project = await clientModrinthV2.getProject(slug).catch(() => null)
      const versions = await clientModrinthV2.getProjectVersions(slug).catch(() => [])

      if (versions && versions.length > 0) {
        selectedSource.value = 'modrinth'
        selectedProjectName.value = project?.title || slug
        selectedMarketType.value = MarketType.Modrinth
        availableVersions.value = versions.map((v: any) => ({
          id: v.id,
          title: `${v.name || v.version_number} (${v.game_versions?.join(', ') || ''}${v.loaders?.length ? ' - ' + v.loaders.join(', ') : ''})`,
        }))

        // Pre-select matching version if query params provided
        if (reqVersion || reqLoader) {
          const matched = versions.find((v: any) => {
            let match = true
            if (reqVersion && Array.isArray(v.game_versions)) match = match && v.game_versions.includes(reqVersion)
            if (reqLoader && Array.isArray(v.loaders)) match = match && v.loaders.includes(reqLoader)
            return match
          })
          if (matched && matched.id) {
            selectedVersionId.value = matched.id
          } else {
            selectedVersionId.value = availableVersions.value[0]?.id
          }
        } else {
          selectedVersionId.value = availableVersions.value[0]?.id
        }

        showUrlDialog.value = false
        showVersionSelectDialog.value = true
        return
      }
    }

    // 2. Resolve CurseForge web URL: e.g. https://www.curseforge.com/minecraft/modpacks/all-the-mods-10
    const curseforgeMatch = inputUrl.match(/curseforge\.com\/minecraft\/modpacks\/([a-zA-Z0-9\-\_]+)/i)
    if (curseforgeMatch) {
      const slug = curseforgeMatch[1]
      let versionsList: { id: number; title: string }[] = []

      // Try clientCurseforgeV1 first
      try {
        const searchRes = await clientCurseforgeV1.searchMods({ slug, classId: 4471 }).catch(() => ({ data: [] }))
        let mod = searchRes.data?.[0]
        if (!mod) {
          const fallbackRes = await clientCurseforgeV1.searchMods({ slug }).catch(() => ({ data: [] }))
          mod = fallbackRes.data?.[0]
        }
        if (mod) {
          selectedProjectName.value = mod.name || slug
          const filesRes = await clientCurseforgeV1.getModFiles({ modId: mod.id }).catch(() => ({ data: [] }))
          if (filesRes.data && filesRes.data.length > 0) {
            versionsList = filesRes.data.map((f: any) => ({
              id: f.id,
              title: `${f.displayName} (${f.gameVersions?.filter((v: string) => !v.includes('Java') && !v.includes('Client'))?.join(', ') || ''})`,
            }))
          }
        }
      } catch { }

      // HTML Fallback if API returned 403 or empty
      if (versionsList.length === 0) {
        try {
          const pageRes = await fetch(`https://www.curseforge.com/minecraft/modpacks/${slug}/files`).catch(() => null)
          if (pageRes && pageRes.ok) {
            const html = await pageRes.text()
            selectedProjectName.value = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            // Match file links and version titles
            const regex = /href="\/minecraft\/modpacks\/[^"]+\/files\/(\d+)"[^>]*>([^<]+)<\/a>/g
            let match: RegExpExecArray | null
            while ((match = regex.exec(html)) !== null) {
              const fileId = parseInt(match[1], 10)
              const title = match[2].trim()
              if (fileId && title && !versionsList.some(v => v.id === fileId)) {
                versionsList.push({ id: fileId, title })
              }
            }
          }
        } catch { }
      }

      if (versionsList.length > 0) {
        selectedSource.value = 'curseforge'
        selectedMarketType.value = MarketType.CurseForge
        availableVersions.value = versionsList
        selectedVersionId.value = versionsList[0]?.id
        showUrlDialog.value = false
        showVersionSelectDialog.value = true
        return
      }
    }

    // 3. Resolve TechnicPack web URL: e.g. https://www.technicpack.net/modpack/the-1122-pack.1406454
    const technicMatch = inputUrl.match(/(?:technicpack\.net\/modpack\/|technic:\/\/modpack\/)([a-zA-Z0-9\-\_\.]+)/i)
    if (technicMatch) {
      const slug = technicMatch[1].split('.')[0]
      let resolvedUrl: string | undefined = undefined

      try {
        const pageUrl = inputUrl.startsWith('http') ? inputUrl : `https://www.technicpack.net/modpack/${slug}`
        const pageRes = await fetch(pageUrl).catch(() => null)
        if (pageRes && pageRes.ok) {
          const html = await pageRes.text()
          const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<\|]+)/i)
          if (titleMatch) {
            selectedProjectName.value = titleMatch[1].trim()
          }
          const zipMatch =
            html.match(/href="([^"]*servers\.technicpack\.net[^"]*\.zip[^"]*)"/i) ||
            html.match(/href="([^"]*(?:cdn|mirror|servers)\.technicpack\.net[^"]*\.zip[^"]*)"/i) ||
            html.match(/href="([^"]+\.zip[^"]*)"/i) ||
            html.match(/(https?:\/\/[^"'\s]+\.zip[^\s"']*)/i)
          if (zipMatch) {
            resolvedUrl = zipMatch[1]
          }
        }
      } catch { }

      if (!resolvedUrl) {
        try {
          const res = await fetch(`https://api.technicpack.net/modpack/${slug}?build=600`).catch(() => null)
          if (res && res.ok) {
            const json = await res.json().catch(() => null)
            if (json && json.url) {
              resolvedUrl = json.url
            }
          }
        } catch { }
      }

      if (resolvedUrl) {
        selectedSource.value = 'technic'
        showUrlDialog.value = false
        await onSelectModpack(resolvedUrl)
        type.value = 'template'
        nextTick(() => {
          step.value = 1
        })
        return
      }
    }

    // 4. Resolve GitHub repository / release URLs: e.g. https://github.com/Fabulously-Optimized/fabulously-optimized
    const githubMatch = inputUrl.match(/github\.com\/([^\/]+)\/([^\/\?\#]+)/i)
    if (githubMatch) {
      const owner = githubMatch[1]
      const repo = githubMatch[2].replace(/\.git$/, '')

      selectedProjectName.value = repo
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

      const versionsList: { id: string; title: string }[] = []

      // 1. Query GitHub Releases API
      try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`).catch(() => null)
        if (res && res.ok) {
          const releases = await res.json()
          if (Array.isArray(releases) && releases.length > 0) {
            for (const rel of releases) {
              if (Array.isArray(rel.assets)) {
                for (const asset of rel.assets) {
                  const name = asset.name || ''
                  if (name.endsWith('.mrpack') || name.endsWith('.zip')) {
                    versionsList.push({
                      id: asset.browser_download_url,
                      title: `${rel.name || rel.tag_name} - ${name}`,
                    })
                  }
                }
              }
            }
          }
        }
      } catch { }

      // 2. Fallback: Parse GitHub Releases HTML if API rate-limited or failed
      if (versionsList.length === 0) {
        try {
          const pageRes = await fetch(`https://github.com/${owner}/${repo}/releases`).catch(() => null)
          if (pageRes && pageRes.ok) {
            const html = await pageRes.text()
            const assetRegex = /href="(\/[^\/]+\/[^\/]+\/releases\/download\/[^"]+\.(?:mrpack|zip))"/gi
            let m: RegExpExecArray | null
            while ((m = assetRegex.exec(html)) !== null) {
              const downloadUrl = `https://github.com${m[1]}`
              const filename = m[1].split('/').pop() || ''
              const tag = m[1].split('/')[4] || ''
              if (!versionsList.some((v) => v.id === downloadUrl)) {
                versionsList.push({
                  id: downloadUrl,
                  title: `${tag} - ${filename}`,
                })
              }
            }
          }
        } catch { }
      }

      // 3. Fallback: If no releases found, provide source zip archive
      if (versionsList.length === 0) {
        const defaultBranchZip = `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`
        versionsList.push({
          id: defaultBranchZip,
          title: `${selectedProjectName.value} (main branch)`,
        })
      }

      if (versionsList.length > 0) {
        selectedSource.value = 'github'
        availableVersions.value = versionsList
        selectedVersionId.value = versionsList[0]?.id
        showUrlDialog.value = false
        showVersionSelectDialog.value = true
        return
      }
    }

    // 5. Try handling via protocol URL
    const handled = await handleUrl(inputUrl)
    if (handled) {
      showUrlDialog.value = false
      quit()
      return
    }

    // 6. Direct download URL
    if (inputUrl.startsWith('http://') || inputUrl.startsWith('https://')) {
      await onSelectModpack(inputUrl)
      type.value = 'template'
      nextTick(() => {
        step.value = 1
      })
      showUrlDialog.value = false
    }
  } catch (e: any) {
    urlError.value = e?.message || String(e)
  } finally {
    urlLoading.value = false
  }
}

// Peer
const { notify } = useNotifier()

const { show: onMigrateFromOther } = useDialog('migrate-wizard')
</script>
