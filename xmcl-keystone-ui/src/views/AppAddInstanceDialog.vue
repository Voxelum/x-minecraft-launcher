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
      <v-toolbar-title
        class="flex! items-center"
        :text="titleTexts[steps[step - 1]]"
      />
      <template #append>
        <v-btn
          variant="outlined"
          color="primary"
          @click="onMigrateFromOther"
        >
          <v-icon start>
            local_shipping
          </v-icon>
          {{ t("setting.migrateFromOther") }}
        </v-btn>
      </template>
    </v-toolbar>

    <v-stepper v-model="step">
      <template #default="{ next }">
        <v-stepper-window
          v-model="step"
          class="my-0!"
        >
          <v-stepper-window-item
            v-for="(tStep, i) of steps"
            :key="`${tStep}-content`"
            :value="i + 1"
          >
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
              v-model:valid="valid"
              :loading="loading"
            />
            <StepServer
              v-if="tStep === 'server'"
              v-model:valid="valid"
            />
          </v-stepper-window-item>
        </v-stepper-window>
        <v-divider />
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
          <div
            v-if="type === 'template' || type === 'manual' || !type"
            class="flex justify-end"
          >
            <v-menu
              open-on-hover
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  variant="outlined"
                  :loading="loading"
                  v-bind="props"
                  @click="onImportModpack"
                >
                  <v-icon start>
                    note_add
                  </v-icon>
                  {{ t('importModpack.name') }}
                </v-btn>
              </template>
              <v-btn
                size="large"
                :loading="loading"
                @click="onSelectTemplate"
              >
                <v-icon start>
                  list
                </v-icon>
                {{ t('instances.addTemplate') }}
              </v-btn>
            </v-menu>
          </div>
          <div
            v-if="error"
            class="pointer-events-none absolute left-0 flex w-full justify-center"
          >
            <v-alert
              density="compact"
              class="w-[50%]"
              type="error"
            >
              {{ errorText }}
              <div>
                {{ error?.path }}
              </div>
            </v-alert>
          </div>
        </StepperFooter>
      </template>
    </v-stepper>
  </v-dialog>
</template>

<script lang=ts setup>
import AppLoadingCircular from '@/components/AppLoadingCircular.vue'
import StepChoice from '@/components/StepChoice.vue'
import StepConfig from '@/components/StepConfig.vue'
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
import { CachedFTBModpackVersionManifest, CreateInstanceManifest, InstanceIOServiceKey, InstanceManifest, ModpackServiceKey, PeerServiceKey, waitModpackFiles } from '@xmcl/runtime-api'
import StepTemplate from '../components/StepTemplate.vue'
import { useDialog } from '../composables/dialog'
import { kInstanceCreation, useInstanceCreation } from '../composables/instanceCreation'
import { AddInstanceDialogKey } from '../composables/instanceTemplates'

const type = ref(undefined as 'modrinth' | 'mmc' | 'server' | 'vanilla' | 'manual' | 'template' | undefined)
const manifests = ref([] as CreateInstanceManifest[])
const { parseInstanceFiles } = useService(InstanceIOServiceKey)
const onManifestSelect = async (man: CreateInstanceManifest) => {
  update(
    man.options,
    man.isIsolated ? parseInstanceFiles(man.path, type.value as any) : Promise.resolve([]),
  )
  nextTick().then(() => {
    step.value += 1
  })
}

// Dialog model
const { openModpack } = useService(ModpackServiceKey)
const { all: javas } = injection(kJavaContext)
const onSelectModpack = async (modpack: string) => {
  try {
    loading.value = true
    const openedModpack = await openModpack(modpack)
    await update(openedModpack.config, waitModpackFiles(openedModpack))
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

  step.value = 2
  type.value = 'template'
  valid.value = true

  windowController.focus()

  if (!param) return

  if (typeof param === 'object') {
    const after = () => {
      type.value = 'template'
      nextTick(() => {
        step.value = 2
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
}, () => {
  if (loading.value) {
    return
  }
  setTimeout(() => {
    step.value = 2
    valid.value = true
    type.value = 'template'
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

const titleTexts = computed(() => ({
  template: t('instanceTemplate.title'),
  config: t('instances.add'),
  choice: t('AppAddInstanceDialog.choiceTitle'),
  create: t('AppAddInstanceDialog.createTitle'),
  server: t('AppAddInstanceDialog.serverTitle'),
} as Record<string, string>))


// Instance create data
const { gameProfile } = injection(kUserContext)
const { instances } = injection(kInstances)
const { path } = injection(kInstance)
const creation = useInstanceCreation(gameProfile, instances)
const { create, reset, error, update, loading } = creation
provide(kInstanceCreation, creation)

// Install
const { currentRoute, push } = useRouter()
const { fix } = injection(kInstanceVersionInstall)
const onCreate = async () => {
  const newPath = await create((newPath) => {
    path.value = newPath
    if (currentRoute.value.path !== '/') push('/')
    hide()
  })
  if (newPath === path.value) {
    await fix().catch(() => { })
  }
}

// Stepper model
const valid = ref(false)
const step = ref(1)
const errorText = computed(() => t('errors.BadInstanceType', { type: type.value === 'mmc' ? 'MultiMC' : type.value === 'modrinth' ? 'Modrinth' : 'Minecraft' }))
const steps = computed(() => {
  if (type.value === 'template') {
    return ['template', 'config']
  }

  if (type.value === 'server') {
    return ['server', 'config']
  }

  return ['config']
})
// function next() {
//   if (step.value < steps.value.length) {
//     step.value += 1
//   }
// }
function back() {
  if (step.value > 1) {
    step.value -= 1
  }
}

function onSelectTemplate() {
  type.value = 'template'
  step.value = 2

  nextTick(() => {
    step.value = 1
  })
}

// Manuall import
const onImportModpack = () => {
  windowController.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: t('modpack.name', 2), extensions: ['zip', 'mrpack'] }],
  }).then(async (res) => {
    if (res.canceled) return
    const file = res.filePaths[0]
    try {
      loading.value = true
      await onSelectModpack(file)
      type.value = 'template'
      nextTick(() => {
        step.value = 2
      })
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
          show({ format: 'manifest', manifest: event.manifest })
        }
      },
    })
  }
})

const { show: onMigrateFromOther } = useDialog('migrate-wizard')
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
