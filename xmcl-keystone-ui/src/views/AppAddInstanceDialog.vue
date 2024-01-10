<template>
  <v-dialog
    v-model="isShown"
    width="900"
    :persistent="!creating"
  >
    <v-toolbar
      elevation="4"
      class="px-1"
    >
      <v-btn
        icon
        :style="{ visibility: step === 1 ? 'hidden' : 'visible' }"
        @click="step -= 1"
      >
        <v-icon>arrow_back</v-icon>
      </v-btn>
      <v-toolbar-title>
        <div
          v-if="steps[step - 1] === 'template'"
        >
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
            v-if="tStep === 'create'"
            @select="onSelectType"
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
        :disabled="!valid || creating"
        :creating="creating"
        :next="step !== steps.length"
        :create="step === steps.length"
        @create="onCreate"
        @next="next"
        @quit="quit"
      >
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
import StepChoice from '@/components/StepChoice.vue'
import StepConfig from '@/components/StepConfig.vue'
import StepSelect from '@/components/StepSelect.vue'
import StepServer from '@/components/StepServer.vue'
import StepperFooter from '@/components/StepperFooter.vue'
import { useRefreshable, useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceVersionDiagnose } from '@/composables/instanceVersionDiagnose'
import { kInstances } from '@/composables/instances'
import { kPeerState } from '@/composables/peers'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'
import { CreateInstanceManifest, InstanceIOServiceKey, InstanceInstallServiceKey, PeerServiceKey } from '@xmcl/runtime-api'
import StepTemplate from '../components/StepTemplate.vue'
import { useDialog } from '../composables/dialog'
import { kInstanceCreation, useInstanceCreation } from '../composables/instanceCreation'
import { AddInstanceDialogKey } from '../composables/instanceTemplates'
import { useNotifier } from '../composables/notifier'

const type = ref(undefined as 'modrinth' | 'mmc' | 'server' | 'vanilla' | 'manual' | 'template' | undefined)
const manifests = ref([] as CreateInstanceManifest[])
const { getGameDefaultPath, parseInstanceFiles, parseInstances } = useService(InstanceIOServiceKey)
const updateData = async (man: CreateInstanceManifest) => {
  const options = man.options
  creationData.name = options.name
  creationData.description = options.description || ''
  creationData.java = options.java || ''
  creationData.runtime = { ...options.runtime } as any
  creationData.server = options.server ?? null
  creationData.maxMemory = options.maxMemory ?? 0
  creationData.minMemory = options.minMemory ?? 0
  creationData.showLog = options.showLog ?? false
  creationData.vmOptions = [...options.vmOptions ?? []]
  creationData.playTime = options.playTime ?? 0
  creationData.lastPlayedDate = options.lastPlayedDate ?? 0
  creationData.resolution = options.resolution ?? null
  creationData.icon = options.icon ?? ''
  creationData.upstream = options.upstream

  if (man.isIsolated) {
    try {
      loading.value = true
      files.value = await parseInstanceFiles(man.path, type.value as any)
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }
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

// Dialog model
const selectedTemplatePath = ref('')
provide('template', selectedTemplatePath)
const { isShown, show: showAddInstance, hide } = useDialog(AddInstanceDialogKey, (param) => {
  if (creating.value) {
    return
  }

  step.value = 1
  type.value = undefined
  valid.value = true

  windowController.focus()

  if (param && typeof param === 'string') {
    selectedTemplatePath.value = param
    type.value = 'template'
    nextTick(() => {
      step.value = 2
    })
  }
}, () => {
  if (creating.value) {
    return
  }
  setTimeout(() => {
    step.value = 1
    valid.value = true
    type.value = undefined
    error.value = undefined
    reset()
  }, 500)
})
watch(isShown, (v) => {
  if (v) {
    windowController.focus()
  }
})
function quit() {
  if (creating.value) return
  hide()
}

const { t } = useI18n()

// Instance create data
const { gameProfile } = injection(kUserContext)
const { instances } = injection(kInstances)
const { path } = injection(kInstance)
const { create, reset, data: creationData, files } = useInstanceCreation(gameProfile, instances)
const isInvalid = computed(() => {
  return creationData.name === '' || creationData.runtime.minecraft === '' || instances.value.some(i => i.name === creationData.name)
})

const error = ref(undefined as any)
const loading = ref(false)
provide(kInstanceCreation, { data: creationData, files, error, loading })

// Stepper model
const valid = ref(false)
const step = ref(1)

// Install
const { notify } = useNotifier()
const router = useRouter()
const { installInstanceFiles } = useService(InstanceInstallServiceKey)
const { fix } = injection(kInstanceVersionDiagnose)
const { refreshing: creating, refresh: onCreate } = useRefreshable(async () => {
  try {
    const newPath = await create()
    path.value = newPath
    if (router.currentRoute.path !== '/') router.push('/')
    reset()
    hide()
    if (files.value.length > 0) {
      await installInstanceFiles({
        path: newPath,
        files: files.value,
      }).catch((e) => {
        console.error(e)
      })
    }
    await fix().catch(() => {})
  } catch (e) {
    error.value = e
  }
})

function next() {
  if (step.value < steps.value.length) {
    step.value += 1
  }
}

const { on: onPeerService } = useService(PeerServiceKey)
const { connections } = injection(kPeerState)
onPeerService('share', (event) => {
  if (!event.manifest) {
    return
  }
  const conn = connections.value.find(c => c.id === event.id)
  if (conn) {
    notify({
      level: 'info',
      title: t('AppShareInstanceDialog.instanceShare', { user: conn.userInfo.name }),
      full: true,
      more() {
        if (!isShown.value) {
          showAddInstance(event.id)
        }
      },
    })
  }
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hide()
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
