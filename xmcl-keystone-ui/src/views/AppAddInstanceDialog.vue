<template>
  <v-dialog
    v-model="isShown"
    width="900"
    :persistent="!creating"
  >
    <v-stepper
      v-model="step"
    >
      <v-stepper-header>
        <v-stepper-step
          :rules="[() => valid]"
          :editable="!creating"
          :complete="step > 1"
          step="1"
        >
          <div class="flex flex-col gap-1">
            {{ t('instanceTemplate.title') }}
            <small>{{ selectedTemplateName }}</small>
          </div>
        </v-stepper-step>
        <v-divider />
        <v-stepper-step
          :rules="[() => valid]"
          editable
          :complete="step > 2"
          step="2"
        >
          {{ t('baseSetting.title') }}
        </v-stepper-step>
        <v-divider />
        <v-stepper-step
          editable
          :complete="step > 2"
          step="3"
        >
          {{ t('instanceTemplate.preview') }}
        </v-stepper-step>
      </v-stepper-header>

      <v-stepper-items
        class="visible-scroll"
      >
        <v-stepper-content
          step="1"
          class="p-0"
        >
          <TemplateContent
            style="overflow: auto; max-height: 70vh; padding: 24px 24px 16px"
            :loading="refreshing"
            :templates="templates"
            :value="selectedTemplate"
            @select="onSelect"
          />
          <StepperFooter
            style="padding: 16px 24px"
            :disabled="creating"
            :creating="creating"
            next
            @next="step = 2"
            @quit="quit"
          />
        </v-stepper-content>
        <v-stepper-content
          step="2"
          class="p-0"
        >
          <div
            style="overflow: auto; max-height: 70vh; padding: 24px 24px 16px"
          >
            <BaseContent
              :valid="valid"
              @update:valid="valid = $event"
            />
            <AdvanceContent :valid.sync="valid" />
          </div>
          <StepperFooter
            style="padding: 16px 24px"
            :disabled="!valid || isInvalid"
            :creating="creating"
            create
            @create="onCreate"
            @quit="quit"
          />
        </v-stepper-content>
        <v-stepper-content
          step="3"
          class="overflow-auto max-h-[70vh]"
        >
          <StepperModpackContent
            :modpack="selectedTemplate"
            :shown="isModpackContentShown"
          />
        </v-stepper-content>
      </v-stepper-items>
    </v-stepper>
  </v-dialog>
</template>

<script lang=ts setup>
import { InstanceInstallServiceKey, PeerServiceKey, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import AdvanceContent from '../components/StepperAdvanceContent.vue'
import BaseContent from '../components/StepperBaseContent.vue'
import StepperFooter from '../components/StepperFooter.vue'
import StepperModpackContent from '../components/StepperModpackContent.vue'
import TemplateContent from '../components/StepperTemplateContent.vue'
import { useDialog } from '../composables/dialog'
import { AddInstanceDialogKey, Template, useAllTemplate } from '../composables/instanceAdd'
import { kInstanceCreation, useInstanceCreation } from '../composables/instanceCreation'
import { useNotifier } from '../composables/notifier'
import { useRefreshable, useService } from '@/composables'
import { kJavaContext } from '@/composables/java'
import { injection } from '@/util/inject'
import { kModpacks } from '@/composables/modpack'
import { kUserContext } from '@/composables/user'
import { kLocalVersions } from '@/composables/versionLocal'
import { kInstances } from '@/composables/instances'
import { kPeerState } from '@/composables/peers'
import { kInstance } from '@/composables/instance'

const { isShown, dialog, show: showAddInstance, hide } = useDialog(AddInstanceDialogKey)
const { show } = useDialog('task')
const { gameProfile } = injection(kUserContext)
const { versions } = injection(kLocalVersions)
const { instances } = injection(kInstances)
const { path } = injection(kInstance)
const { create, reset, data: creationData } = useInstanceCreation(gameProfile, versions, instances, path)
const router = useRouter()

const { on, removeListener } = useService(ResourceServiceKey)
const { installInstanceFiles } = useService(InstanceInstallServiceKey)
const { t } = useI18n()
const { notify } = useNotifier()
const { all } = injection(kJavaContext)
const { resources } = injection(kModpacks)
const { connections } = injection(kPeerState)
const { templates, refreshing } = useAllTemplate(all, resources, connections)

provide(kInstanceCreation, creationData)

const valid = ref(false)
const step = ref(2)
const selectedTemplatePath = ref('')

const selectedTemplate = computed(() => templates.value.find(f => f.filePath === selectedTemplatePath.value))
const isModpackContentShown = computed(() => step.value === 3)
const selectedTemplateName = computed(() => selectedTemplate.value?.name ?? '')

function quit() {
  if (creating.value) return
  hide()
}

function onSelect(template: Template) {
  selectedTemplatePath.value = template.filePath
}

watch(selectedTemplate, (t) => {
  if (!t) return
  const instData = t.instance
  creationData.name = instData.name
  creationData.runtime = { ...instData.runtime }
  creationData.java = instData.java ?? ''
  creationData.showLog = instData.showLog ?? false
  creationData.hideLauncher = instData.hideLauncher ?? true
  creationData.vmOptions = [...instData.vmOptions ?? []]
  creationData.mcOptions = [...instData.mcOptions ?? []]
  creationData.maxMemory = instData.maxMemory ?? 0
  creationData.minMemory = instData.minMemory ?? 0
  creationData.author = instData.author ?? ''
  creationData.description = instData.description ?? ''
  creationData.url = instData.url ?? ''
  creationData.icon = instData.icon ?? ''
  creationData.modpackVersion = instData.modpackVersion || ''
  creationData.server = instData.server ? { ...instData.server } : null
  creationData.upstream = instData.upstream
  step.value = 2
})

const isInvalid = computed(() => {
  return creationData.name === '' || creationData.runtime.minecraft === '' || instances.value.some(i => i.name === creationData.name)
})

const { refreshing: creating, refresh: onCreate } = useRefreshable(async () => {
  const template = selectedTemplate.value
  if (template) {
    try {
      const resultInstancePath = await create()
      router.push('/')
      await installInstanceFiles({
        path: resultInstancePath,
        files: template.files,
      })
      notify({
        title: t('importModpack.success', { modpack: template?.name }),
        level: 'success',
        full: true,
        more() {
          router.push('/')
        },
      })
    } catch {
      notify({
        title: t('importModpack.failed', { modpack: template?.name }),
        level: 'error',
        full: true,
        more() {
          show()
        },
      })
    }
  } else {
    await create()
    router.push('/')
  }

  hide()
})

const listener: any = undefined
onMounted(() => {
  on('resourceAdd', (r) => {
    if (r.domain === ResourceDomain.Modpacks) {
      onModpackAdded({ path: r.path, name: r.name })
    }
  })
})
onUnmounted(() => {
  removeListener('resourceAdd', listener)
})

const onModpackAdded = ({ path, name }: { path: string; name: string }) => {
  setTimeout(() => {
    if (!isShown.value) {
      notify({
        level: 'success',
        title: t('AppAddInstanceDialog.downloadedNotification', { name }),
        full: true,
        more: () => {
          showAddInstance(path)
        },
      })
    }
  }, 100)
}

const { on: onPeerService } = useService(PeerServiceKey)

onPeerService('share', (event) => {
  if (event.manifest) {
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
  }
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hide()
  }
})

watch(isShown, (shown) => {
  if (creating.value) {
    return
  }
  if (!shown) {
    setTimeout(() => {
      selectedTemplatePath.value = ''
      reset()
    }, 500)
    return
  }
  const id = dialog.value.parameter
  if (id) {
    selectedTemplatePath.value = id
  }

  step.value = 2
  valid.value = true
})
</script>

<style>
.v-stepper__step span {
  margin-right: 12px !important;
}
.v-stepper__step div {
  display: flex !important;
}
</style>
