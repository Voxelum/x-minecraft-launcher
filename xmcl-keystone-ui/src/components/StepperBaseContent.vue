<template>
  <v-form
    lazy-validation
    style="height: 100%;"
    :value="valid"
    @input="onUpdate"
  >
    <v-list
      three-line
      subheader
      style="background: transparent; width: 100%"
    >
      <v-list-item>
        <div class="mt-4 flex gap-4">
          <v-flex
            d-flex
            xs3
          >
            <v-text-field
              v-model="content.name"
              outlined
              persistent-hint
              :hint="t('instance.nameHint')"
              :label="t('name')"
              :rules="nameRules"
              required
            />
          </v-flex>
          <v-flex
            d-flex
            xs3
          >
            <v-text-field
              v-model="content.author"
              outlined
              persistent-hint
              :hint="t('modpack.authorHint')"
              :label="t('author')"
              required
            />
          </v-flex>
          <v-flex d-flex>
            <v-text-field
              v-model="content.description"
              outlined
              persistent-hint
              :hint="t('modpack.descriptionHint')"
              :label="t('description')"
            />
          </v-flex>
        </div>
      </v-list-item>
    </v-list>
  </v-form>
</template>

<script lang=ts setup>
import { kInstances } from '@/composables/instances'
import { injection } from '@/util/inject'
import { required } from '@/util/props'
import { kInstanceCreation } from '../composables/instanceCreation'

defineProps({
  valid: required(Boolean),
})
const emit = defineEmits(['update:valid'])
const { t } = useI18n()
const content = inject(kInstanceCreation)
const { instances } = injection(kInstances)
if (!content) {
  throw new Error('Cannot use without providing CreateOption!')
}
const nameRules = computed(() => [
  (v: any) => !!v || t('instance.requireName'),
  (v: any) => !instances.value.some(i => i.name === v) || t('instance.duplicatedName'),
])

const onUpdate = ($event: any) => {
  emit('update:valid', $event)
}
</script>
