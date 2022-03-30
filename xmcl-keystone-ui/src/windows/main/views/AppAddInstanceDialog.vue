<template>
  <v-dialog
    v-model="isShown"
    width="900"
    persistent
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
            {{ $t('profile.templateSetting') }}
            <small>{{ currentTemplate ? currentTemplate.title : '' }}</small>
          </div>
        </v-stepper-step>
        <v-divider />
        <v-stepper-step
          :rules="[() => valid]"
          :editable="!creating"
          :complete="step > 2"
          step="2"
        >
          {{ $t('profile.baseSetting') }}
        </v-stepper-step>
        <v-divider />
        <v-stepper-step
          :editable="currentTemplate && currentTemplate.type === 'modpack'"
          :complete="step > 2"
          step="3"
        >
          {{ $t('profile.templateSetting.preview') }}
        </v-stepper-step>
      </v-stepper-header>

      <v-stepper-items
        class="visible-scroll"
      >
        <v-stepper-content
          step="1"
          style="overflow: auto; max-height: 450px;"
        >
          <template-content
            :preset="presetTemplate"
            :value="currentTemplate"
            :on-activated="onActivated"
            :on-deactivated="onDeactivated"
            @select="onSelect"
          />
          <stepper-footer
            :disabled="creating"
            :creating="creating"
            next
            @next="step = 2"
            @quit="quit"
          />
        </v-stepper-content>
        <v-stepper-content
          step="2"
          class="overflow-auto max-h-[70vh] "
        >
          <base-content :valid.sync="valid" />
          <advance-content :valid.sync="valid" />
          <stepper-footer
            :disabled="!valid || name === '' || runtime.minecraft === ''"
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
            v-if="currentTemplate && currentTemplate.type === 'modpack'"
            :modpack="currentTemplate"
            :shown="isModpackContentShown"
          />
        </v-stepper-content>
      </v-stepper-items>
    </v-stepper>
  </v-dialog>
</template>

<script lang=ts>
import { Ref } from '@vue/composition-api'
import { InstanceData, InstanceServiceKey, JavaRecord, ModpackServiceKey } from '@xmcl/runtime-api'
import { useI18n, useRouter, useService } from '/@/composables'
import AdvanceContent from '../components/StepperAdvanceContent.vue'
import BaseContent from '../components/StepperBaseContent.vue'
import StepperFooter from '../components/StepperFooter.vue'
import StepperModpackContent from '../components/StepperModpackContent.vue'
import TemplateContent, { InstanceTemplate, ModpackTemplate } from '../components/StepperTemplateContent.vue'
import { DialogKey, useDialog } from '../composables/dialog'
import { useInstanceCreation, CreateOptionKey } from '../composables/instanceCreation'
import { useNotifier } from '../composables/notifier'

export const AddInstanceDialogKey: DialogKey<string> = 'add-instance-dialog'

export default defineComponent({
  components: {
    StepperFooter,
    BaseContent,
    AdvanceContent,
    TemplateContent,
    StepperModpackContent,
  },
  props: {
  },
  setup(props, context) {
    const { isShown, parameter } = useDialog(AddInstanceDialogKey)
    const { show } = useDialog('task')
    const { create, reset, ...creationData } = useInstanceCreation()
    const router = useRouter()
    const { mountInstance } = useService(InstanceServiceKey)
    const { importModpack } = useService(ModpackServiceKey)
    const { $t } = useI18n()
    const { notify } = useNotifier()

    provide(CreateOptionKey, creationData)

    const data = reactive({
      creating: false,
      step: 2,
      valid: false,
    })
    const java = ref(undefined as undefined | JavaRecord)
    const currentTemplate: Ref<InstanceTemplate | ModpackTemplate | undefined> = ref(undefined)

    const ready = computed(() => data.valid)
    const isModpackContentShown = computed(() => data.step === 3)

    let activateRef = () => { }
    let deactivatedRef = () => { }
    function onActivated(cb: () => void) {
      activateRef = cb
    }
    function onDeactivated(cb: () => void) {
      deactivatedRef = cb
    }
    function activate() {
      activateRef()
    }
    function quit() {
      if (data.creating) return
      isShown.value = false
    }
    function onSelect(template: any) {
      data.step = 2
      currentTemplate.value = template
    }
    async function onCreate() {
      data.creating = true
      try {
        if (currentTemplate.value && currentTemplate.value.type === 'modpack') {
          importModpack({
            path: currentTemplate.value.path,
            instanceConfig: reactive({ ...creationData }),
          }).then((path) => {
            mountInstance(path)
            notify({
              title: $t('profile.importModpack.success', { modpack: currentTemplate.value?.title }),
              level: 'success',
              full: true,
              more() {
                router.push('/')
              },
            })
          }, (e) => {
            notify({
              title: $t('profile.importModpack.failed', { modpack: currentTemplate.value?.title }),
              level: 'error',
              full: true,
              more() {
                show()
              },
            })
          })
          await new Promise((resolve) => {
            setTimeout(resolve, 1000)
          })
        } else {
          await create()
          router.push('/')
        }
        await new Promise((resolve) => {
          setTimeout(resolve, 1000)
        })

        isShown.value = false
      } finally {
        data.creating = false
      }
    }
    watch(isShown, (v) => {
      if (!v) {
        deactivatedRef()
        return
      }
      reset()
      data.step = 2
      data.creating = false
      data.valid = true
      activate()
    })
    const presetTemplate = computed(() => isShown.value ? parameter.value : undefined)
    return {
      ...toRefs(data),
      isModpackContentShown,
      ...creationData,
      isShown,
      presetTemplate,
      currentTemplate,
      onActivated,
      onDeactivated,
      onSelect,
      java,
      quit,
      onCreate,
      ready,
    }
  },
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
