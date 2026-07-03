<template>
  <SettingCard title="Java" icon="coffee">
    <!-- Hero Java row -->
    <div class="java-hero flex items-center gap-3 px-2">
      <v-avatar
        size="48"
        rounded="lg"
        :color="heroAvatar.color"
        :variant="heroAvatar.variant"
      >
        <span
          v-if="displayJava.path && displayJava.valid && displayJava.majorVersion"
          class="text-h6 font-weight-bold"
        >
          {{ displayJava.majorVersion }}
        </span>
        <v-icon v-else-if="displayJava.path">error_outline</v-icon>
        <v-icon v-else-if="autoIssue === 'no-java'">error_outline</v-icon>
        <v-icon v-else-if="autoIssue === 'no-match'">download</v-icon>
        <v-icon v-else>memory</v-icon>
      </v-avatar>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 text-subtitle-1 font-weight-medium">
          <template v-if="displayJava.path && displayJava.valid">
            Java {{ displayJava.version }}
            <v-chip
              v-if="displayJava.arch"
              size="x-small"
              color="orange"
              label
              variant="outlined"
            >
              {{ displayJava.arch }}
            </v-chip>
            <v-chip
              v-if="isAuto"
              v-shared-tooltip="() => t('java.allocatedLong')"
              size="x-small"
              color="primary"
              label
              variant="tonal"
            >
              <v-icon start size="x-small">auto_awesome</v-icon>
              {{ t('java.allocatedShort') }}
            </v-chip>
          </template>
          <template v-else-if="displayJava.path">
            <span class="text-error">{{ t('java.invalid') }}</span>
          </template>
          <template v-else-if="autoIssue === 'no-java'">
            <span class="text-error">{{ t('HomeJavaIssueDialog.missingJava') }}</span>
          </template>
          <template v-else-if="autoIssue === 'no-match'">
            <span class="text-warning">{{ t('launchNoProperJava.title') }}</span>
          </template>
          <template v-else>
            {{ t('java.allocatedLong') }}
          </template>
        </div>
        <div
          v-if="displayJava.path"
          v-shared-tooltip="displayJava.path"
          class="text-caption text-medium-emphasis truncate"
        >
          {{ displayJava.path }}
        </div>
        <div v-else-if="autoIssue === 'no-java'" class="text-caption text-medium-emphasis">
          {{ t('HomeJavaIssueDialog.missingJavaHint') }}
        </div>
        <div v-else-if="autoIssue === 'no-match'" class="text-caption text-medium-emphasis">
          {{ t('installJre.name') }}
        </div>
        <div v-else class="text-caption text-medium-emphasis">
          {{ t('java.locationHint') }}
        </div>
      </div>

      <v-btn
        v-if="displayJava.path && displayJava.valid"
        v-shared-tooltip="() => t('java.openFolder')"
        icon
        variant="text"
        density="comfortable"
        size="small"
        @click="showItemInDirectory(displayJava.path)"
      >
        <v-icon>folder_open</v-icon>
      </v-btn>

      <v-divider vertical class="mx-1 my-2" />

      <v-btn
        v-shared-tooltip="() => t('java.refresh')"
        icon
        variant="text"
        density="comfortable"
        size="small"
        :loading="refreshing"
        @click="onRefresh"
      >
        <v-icon>refresh</v-icon>
      </v-btn>
      <v-btn
        id="java-import"
        v-shared-tooltip="() => t('java.importFromFile')"
        icon
        variant="text"
        density="comfortable"
        size="small"
        @click="browseFile"
      >
        <v-icon>add</v-icon>
      </v-btn>

      <v-menu
        v-model="pickerOpen"
        :close-on-content-click="false"
        location="bottom end"
      >
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            variant="tonal"
            size="small"
          >
            <v-icon start size="small">tune</v-icon>
            {{ t('java.change') }}
          </v-btn>
        </template>
        <v-card width="540" max-width="90vw" max-height="60vh" class="overflow-auto">
          <JavaList
            :value="java"
            :items="javas"
            :remove="onRemoveJava"
            @input="onPickJava"
          />
        </v-card>
      </v-menu>
    </div>

    <!-- Memory subsection -->
    <div class="java-subheader flex items-center gap-2 px-2 mt-8 mb-5">
      <v-icon start color="primary" size="small">memory</v-icon>
      <span class="text-subtitle-1 font-weight-medium select-none flex items-center">
        {{ t('java.memory') }}
      </span>
      <BaseSettingGlobalLabel
        :global="isGlobalAssignMemory"
        @click="gotoSetting"
        @clear="resetAssignMemory"
      />
      <v-spacer />
      <SettingJavaMemoryAssign
        :value="assignMemory"
        @input="assignMemory = $event"
      />
    </div>
    <div class="px-2">
      <SettingJavaMemory
        :assign-memory="assignMemory"
        v-model:min="minMem"
        v-model:max="maxMem"
      />
    </div>

    <!-- Advanced subsection -->
    <div class="java-subheader flex items-center px-2 mt-8 mb-3">
      <span class="text-subtitle-1 font-weight-medium select-none">
        <v-icon start color="primary" size="small">code</v-icon>
        {{ t('setting.advancedJavaOptions') }}
      </span>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 px-2">
      <div>
        <div class="font-weight-medium mb-2 flex items-center text-body-2">
          <v-icon start size="small">terminal</v-icon>
          {{ t("instance.prependCommand") }}
          <BaseSettingGlobalLabel
            :global="isGlobalPrependCommand"
            @clear="resetPrependCommand"
            @click="gotoSetting"
          />
        </div>
        <v-text-field
          v-model="prependCommand"
          v-shared-tooltip="() => t('instance.prependCommandHint')"
          variant="outlined"
          density="compact"
          hide-details
          :placeholder="t('instance.prependCommandHint')"
        />
      </div>
      <div>
        <div class="font-weight-medium mb-2 flex items-center text-body-2">
          <v-icon start size="small">settings_applications</v-icon>
          {{ t("instance.vmOptions") }}
          <BaseSettingGlobalLabel
            :global="isGlobalVmOptions"
            @clear="resetVmOptions"
            @click="gotoSetting"
          />
        </div>
        <v-text-field
          v-model="vmOptions"
          variant="outlined"
          density="compact"
          hide-details
          :placeholder="t('instance.vmOptionsHint')"
        />
      </div>
    </div>
  </SettingCard>

  <SettingCard :title="t('instance.vmVar')" icon="eco">
    <template #header-action>
      <v-btn
        color="primary"
        variant="text"
        size="small"
        border
        @click="onAddEnvVar"
      >
        <v-icon start size="small">add</v-icon>
        {{ t('shared.add') }}
      </v-btn>
    </template>

    <div class="text-subtitle-2 mb-3">
      {{ t('instance.vmVarHint') }}
    </div>
    <EnvVarTableItem :env="allEnv" :readonly="readonlyEnv" @delete="onEnvVarDeleted" />
    <EnvVarAddItem v-if="adding" @clear="onEnvVarCleared" @add="onEnvVarAdded" />
  </SettingCard>
</template>

<script lang="ts" setup>
import EnvVarAddItem from '@/components/EnvVarAddItem.vue'
import EnvVarTableItem from '@/components/EnvVarTableItem.vue'
import SettingCard from '@/components/SettingCard.vue'
import { useService } from '@/composables'
import { kInstanceJava } from '@/composables/instanceJava'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { BaseServiceKey, JavaRecord, JavaServiceKey } from '@xmcl/runtime-api'
import { resolvePinChoice, shouldClearPinOnRemove } from '@/util/javaPin'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { kJavaContext } from '../composables/java'
import BaseSettingGlobalLabel from '@/components/BaseSettingGlobalLabel.vue'
import JavaList from './BaseSettingJavaList.vue'
import SettingJavaMemory from './SettingJavaMemory.vue'
import SettingJavaMemoryAssign from './SettingJavaMemoryAssign.vue'

const { t } = useI18n()
const { showOpenDialog } = windowController
const { all: javas, remove: removeJava, refreshing, refresh } = injection(kJavaContext)
const { java: selectedJava, status: javaStatus } = injection(kInstanceJava)
const { resolveJava: add } = useService(JavaServiceKey)
const { showItemInDirectory } = useService(BaseServiceKey)

const pickerOpen = ref(false)

function onRefresh() {
  refresh(true)
}

function onPickJava(value: JavaRecord) {
  const next = resolvePinChoice(value, isAuto.value, selectedJava.value?.path)
  if (next === undefined) {
    java.value = undefined
  } else {
    // Preserve the full record so the picker shows correct metadata even
    // before the next java-status refresh round-trips.
    java.value = value
  }
  pickerOpen.value = false
}

function onRemoveJava(value: JavaRecord) {
  if (shouldClearPinOnRemove(value.path, javaPath.value)) {
    java.value = undefined
  }
  removeJava(value)
}

const {
  isGlobalAssignMemory,
  isGlobalVmOptions,
  assignMemory,
  isGlobalPrependCommand,
  prependCommand,
  env,
  globalEnv,
  resetPrependCommand,
  resetAssignMemory,
  resetVmOptions,
  maxMemory: maxMem,
  vmOptions,
  minMemory: minMem,
  javaPath,
} = injection(InstanceEditInjectionKey)

const allEnv = computed(() => ({
  ...globalEnv.value,
  ...env.value,
}))
const readonlyEnv = computed(() => {
  const envs = { ...globalEnv.value }
  for (const e in envs) {
    if (env.value[e] !== undefined) {
      delete envs[e]
    }
  }
  return Object.keys(envs)
})

const java = computed({
  get: () =>
    javas.value.find((v) => v.path === javaPath.value) || {
      path: '',
      valid: false,
      majorVersion: 0,
      version: '',
    },
  set: (v: JavaRecord | undefined) => {
    javaPath.value = v?.path ?? ''
  },
})

// When the user has not pinned a Java (auto mode), fall back to whatever
// the launcher would actually run with. `selectedJava` from kInstanceJava is
// resolved by the same logic used at launch time, so the user can see what
// will be picked instead of a generic "system default" placeholder.
const isAuto = computed(() => !javaPath.value)
const displayJava = computed<JavaRecord & { path: string; valid: boolean; majorVersion: number; version: string }>(() => {
  if (!isAuto.value) return java.value as any
  const auto = selectedJava.value
  if (auto && auto.path) {
    return {
      ...auto,
      valid: auto.valid !== false,
    } as any
  }
  return java.value as any
})

// In auto mode the resolver may decide no installed Java is compatible (e.g.
// the version needs Java 25 but only 18/21 are installed). Surface that to
// the user instead of pretending we'd "use system default": show a missing
// state when no Java is installed at all, or an install-pending hint when
// some Java exists but none satisfies the requirement.
const autoIssue = computed<'none' | 'no-java' | 'no-match'>(() => {
  if (!isAuto.value) return 'none'
  const stat = javaStatus.value
  if (!stat) return 'none'
  if (stat.noJava) return 'no-java'
  if (!stat.java) return 'no-match'
  return 'none'
})

const heroAvatar = computed(() => {
  if (displayJava.value.path && displayJava.value.valid) {
    return { color: 'primary', variant: 'flat' as const }
  }
  if (displayJava.value.path) {
    return { color: 'error', variant: 'tonal' as const }
  }
  if (autoIssue.value === 'no-java') {
    return { color: 'error', variant: 'tonal' as const }
  }
  if (autoIssue.value === 'no-match') {
    return { color: 'warning', variant: 'tonal' as const }
  }
  return { color: 'surface-variant', variant: 'tonal' as const }
})

const { push } = useRouter()
const gotoSetting = () => {
  push('/setting')
}

async function browseFile() {
  const { filePaths } = await showOpenDialog({
    title: t('java.importFromFile'),
  })
  filePaths.forEach(add)
}

const adding = ref(false)
function onAddEnvVar() {
  adding.value = true
}
function onEnvVarCleared() {
  adding.value = false
}
function onEnvVarAdded(key: string, value: string) {
  adding.value = false
  if (key === '') return
  env.value = { ...env.value, [key]: value }
}
function onEnvVarDeleted(key: string) {
  const { [key]: _, ...rest } = env.value
  env.value = rest
}
</script>

<style scoped>
.java-hero {
  border-radius: 8px;
  background-color: rgba(var(--v-theme-on-surface), 0.03);
  padding-top: 12px;
  padding-bottom: 12px;
}
</style>

<style>
.v-textarea.v-text-field--enclosed .v-text-field__slot textarea {
  word-break: break-all;
}
</style>
