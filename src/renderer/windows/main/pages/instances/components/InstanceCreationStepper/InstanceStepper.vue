<template>
  <v-stepper v-model="step" dark>
    <v-stepper-header>
      <v-stepper-step :rules="[() => valid]" :editable="!creating" :complete="step > 1" step="1">
        {{ $t('profile.templateSetting') }}
        <small>{{ currentTemplate ? currentTemplate.title : '' }}</small>
      </v-stepper-step>
      <v-divider />
      <v-stepper-step
        :rules="[() => valid]"
        :editable="!creating"
        :complete="step > 2"
        step="2"
      >{{ $t('profile.baseSetting') }}</v-stepper-step>
      <v-divider />
      <!-- <v-stepper-step :complete="step > 2" step="2">{{ $t('profile.templateSetting.importing') }}</v-stepper-step> -->
    </v-stepper-header>

    <v-stepper-items>
      <v-stepper-content step="1" style="overflow: auto; max-height: 450px;">
        <template-content
          :preset="template"
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
      <v-stepper-content step="2" class="overflow-auto max-h-[70vh]">
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
    </v-stepper-items>
  </v-stepper>
</template>

<script lang=ts>
import { reactive, toRefs, computed, watch, defineComponent, ref, Ref, provide } from '@vue/composition-api'
import {
  useCurseforgeImport,
  useInstanceCreation,
  useInstances,
useRouter,
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
    const router = useRouter()
    const { mountInstance } = useInstances()
    const { importCurseforgeModpack } = useCurseforgeImport()

    provide(CreateOptionKey, creationData)

    const data = reactive({
      creating: false,
      step: 1,
      valid: false,
    })
    const java = ref(undefined as undefined | JavaRecord)
    const currentTemplate: Ref<InstanceTemplate | ModpackTemplate | undefined> = ref(undefined)

    const ready = computed(() => data.valid)

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
      context.emit('quit')
    }
    function onSelect(template: any) {
      data.step = 2
      currentTemplate.value = template
    }
    async function onCreate() {
      data.creating = true
      try {
        if (currentTemplate.value && currentTemplate.value.type === 'modpack') {
          importCurseforgeModpack({
            path: currentTemplate.value.path,
            instanceConfig: reactive(creationData),
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
        context.emit('create')

      } finally {
        data.creating = false
      }
    }
    watch(() => props.show, (v) => {
      if (!v) {
        deactivatedRef()
        return
      }
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
