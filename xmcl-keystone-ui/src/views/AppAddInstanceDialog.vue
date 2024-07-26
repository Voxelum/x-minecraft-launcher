<template>
  <v-dialog
    v-model="isShown"
    width="900"
    :persistent="true"
  >
    <v-toolbar
      elevation="4"
      class="px-1"
    >
      <v-btn
        icon
        :style="{ visibility: step === 1 ? 'hidden' : 'visible' }"
        @click="back"
      >
        <v-icon>arrow_back</v-icon>
      </v-btn>
      <v-toolbar-title>
        <div v-if="steps[step - 1] === 'template'">
          {{ t('instanceTemplate.title') }}
        </div>
        <template v-if="steps[step - 1] === 'config'">
          {{ t('AppAddInstanceDialog.configTitle') }}
        </template>
        <template v-if="steps[step - 1] === 'choice'">
          {{ t('AppAddInstanceDialog.choiceTitle') }}
        </template>
        <template v-if="steps[step - 1] === 'create'">
          {{ t('AppAddInstanceDialog.createTitle') }}
        </template>
        <template v-if="steps[step - 1] === 'server'">
          {{ t('AppAddInstanceDialog.serverTitle') }}
        </template>
      </v-toolbar-title>
    </v-toolbar>

    <v-stepper v-model="step">
      <v-stepper-items class="visible-scroll overflow-y-auto">
        <v-stepper-content
          v-for="(tStep, i) in steps"
          :key="tStep"
          class="max-h-[70vh]"
          :step="i + 1"
        >
          <StepSelect
            v-if="tStep === 'create' && !loading"
            @select="onSelectType"
          />
          <AppLoadingCircular
            v-if="tStep === 'create' && loading"
            :texts="[t('instances.loadingFiles') + '...']"
          />
          <StepChoice
            v-if="tStep === 'choice'"
            :manifests="manifests"
            @select="onManifestSelect"
          />
          <StepTemplate
            v-if="tStep === 'template'"
            :is-shown="isShown"
            @select="next()"
          />
          <StepConfig
            v-if="tStep === 'config'"
            :valid.sync="valid"
          />
          <StepServer
            v-if="tStep === 'server'"
            :valid.sync="valid"
          />
        </v-stepper-content>
      </v-stepper-items>
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
        <div v-if="type === 'template' || type === 'manual' || !type">
          <v-btn
            text
            :loading="loading"
            @click="onImportModpack"
          >
            <v-icon left>
              note_add
            </v-icon>
            {{ t('importModpack.name') }}
          </v-btn>
        </div>
        <div
          v-if="error"
          class="pointer-events-none absolute left-0 flex w-full justify-center"
        >
          <v-alert
            dense
            class="w-[50%]"
            type="error"
          >
            {{ errorText ?? error }}
            <div>
              {{ error?.path }}
            </div>
          </v-alert>
        </div>
      </StepperFooter>
    </v-stepper>
  </v-dialog>
</template>

<script lang=ts setup>
import AppLoadingCircular from '@/components/AppLoadingCircular.vue'
import StepChoice from '@/components/StepChoice.vue'
import StepConfig from '@/components/StepConfig.vue'
import StepSelect from '@/components/StepSelect.vue'
import StepServer from '@/components/StepServer.vue'
import StepperFooter from '@/components/StepperFooter.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { kInstances } from '@/composables/instances'
import { kJavaContext } from '@/composables/java'
import { useNotifier } from '@/composables/notifier'
import { kPeerShared } from '@/composables/peers'
import { kUserContext } from '@/composables/user'
import { getFTBTemplateAndFile } from '@/util/ftb'
import { injection } from '@/util/inject'
import { resolveModpackInstanceConfig } from '@/util/modpackFilesResolver'
import { CachedFTBModpackVersionManifest, CreateInstanceManifest, InstanceIOServiceKey, InstanceManifest, ModpackServiceKey, PeerServiceKey, Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import StepTemplate from '../components/StepTemplate.vue'
import { useDialog } from '../composables/dialog'
import { kInstanceCreation, useInstanceCreation } from '../composables/instanceCreation'
import { AddInstanceDialogKey } from '../composables/instanceTemplates'

const type = ref(undefined as 'modrinth' | 'mmc' | 'server' | 'vanilla' | 'manual' | 'template' | undefined)
const manifests = ref([] as CreateInstanceManifest[])
const { getGameDefaultPath, parseInstanceFiles, parseInstances } = useService(InstanceIOServiceKey)
const updateData = async (man: CreateInstanceManifest) => {
  await update(
    man.options,
    man.isIsolated ? parseInstanceFiles(man.path, type.value as any) : Promise.resolve([]),
  )
}
const onManifestSelect = async (man: CreateInstanceManifest) => {
  updateData(man)
  nextTick().then(() => {
    step.value += 1
  })
}
const onSelectType = async (t: string) => {
  reset()
  error.value = undefined
  if (t === 'mmc' || t === 'vanilla' || t === 'modrinth') {
    const defaultPath = t === 'modrinth'
      ? await getGameDefaultPath('modrinth-instances')
      : t === 'vanilla' ? await getGameDefaultPath('vanilla') : undefined
    const dir = await windowController.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath,
    })
    if (dir.canceled) {
      return
    }
    const instancePath = dir.filePaths[0]
    const _manifests = await parseInstances(instancePath, t).catch((e) => {
      error.value = e
      return []
    })
    manifests.value = _manifests

    if (_manifests.length === 1) {
      updateData(_manifests[0])
    }
  }
  type.value = t as any
  if (!error.value) {
    nextTick().then(() => {
      step.value += 1
    })
  }
}

// Dialog model
const { getModpackInstallFiles } = useService(ModpackServiceKey)
const { all: javas } = injection(kJavaContext)
const onSelectResource = async (res: Resource) => {
  try {
    loading.value = true
    const config = resolveModpackInstanceConfig(res)
    if (!config) return
    await update(config, getModpackInstallFiles(res.path))
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}
const onSelectFTB = async (ftb: CachedFTBModpackVersionManifest) => {
  try {
    loading.value = true
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
    await update({
      name: man.name ?? '',
      description: man.description,
      minMemory: man.minMemory,
      maxMemory: man.maxMemory,
      vmOptions: man.vmOptions,
      mcOptions: man.mcOptions,
      runtime: man.runtime,
    }, Promise.resolve(man.files))
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

const { isShown, show, hide } = useDialog(AddInstanceDialogKey, (param) => {
  if (loading.value) {
    return
  }

  step.value = 1
  type.value = undefined
  valid.value = true

  windowController.focus()

  if (!param) return

  if (typeof param === 'object') {
    const after = () => {
      type.value = 'template'
      nextTick(() => {
        step.value = 3
      })
    }
    if (param.type === 'resource') {
      onSelectResource(param.resource).then(after)
    } else if (param.type === 'ftb') {
      onSelectFTB(param.manifest).then(after)
    } else if (param.type === 'manifest') {
      onSelectManifest(param.manifest).then(after)
    }
  }
}, () => {
  if (loading.value) {
    return
  }
  setTimeout(() => {
    step.value = 1
    valid.value = true
    type.value = undefined
    reset()
  }, 500)
})
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
const { fix } = injection(kInstanceVersionInstall)
const onCreate = async () => {
  await create((newPath) => {
    path.value = newPath
    if (router.currentRoute.path !== '/') router.push('/')
    hide()
  })
  await fix().catch(() => { })
}

// Stepper model
const valid = ref(false)
const step = ref(1)
const errorText = computed(() => t('errors.BadInstanceType', { type: type.value === 'mmc' ? 'MultiMC' : type.value === 'modrinth' ? 'Modrinth' : 'Minecraft' }))
const steps = computed(() => {
  if (type.value === 'template') {
    return ['create', 'template', 'config']
  }

  if (type.value === 'server') {
    return ['create', 'server', 'config']
  }

  if (type.value === 'mmc' || type.value === 'vanilla' || type.value === 'modrinth') {
    if (manifests.value.length > 1) {
      return ['create', 'choice', 'config']
    }
  }

  return ['create', 'config']
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
  if (step.value === 1) {
    type.value = undefined
  }
}

// Manuall import
const { importResources } = useService(ResourceServiceKey)
const onImportModpack = () => {
  windowController.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: t('modpack.name', 2), extensions: ['zip', 'mrpack'] }],
  }).then(async (res) => {
    if (res.canceled) return
    const file = res.filePaths[0]
    try {
      loading.value = true
      const [result] = await importResources([{ path: file, domain: ResourceDomain.Modpacks }])
      if (result) {
        await onSelectResource(result)
        type.value = 'template'
        nextTick(() => {
          step.value = 3
        })
      }
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  })
}

// Peer
const { on: onPeerService } = useService(PeerServiceKey)
const { notify } = useNotifier()
const { connections } = injection(kPeerShared)
onPeerService('share', (event) => {
  if (!event.manifest) {
    return
  }
  const conn = connections.value.find(c => c.id === event.id)
  if (conn) {
    notify({
      level: 'info',
      title: t('AppShareInstanceDialog.instanceShare', { user: conn.userInfo.name }),
      more() {
        if (!isShown.value && event.manifest) {
          show({ type: 'manifest', manifest: event.manifest })
        }
      },
    })
  }
})

</script>

<style>
.v-stepper__content {
  padding: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.v-stepper__wrapper {
  display: flex;
  flex-direction: column;
}

.v-stepper__step span {
  margin-right: 12px !important;
}

.v-stepper__step div {
  display: flex !important;
}
</style>
