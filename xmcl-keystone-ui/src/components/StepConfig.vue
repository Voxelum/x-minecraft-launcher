<template>
  <div
    ref="scrollElement"
    style="overflow: auto; max-height: 70vh; padding: 24px 24px 16px;"
  >
    <v-form
      lazy-validation
      style="height: 100%;"
      :value="valid"
      class="z-1 relative"
      @input="onUpdate"
    >
      <div
        v-if="hasMinecraftLicense && bedrockSupported"
        data-testid="add-instance-edition"
        class="mb-4"
      >
        <v-list-subheader class="pl-0">
          {{ t('instances.edition') }}
        </v-list-subheader>
        <v-btn-toggle
          :model-value="content.edition"
          mandatory
          color="primary"
          variant="outlined"
          rounded="pill"
          divided
          @update:model-value="onEditionChange"
        >
          <v-btn
            data-testid="add-instance-edition-java"
            value="java"
            :disabled="loading"
          >
            <v-icon start>code</v-icon>
            {{ t('instances.editionJava') }}
          </v-btn>
          <v-btn
            data-testid="add-instance-edition-bedrock"
            value="bedrock"
            :disabled="loading || !bedrockSupported"
          >
            <v-icon start>view_in_ar</v-icon>
            {{ t('instances.editionBedrock') }}
          </v-btn>
        </v-btn-toggle>
        <div class="text-caption mt-1" style="color: rgba(var(--v-theme-on-surface), 0.6);">
          <template v-if="content.edition === 'bedrock'">
            {{ t('instances.editionBedrockHint') }}
          </template>
          <template v-else-if="!bedrockSupported">
            {{ t('instances.editionBedrockWindowsOnly') }}
          </template>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-4 mb-4">
        <v-text-field
          v-model="content.name"
          data-testid="add-instance-name"
          variant="outlined"
          autofocus
          :class="content.edition === 'bedrock' ? 'col-span-4' : 'col-span-2'"
          :loading="loading"
          :disabled="loading"
          persistent-hint
          persistent-placeholder
          :hint="t('instance.nameHint')"
          :placeholder="placeHolderName"
          :label="t('shared.name')"
          :rules="nameRules"
          required
        />
        <v-text-field
          v-if="content.edition !== 'bedrock'"
          v-model="content.author"
          :loading="loading"
          :disabled="loading"
          variant="outlined"
          class="col-span-2"
          persistent-hint
          :hint="t('modpack.authorHint')"
          :label="t('shared.author')"
        />
        <v-text-field
          v-model="content.description"
          :loading="loading"
          :disabled="loading"
          class="col-span-4"
          variant="outlined"
          persistent-hint
          :hint="t('modpack.descriptionHint')"
          :label="t('shared.description')"
        />
      </div>
    </v-form>
    <StepperAdvanceContent
      v-if="content.edition !== 'bedrock'"
      :valid="valid"
      class="z-1 relative"
      @update:valid="onUpdate"
    />
    <v-list-subheader v-if="loading || error || files.length > 0">
      {{ t('instanceTemplate.preview') }}
    </v-list-subheader>
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
      :model-value="[]"
      :scroll-element="scrollElement"
    />
  </div>
</template>

<script lang=ts setup>
import { provideFileNodes } from '@/composables/instanceFileNodeData'
import { kInstances } from '@/composables/instances'
import { useService } from '@/composables'
import { useHasMinecraftLicense } from '@/composables/minecraftLicense'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { required } from '@/util/props'
import { kInstanceCreation } from '../composables/instanceCreation'
import { validateInstanceName } from '@/util/instanceName'
import { BedrockServiceKey } from '@xmcl/runtime-api'
import { InstanceEdition } from '@xmcl/instance'
import ErrorView from './ErrorView.vue'
import InstanceManifestFileTree from './InstanceManifestFileTree.vue'
import StepperAdvanceContent from './StepperAdvanceContent.vue'

defineProps({
  valid: required(Boolean),
})
const emit = defineEmits(['update:valid'])
const { t } = useI18n()
const { data: content, files, loading, error, placeHolderName } = injection(kInstanceCreation)
const { instances } = injection(kInstances)

const { isSupported } = useService(BedrockServiceKey)
const { hasMinecraftLicense } = useHasMinecraftLicense()
const bedrockSupported = ref(false)
isSupported().then((v) => { bedrockSupported.value = v }).catch(() => { bedrockSupported.value = false })

// Fall back to the Java edition if the Bedrock option is no longer available
// (e.g. the account lost its license or on unsupported platform), so the
// mandatory toggle always has a valid selection.
watch([hasMinecraftLicense, bedrockSupported], ([licensed, supported]) => {
  if ((!licensed || !supported) && content.edition === 'bedrock') {
    content.edition = 'java'
  }
}, { immediate: true })

const onEditionChange = (edition: InstanceEdition) => {
  content.edition = edition ?? 'java'
  if (edition === 'bedrock') {
    content.name = 'Bedrock'
  } else {
    if (content.name === 'Bedrock') {
      content.name = ''
    }
  }
}
const nameValidationErrors: Record<string, string> = {
  invalidChars: 'instance.nameInvalidChars',
  reservedName: 'instance.nameReservedName',
  pathTraversal: 'instance.namePathTraversal',
  whitespaceOnly: 'instance.nameWhitespaceOnly',
  trailingDotOrSpace: 'instance.nameTrailingDotOrSpace',
}
const nameRules = computed(() => [
  (v: any) => {
    const trimmed = v.trim()
    const effectiveName = trimmed || placeHolderName.value
    return !instances.value.some(i => i.name === effectiveName) || t('instance.duplicatedName')
  },
  (v: any) => {
    if (!v) return true // empty is allowed, will use placeholder
    const result = validateInstanceName(v)
    if (result === true) return true
    return t(nameValidationErrors[result] ?? 'instance.nameInvalidChars')
  },
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
