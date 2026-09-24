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
        :disabled="!valid || loading || !creation.canCreate.value"
        :creating="loading"
        :next="step !== steps.length"
        :create="step === steps.length"
        @create="onCreate"
        @next="next"
        @quit="quit"
      >
        <div v-if="type === 'template' || type === 'manual' || !type" class="flex justify-end">
          <v-menu
            location="top end"
            :offset="10"
            transition="slide-y-reverse-transition"
          >
            <template #activator="{ props }">
              <v-btn
                data-testid="add-instance-import"
                v-bind="props"
                :loading="loading"
                variant="tonal"
                color="primary"
                rounded="pill"
                class="font-semibold shadow-sm hover:shadow-md transition-all"
              >
                <v-icon start> folder_zip </v-icon>
                {{ t('importModpack.name') }}
                <v-icon end> arrow_drop_down </v-icon>
              </v-btn>
            </template>
            <div class="surface-card rounded-2xl p-2 min-w-[320px] shadow-2xl flex flex-col gap-1.5 backdrop-blur-xl">
              <div
                data-testid="add-instance-import-file"
                class="surface-card-row flex items-center p-3 rounded-xl gap-3 cursor-pointer group"
                @click="onImportModpack"
              >
                <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15 text-primary transition-transform group-hover:scale-105">
                  <v-icon size="22">folder_zip</v-icon>
                </div>
                <div class="flex flex-col flex-grow min-w-0">
                  <div class="text-sm font-semibold tracking-tight leading-snug">
                    {{ t('importModpack.fromFile') }}
                  </div>
                  <div class="text-xs opacity-65 leading-tight mt-0.5">
                    {{ t('importModpack.fromFileSubtitle') }}
                  </div>
                </div>
                <div class="flex gap-1 flex-shrink-0">
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 opacity-75 font-mono">.zip</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono">.mrpack</span>
                </div>
              </div>

              <div
                data-testid="add-instance-import-url"
                class="surface-card-row flex items-center p-3 rounded-xl gap-3 cursor-pointer group"
                @click="openUrlDialog"
              >
                <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-secondary/15 text-secondary transition-transform group-hover:scale-105">
                  <v-icon size="22">link</v-icon>
                </div>
                <div class="flex flex-col flex-grow min-w-0">
                  <div class="text-sm font-semibold tracking-tight leading-snug flex items-center gap-1.5">
                    <span>{{ t('importModpack.fromUrl') }}</span>
                  </div>
                  <div class="text-xs opacity-65 leading-tight mt-0.5">
                    {{ t('importModpack.fromUrlSubtitle') }}
                  </div>
                </div>
                <div class="flex items-center flex-shrink-0">
                  <span class="text-[11px] px-2 py-0.5 rounded-md bg-white/10 border border-white/10 font-mono opacity-80 flex items-center gap-0.5 shadow-sm">
                    Ctrl+V
                  </span>
                </div>
              </div>
            </div>
          </v-menu>
        </div>
        <div v-if="error" class="pointer-events-none left-0 flex w-full justify-center">
          <v-alert density="compact" variant="tonal" rounded="lg" class="w-[50%]" type="error">
            {{ errorText }}
          </v-alert>
        </div>
      </StepperFooter>
    </div>

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
import { ImportUrlDialogKey } from '@/composables/modpackPaste'
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

// Instance create data
const { t } = useI18n()
const { gameProfile } = injection(kUserContext)
const { instances } = injection(kInstances)
const { path } = injection(kInstance)
const creation = useInstanceCreation(gameProfile, instances)
const { create, reset, error, update, loading } = creation
provide(kInstanceCreation, creation)

// Dialog model
const { openModpack } = useService(ModpackServiceKey)
const { all: javas } = injection(kJavaContext)
// The modpack file currently loaded into the creation form (if any), and the
// existing instance that already corresponds to it. Used to offer updating the
// existing instance instead of always creating a new one.
const modpackFilePath = ref('')
const existingInstance = ref(undefined as { path: string; name: string } | undefined)
const onSelectModpack = async (modpack: string) => {
  creation.prepareImport()
  try {
    loading.value = true
    existingInstance.value = undefined
    modpackFilePath.value = modpack
    const openedModpack = await openModpack(modpack)
    if (openedModpack.error) {
      error.value = openedModpack.error
    }
    if (openedModpack.config) {
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
  creation.prepareImport()
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

const { show: showImportUrl } = useDialog(ImportUrlDialogKey)
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
      } else if (param.format === 'url' || 'url' in param) {
        hide()
        showImportUrl(param)
        return
      }
    } else if (typeof param === 'string' && (param.startsWith('http://') || param.startsWith('https://') || param.startsWith('curseforge://') || param.startsWith('modrinth://') || param.startsWith('technic://'))) {
      hide()
      showImportUrl(param)
      return
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
  }).catch(() => undefined)
  if (!newPath) return
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
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
    hide()
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

function openUrlDialog() {
  hide()
  showImportUrl()
}

// Peer
const { notify } = useNotifier()

const { show: onMigrateFromOther } = useDialog('migrate-wizard')
</script>
