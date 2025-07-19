<template>
  <div style="overflow: auto; max-height: 70vh; padding: 24px 24px 16px">
    <v-form
      v-model="valid"
      style="height: 100%;"
    >
      <v-list
        lines="three"
        style="background: transparent; width: 100%"
      >
        <v-list-item>
          <div class="mt-4 grid grid-cols-4 gap-4">
            <v-text-field
              v-model="content.name"
              variant="outlined"
              persistent-hint
              :hint="t('instance.nameHint')"
              :label="t('name')"
              :rules="nameRules"
              required
            />
            <v-text-field
              v-model="content.author"
              variant="outlined"
              persistent-hint
              :hint="t('modpack.authorHint')"
              :label="t('author')"
              required
            />
            <v-text-field
              v-model="content.description"
              class="col-span-2"
              variant="outlined"
              persistent-hint
              :hint="t('modpack.descriptionHint')"
              :label="t('description')"
            />
          </div>
        </v-list-item>
      </v-list>
    </v-form>
    <StepperAdvanceContent v-model:valid="valid" />
  </div>
</template>

<script lang=ts setup>
import { kInstances } from '@/composables/instances'
import { injection } from '@/util/inject'
import { kInstanceCreation } from '../composables/instanceCreation'
import StepperAdvanceContent from './StepperAdvanceContent.vue'

defineModel('valid', {
  type: Boolean,
  default: true,
  required: true,
})
const { t } = useI18n()
const { data: content } = injection(kInstanceCreation)
const { instances } = injection(kInstances)
const nameRules = computed(() => [
  (v: any) => !!v || t('instance.requireName'),
  (v: any) => !instances.value.some(i => i.name === v) || t('instance.duplicatedName'),
])

</script>
