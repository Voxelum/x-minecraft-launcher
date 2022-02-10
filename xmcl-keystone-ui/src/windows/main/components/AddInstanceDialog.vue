<template>
  <v-dialog
    v-model="isShown"
    width="900"
    persistent
  >
    <v-stepper
      v-model="step"
      dark
    >
      <v-stepper-header>
        <v-stepper-step
          :rules="[() => valid]"
          :editable="!creating"
          :complete="step > 1"
          step="1"
        >
          {{ $t('profile.templateSetting') }}
          <small>{{ currentTemplate ? currentTemplate.title : '' }}</small>
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

      <v-stepper-items>
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
          class="overflow-auto max-h-[70vh]"
        >
          <!-- <v-list-tile-title> -->
          <!-- {{ $t('profile.baseSetting') }} -->
          <!-- </v-list-tile-title> -->
          <!-- <v-list-tile-title> -->
          <!-- {{ $t('profile.advancedSetting') }} -->
          <!-- </v-list-tile-title> -->
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
import { computed, defineComponent, InjectionKey, provide, reactive, ref, Ref, toRefs, watch } from '@vue/composition-api'
import AdvanceContent from './StepperAdvanceContent.vue'
import BaseContent from './StepperBaseContent.vue'
import StepperFooter from './StepperFooter.vue'
import StepperModpackContent from './StepperModpackContent.vue'
import TemplateContent, { InstanceTemplate, ModpackTemplate } from './StepperTemplateContent.vue'
import {
  useModpackImport,
  useInstanceCreation,
  useInstances,
  useRouter,
} from '/@/hooks'
import { DialogKey, useDialog } from '/@/windows/main/composables'
import { InstanceData, JavaRecord } from '@xmcl/runtime-api'

type ToRefs<T> = {
  [K in keyof T]: Ref<T[K]>
}

export const CreateOptionKey: InjectionKey<ToRefs<InstanceData>> = Symbol('CreateOption')

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
    const { create, reset, ...creationData } = useInstanceCreation()
    const router = useRouter()
    const { mountInstance } = useInstances()
    const { importModpack } = useModpackImport()

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
          }).then((path) => mountInstance(path))
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
