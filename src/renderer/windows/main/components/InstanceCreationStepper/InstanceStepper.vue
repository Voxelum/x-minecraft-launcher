<template>
  <v-stepper
    v-model="step"
    dark
  >
    <v-stepper-header>
      <v-stepper-step
        :rules="[() => valid]"
        :editable="!isImporting"
        :complete="step > 0"
        step="0"
      >
        {{ $t('profile.templateSetting') }}
      </v-stepper-step>
      <v-divider />
      <v-stepper-step
        :rules="[() => valid]"
        :editable="!isImporting"
        :complete="step > 1"
        step="1"
      >
        {{ $t('profile.baseSetting') }}
      </v-stepper-step>
      <v-divider />
      <v-stepper-step
        :editable="!isImporting"
        :complete="step > 2"
        step="2"
      >
        {{ $t('profile.advancedSetting') }}
        <small>{{ $t('optional') }}</small>
      </v-stepper-step>
      <v-divider />
      <v-stepper-step
        :complete="step > 3"
        step="3"
      >
        {{ $t('profile.templateSetting.importing') }}
      </v-stepper-step>
    </v-stepper-header>

    <v-stepper-items>
      <v-stepper-content
        step="0"
        style="overflow: auto; max-height: 450px;"
      >
        <template-content
          :preset="template"
          :value="currentTemplate"
          :on-activated="onActivated"
          @select="onSelect"
        />
        <stepper-footer
          :disabled="creating"
          :creating="creating"
          next
          @next="step = 1"
          @quit="quit"
        />
      </v-stepper-content>
      <v-stepper-content step="1">
        <base-content
          :valid.sync="valid"
        />
        <stepper-footer
          :disabled="!valid || name === '' || runtime.minecraft === ''"
          :creating="creating"
          next
          @next="step = 2"
          @quit="quit"
        />
      </v-stepper-content>
      <v-stepper-content step="2">
        <advance-content
          :valid.sync="valid"
        />
        <stepper-footer
          :disabled="!valid || name === '' || runtime.minecraft === ''"
          :creating="creating"
          create
          @create="onCreate"
          @quit="quit"
        />
      </v-stepper-content>
      <v-stepper-content step="3">
        <task-focus
          v-if="!error"
          :value="importTask"
        />
        <div v-else>
          {{ error }}
        </div>
        <v-btn
          flat
          :disabled="creating"
          @click="quit"
        >
          {{ $t('cancel') }}
        </v-btn>
      </v-stepper-content>
    </v-stepper-items>
  </v-stepper>
</template>

<script lang=ts>
import { reactive, toRefs, computed, watch, defineComponent, ref, Ref, provide } from '@vue/composition-api'
import {
  useCurseforgeImport,
  useInstanceCreation,
  useInstances,
} from '/@/hooks'
import { JavaRecord } from '/@shared/entities/java'
import { optional, withDefault } from '/@/util/props'
import { CreateOptionKey } from './creation'
import StepperFooter from './StepperFooter.vue'
import AdvanceContent from './AdvanceContent.vue'
import BaseContent from './BaseContent.vue'
import TemplateContent, { InstanceTemplate, ModpackTemplate } from './TemplateContent.vue'

export default defineComponent({
  components: {
    StepperFooter,
    BaseContent,
    AdvanceContent,
    TemplateContent,
  },
  props: {
    show: withDefault(Boolean, () => false),
    template: optional(String),
  },
  setup(props, context) {
    const { create, reset, ...creationData } = useInstanceCreation()
    const { mountInstance } = useInstances()
    const { importCurseforgeModpack } = useCurseforgeImport()

    provide(CreateOptionKey, creationData)

    const data = reactive({
      creating: false,
      step: 1,
      valid: false,
      error: undefined as any,
    })
    const importTask: Ref<Promise<string> | null> = ref(null)
    const java = ref(undefined as undefined | JavaRecord)
    const currentTemplate: Ref<InstanceTemplate | ModpackTemplate | undefined> = ref(undefined)

    const isImporting = computed(() => !!importTask.value)
    const ready = computed(() => data.valid)

    let activateRef = () => {}
    function onActivated(cb: () => void) {
      activateRef = cb
    }
    function activate() {
      activateRef()
    }
    function quit() {
      if (data.creating) return
      context.emit('quit')
    }
    function onSelect(template: any) {
      data.step = 1
      template.value = template
    }
    async function onCreate() {
      data.creating = true
      try {
        if (currentTemplate.value && currentTemplate.value.type === 'modpack') {
          data.step = 3
          importTask.value = importCurseforgeModpack({
            path: currentTemplate.value.path,
          })
          await mountInstance(await importTask.value)
        } else {
          await create()
        }
        await new Promise((resolve) => {
          setTimeout(resolve, 1000)
        })
        context.emit('create')
      } catch (e) {
        data.error = e
      } finally {
        data.creating = false
      }
    }
    watch(() => props.show, (v) => {
      if (!v) return
      reset()
      activate()
      data.step = 1
      data.creating = false
      data.valid = true
    })
    return {
      ...toRefs(data),
      ...creationData,
      currentTemplate,
      onActivated,
      onSelect,
      java,
      importTask,
      isImporting,
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
