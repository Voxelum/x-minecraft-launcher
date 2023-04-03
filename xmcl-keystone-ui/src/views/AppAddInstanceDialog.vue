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
          :editable="canPreview"
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
              :valid.sync="valid"
              @update:valid="valid = $event"
            />
            <AdvanceContent :valid.sync="valid" />
          </div>
          <StepperFooter
            style="padding: 16px 24px"
            :disabled="!valid || creationData.name === '' || creationData.runtime.minecraft === ''"
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
            v-if="canPreview"
            :modpack="selectedTemplate"
            :shown="isModpackContentShown"
          />
        </v-stepper-content>
      </v-stepper-items>
    </v-stepper>
  </v-dialog>
</template>

<script lang=ts setup>
import { Ref } from 'vue'
import { InstanceInstallServiceKey, ModpackServiceKey, PeerServiceKey, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import AdvanceContent from '../components/StepperAdvanceContent.vue'
import BaseContent from '../components/StepperBaseContent.vue'
import StepperFooter from '../components/StepperFooter.vue'
import StepperModpackContent from '../components/StepperModpackContent.vue'
import TemplateContent from '../components/StepperTemplateContent.vue'
import { useDialog } from '../composables/dialog'
import { AddInstanceDialogKey, Template, useAllTemplate } from '../composables/instanceAdd'
import { CreateOptionKey, useInstanceCreation } from '../composables/instanceCreation'
import { useNotifier } from '../composables/notifier'

import { useRefreshable, useService } from '@/composables'
import { getFTBPath } from '@/util/ftb'

const { isShown, dialog, show: showAddInstance } = useDialog(AddInstanceDialogKey)
const { show } = useDialog('task')
const { create, reset, data: creationData } = useInstanceCreation()
const router = useRouter()
const { on, removeListener } = useService(ResourceServiceKey)
const { importModpack } = useService(ModpackServiceKey)
const { installInstanceFiles } = useService(InstanceInstallServiceKey)
const { t } = useI18n()
const { notify } = useNotifier()
const { templates, apply, refresh, setup, dispose } = useAllTemplate(creationData)

provide(CreateOptionKey, creationData)

const valid = ref(false)
const step = ref(2)
const selectedTemplate: Ref<Template | undefined> = ref(undefined)

const isModpackContentShown = computed(() => step.value === 3)
const selectedTemplateName = computed(() => selectedTemplate.value?.name ?? '')
const canPreview = computed(() => selectedTemplate.value?.source && selectedTemplate.value?.source.type !== 'instance')

function quit() {
  if (creating.value) return
  isShown.value = false
}

function onSelect(template: Template) {
  selectedTemplate.value = template
}

watch(selectedTemplate, (newVal) => {
  if (newVal) {
    apply(newVal)
    step.value = 2
  }
})

const { refreshing: creating, refresh: onCreate } = useRefreshable(async () => {
  const template = selectedTemplate.value
  if (template) {
    if (template.source.type === 'instance') {
      await create()
      router.push('/')
    } else if (template.source.type === 'ftb') {
      try {
        const path = await create()
        await installInstanceFiles({
          path,
          files: template.source.manifest.files.map(f => ({
            path: getFTBPath(f),
            hashes: {
              sha1: f.sha1,
            },
            curseforge: f.curseforge
              ? {
                projectId: f.curseforge.project,
                fileId: f.curseforge.file,
              }
              : undefined,
            downloads: f.url ? [f.url] : undefined,
            size: f.size,
          })),
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
    } else if (template.source.type === 'peer') {
      try {
        const path = await create()
        await installInstanceFiles({
          path,
          files: template.source.manifest.files,
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
      try {
        await importModpack({
          path: template.source.resource.path,
          instanceConfig: { ...creationData },
          mountAfterSucceed: true,
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
    }
  } else {
    await create()
    router.push('/')
  }

  isShown.value = false
})

on('resourceAdd', (r) => {
  if (r.domain === ResourceDomain.Modpacks) {
    onModpackAdded({ path: r.path, name: r.name })
  }
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

const { on: onPeerService, state: peerState } = useService(PeerServiceKey)

onPeerService('share', (event) => {
  if (event.manifest) {
    const conn = peerState.connections.find(c => c.id === event.id)
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
    isShown.value = false
  }
})

watch(isShown, (shown) => {
  if (creating.value) {
    return
  }
  if (!shown) {
    setTimeout(() => {
      selectedTemplate.value = undefined
      dispose()
      reset()
    }, 500)
    return
  }
  setup().then(() => {
    const id = dialog.value.parameter
    if (id) {
      selectedTemplate.value = templates.value.find(t => t.id === id.toString())
    }
  })

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
