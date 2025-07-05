<template>
  <div
    ref="scrollElement"
    style="overflow: auto; max-height: 70vh; padding: 24px 24px 16px"
  >
    <v-form
      lazy-validation
      style="height: 100%;"
      :value="valid"
      @input="onUpdate"
    >
      <v-list
        three-line
        subheader
        color="transparent"
        style="width: 100%"
      >
        <v-list-item>
          <div class="mt-4 grid grid-cols-4 gap-4">
            <v-text-field
              v-model="content.name"
              outlined
              autofocus
              :loading="loading"
              :disabled="loading"
              persistent-hint
              :hint="t('instance.nameHint')"
              :label="t('name')"
              :rules="nameRules"
              required
            />
            <v-text-field
              v-model="content.author"
              :loading="loading"
              :disabled="loading"
              outlined
              persistent-hint
              :hint="t('modpack.authorHint')"
              :label="t('author')"
              required
            />
            <v-text-field
              v-model="content.description"
              :loading="loading"
              :disabled="loading"
              class="col-span-2"
              outlined
              persistent-hint
              :hint="t('modpack.descriptionHint')"
              :label="t('description')"
            />
          </div>
        </v-list-item>
      </v-list>
    </v-form>
    <StepperAdvanceContent :valid.sync="valid" />
    <v-subheader v-if="loading || error || files.length > 0">
      {{ t('instanceTemplate.preview') }}
    </v-subheader>
    <v-skeleton-loader
      v-if="loading"
      type="list-item-avatar-two-line,list-item-avatar-two-line,list-item-avatar-two-line,list-item-avatar-two-line,list-item-avatar-two-line"
    />
    <ErrorView
      v-else-if="error"
      class="px-7"
      :error="error"
      no-refresh
    />
    <InstanceManifestFileTree
      v-else
      :value="[]"
      :scroll-element="scrollElement"
    />
  </div>
</template>

<script lang=ts setup>
import { provideFileNodes } from '@/composables/instanceFileNodeData'
import { kInstances } from '@/composables/instances'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { required } from '@/util/props'
import { kInstanceCreation } from '../composables/instanceCreation'
import ErrorView from './ErrorView.vue'
import InstanceManifestFileTree from './InstanceManifestFileTree.vue'
import StepperAdvanceContent from './StepperAdvanceContent.vue'

defineProps({
  valid: required(Boolean),
})
const emit = defineEmits(['update:valid'])
const { t } = useI18n()
const { data: content, files, loading, error } = injection(kInstanceCreation)
const { instances } = injection(kInstances)
const nameRules = computed(() => [
  (v: any) => !!v || t('instance.requireName'),
  (v: any) => !instances.value.some(i => i.name === v.trim()) || t('instance.duplicatedName'),
  (v: any) => !/\p{Script=Cyrillic}/u.test(v) || t('instance.nameNoCyrillic'),
])

const scrollElement = ref<HTMLElement | null>(null)

const onUpdate = ($event: any) => {
  emit('update:valid', $event)
}

provideFileNodes(computed(() => files.value.map(f => ({
  path: f.path,
  name: basename(f.path, '/'),
  size: f.size ?? 0,
})) ?? []))

</script>
