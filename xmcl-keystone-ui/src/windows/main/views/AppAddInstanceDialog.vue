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
          :editable="!creating"
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
          <template-content
            style="overflow: auto; max-height: 70vh; padding: 24px 24px 16px"
            :templates="templates"
            :value="selectedTemplate"
            @select="onSelect"
          />
          <stepper-footer
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
            <base-content :valid.sync="valid" />
            <advance-content :valid.sync="valid" />
          </div>
          <stepper-footer
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
          <stepper-modpack-content
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
import { Ref } from '@vue/composition-api'
import { InstanceFile, InstanceIOServiceKey, ModpackServiceKey, ResourceServiceKey } from '@xmcl/runtime-api'
import AdvanceContent from '../components/StepperAdvanceContent.vue'
import BaseContent from '../components/StepperBaseContent.vue'
import StepperFooter from '../components/StepperFooter.vue'
import StepperModpackContent from '../components/StepperModpackContent.vue'
import TemplateContent from '../components/StepperTemplateContent.vue'
import { useDialog } from '../composables/dialog'
import { AddInstanceDialogKey, Template, useAllTemplate } from '../composables/instanceAdd'
import { CreateOptionKey, useInstanceCreation } from '../composables/instanceCreation'
import { useNotifier } from '../composables/notifier'
import { useI18n, useRefreshable, useRouter, useService } from '/@/composables'

const { isShown, parameter, show: showAddInstance } = useDialog(AddInstanceDialogKey)
const { show } = useDialog('task')
const { create, reset, data: creationData } = useInstanceCreation()
const router = useRouter()
const { on } = useService(ResourceServiceKey)
const { importModpack } = useService(ModpackServiceKey)
const { applyInstanceFilesUpdate } = useService(InstanceIOServiceKey)
const { t } = useI18n()
const { notify } = useNotifier()
const { templates, apply, refresh, dispose } = useAllTemplate(creationData)

provide(CreateOptionKey, creationData)

const valid = ref(false)
const step = ref(2)
const selectedTemplate: Ref<Template | undefined> = ref(undefined)

const isModpackContentShown = computed(() => step.value === 3)
const selectedTemplateName = computed(() => selectedTemplate.value?.name ?? '')
const canPreview = computed(() => selectedTemplate.value?.source.type !== 'instance')

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
  if (selectedTemplate.value) {
    if (selectedTemplate.value.source.type === 'instance') {
      await create()
      router.push('/')
    } else if (selectedTemplate.value.source.type === 'ftb') {
      try {
        const path = await create()
        await applyInstanceFilesUpdate({
          path,
          updates: selectedTemplate.value.source.manifest.files.map(f => ({
            path: f.path + '/' + f.name,
            hashes: {
              sha1: f.sha1,
            },
            downloads: [f.url],
            size: f.size,
            createAt: f.updated,
            updateAt: f.updated,
          })),
        })
        notify({
          title: t('importModpack.success', { modpack: selectedTemplate.value?.name }),
          level: 'success',
          full: true,
          more() {
            router.push('/')
          },
        })
      } catch {
        notify({
          title: t('importModpack.failed', { modpack: selectedTemplate.value?.name }),
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
          path: selectedTemplate.value.source.resource.path,
          instanceConfig: { ...creationData },
          mountAfterSucceed: true,
        })
        notify({
          title: t('importModpack.success', { modpack: selectedTemplate.value?.name }),
          level: 'success',
          full: true,
          more() {
            router.push('/')
          },
        })
      } catch {
        notify({
          title: t('importModpack.failed', { modpack: selectedTemplate.value?.name }),
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

on('modpackImport', ({ path, name }) => {
  notify({
    level: 'success',
    title: t('downloadedNotification', { name }),
    full: true,
    more: () => {
      showAddInstance(path)
    },
  })
})

watch(isShown, (shown) => {
  if (creating.value) {
    return
  }
  if (!shown) {
    selectedTemplate.value = undefined
    dispose()
    reset()
    return
  }
  const p = parameter.value
  if (p) {
    refresh().then(() => {
      selectedTemplate.value = templates.value.find(t => t.id === p.toString())
    })
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

<i18n locale="en" lang="yaml">
downloadedNotification: The modpack {name} downloaded. Do you want to create instance for it?
</i18n>

<i18n locale="zh-CN" lang="yaml">
downloadedNotification: 整合包 {name} 下载成功。是否现在创建整合包实例？
</i18n>
