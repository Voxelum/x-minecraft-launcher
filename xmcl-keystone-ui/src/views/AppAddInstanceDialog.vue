<template>
  <v-dialog
    v-model="isShown"
    data-testid="add-instance-dialog"
    width="900"
    :persistent="true"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <div class="flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center px-6 pt-6 pb-4">
        <div class="flex items-center gap-3 flex-grow">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style="background-color: rgba(var(--v-theme-primary), 0.12)"
          >
            <v-icon size="22" color="primary">add</v-icon>
          </div>
          <div class="text-base font-bold tracking-tight" style="color: rgba(var(--v-theme-on-surface), 0.9);">
            <template v-if="steps[step - 1] === 'config'">
              {{ t('instances.add') }}
            </template>
            <template v-if="steps[step - 1] === 'server'">
              {{ t('AppAddInstanceDialog.serverTitle') }}
            </template>
          </div>
        </div>
        <v-btn
          color="primary"
          variant="tonal"
          rounded="pill"
          size="small"
          @click="onMigrateFromOther"
        >
          <v-icon start size="16">local_shipping</v-icon>
          {{ t("setting.migrateFromOther") }}
        </v-btn>
      </div>

      <v-divider class="mx-6 opacity-20" />

      <v-window v-model="step" class="visible-scroll overflow-y-auto">
        <v-window-item
          v-for="(tStep, i) in steps"
          :key="tStep"
          class="max-h-[70vh]"
          :value="i + 1"
        >
          <StepConfig
            v-if="tStep === 'config'"
            :loading="loading"
            v-model:valid="valid"
          />
          <StepServer
            v-if="tStep === 'server'"
            v-model:valid="valid"
          />
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
        <div
          v-if="type === 'template' || type === 'manual' || !type"
          class="flex justify-end"
        >
          <v-btn
            data-testid="add-instance-import"
            :loading="loading"
            variant="text"
            rounded="pill"
            @click="onImportModpack"
          >
            <v-icon start>
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
            density="compact"
            variant="tonal"
            rounded="lg"
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
    </div>
  </v-dialog>
</template>

<script lang=ts setup>
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
import { CachedFTBModpackVersionManifest, InstanceManifest, ModpackServiceKey, PeerServiceKey, waitModpackFiles } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { kInstanceCreation, useInstanceCreation } from '../composables/instanceCreation'
import { AddInstanceDialogKey } from '../composables/instanceTemplates'

const type = ref(undefined as 'modrinth' | 'mmc' | 'server' | 'vanilla' | 'manual' | 'template' | 'prism' | undefined)

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

  step.value = 1
  type.value = 'template'
  valid.value = true

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
}, () => {
  if (loading.value) {
    return
  }
  setTimeout(() => {
    step.value = 1
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
  const newPath = await create((newPath) => {
    path.value = newPath
    if (router.currentRoute.value.path !== '/') router.push('/')
    hide()
  })
  if (newPath === path.value) {
    await fix().catch(() => { })
  }
}

// Stepper model
const valid = ref(false)
const step = ref(1)
const errorText = computed(() => t('errors.BadInstanceType', { type: type.value === 'mmc' ? 'MultiMC' : type.value === 'modrinth' ? 'Modrinth' : type.value === 'prism' ? 'PrismLauncher' : '' }))
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
        step.value = 1
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
