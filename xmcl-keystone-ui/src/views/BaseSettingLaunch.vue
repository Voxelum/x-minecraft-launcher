<template>
  <SettingCard :title="t('setting.minecraftOptions')" icon="videogame_asset">
    <SettingItemCheckbox
      :model-value="!!isGameOptionsLinkedCache"
      :disabled="isGameOptionsLinkedCache === undefined"
      :title="t('instance.useSharedOptions')"
      :description="t('instance.useSharedOptionsDesc')"
      @update:model-value="
        !isGameOptionsLinkedCache
          ? show('options.txt')
          : unlinkGameOptions(path).then(() => mutateOptions())
      "
    />

    <v-divider class="my-4" />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div class="font-weight-medium mb-2 flex items-center">
          <v-icon start size="small">play_arrow</v-icon>
          {{ t("instance.preExecCommand") }}
          <BaseSettingGlobalLabel
            :global="isGlobalPreExecuteCommand"
            @clear="resetPreExecuteCommand"
            @click="gotoSetting"
          />
        </div>
        <v-text-field
          v-model="preExecuteCommand"
          variant="outlined"
          density="compact"
          hide-details
          :placeholder="t('instance.preExecCommandHint')"
        />
      </div>
      <div>
        <div class="font-weight-medium mb-2 flex items-center">
          <v-icon start size="small">tune</v-icon>
          {{ t("instance.mcOptions") }}
          <BaseSettingGlobalLabel
            :global="isGlobalMcOptions"
            @clear="resetMcOptions"
            @click="gotoSetting"
          />
        </div>
        <v-text-field
          v-model="mcOptions"
          variant="outlined"
          density="compact"
          hide-details
          :placeholder="t('instance.mcOptionsHint')"
        />
      </div>
    </div>
  </SettingCard>

  <SettingCard :title="t('instance.launchArguments')" icon="preview">
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-weight-medium">{{ t('shared.server') }}</span>
      <v-divider vertical class="mx-1" />
      <v-btn
        :disabled="!serverVersionId"
        icon
        variant="text"
        density="comfortable"
        size="small"
        @click="copyToClipboard('server')"
      >
        <v-icon v-if="!copiedServer">content_copy</v-icon>
        <v-icon v-else color="primary">check</v-icon>
      </v-btn>
      <v-btn
        :disabled="!serverVersionId"
        icon
        variant="text"
        density="comfortable"
        size="small"
        @click="showPreview('server')"
      >
        <v-icon>print</v-icon>
      </v-btn>
      <span class="mx-2" />
      <span class="font-weight-medium">{{ t('shared.client') }}</span>
      <v-divider vertical class="mx-1" />
      <v-btn
        :disabled="!versionId"
        icon
        variant="text"
        density="comfortable"
        size="small"
        @click="copyToClipboard('client')"
      >
        <v-icon v-if="!copiedClient">content_copy</v-icon>
        <v-icon v-else color="primary">check</v-icon>
      </v-btn>
      <v-btn
        :disabled="!versionId"
        icon
        variant="text"
        density="comfortable"
        size="small"
        @click="showPreview('client')"
      >
        <v-icon>print</v-icon>
      </v-btn>
    </div>
  </SettingCard>

  <v-dialog v-model="isPreviewShown" :width="720">
    <v-card class="flex max-h-[85vh] flex-col overflow-hidden">
      <v-toolbar color="primary" flat density="comfortable">
        <v-app-bar-nav-icon
          icon="terminal"
          :ripple="false"
          style="cursor: default"
        />
        <v-toolbar-title class="font-medium">
          {{ t('instance.launchArguments') }}
        </v-toolbar-title>
        <v-spacer />
        <v-chip
          size="small"
          variant="flat"
          color="white"
          class="text-primary mr-2 font-mono font-medium"
        >
          {{ preview.length }}
        </v-chip>
        <v-btn
          v-shared-tooltip="() => previewCopied ? 'Copied' : 'Copy'"
          :icon="previewCopied ? 'check' : 'content_copy'"
          variant="text"
          @click="copyPreview"
        />
        <v-btn
          icon="close"
          variant="text"
          @click="isPreviewShown = false"
        />
      </v-toolbar>

      <div
        class="flex-1 overflow-auto p-3 font-mono text-xs"
        style="background-color: rgba(var(--v-theme-on-surface), 0.04)"
      >
        <div
          v-for="(arg, i) in preview"
          :key="i"
          class="group flex items-start gap-3 rounded px-2 py-1 transition-colors hover:bg-[rgba(var(--v-theme-primary),0.08)]"
        >
          <span
            class="select-none text-right opacity-50"
            style="min-width: 2.5rem"
          >{{ i + 1 }}</span>
          <span
            class="break-all leading-relaxed"
            :style="{ color: argColor(arg) }"
          >{{ arg }}</span>
        </div>
      </div>
    </v-card>
  </v-dialog>
  <v-dialog v-model="model" width="440">
    <v-card>
      <v-card-item>
        <template #prepend>
          <v-avatar color="primary" variant="tonal">
            <v-icon>link</v-icon>
          </v-avatar>
        </template>
        <v-card-title class="text-base font-medium">
          {{ t('instance.linkFileTitle', { file: target }) }}
        </v-card-title>
      </v-card-item>
      <v-card-text class="pt-0 text-sm opacity-80">
        {{ t('instance.linkFileDesc', { file: target }) }}
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-btn variant="text" @click="cancel">
          {{ t('shared.cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          rounded="pill"
          prepend-icon="link"
          @click="confirm"
        >
          {{ t('shared.yes') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import { useService } from '@/composables'
import { useSimpleDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import {
  InstanceOptionsServiceKey,
  LaunchException,
  isException,
} from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { useLaunchPreview } from '../composables/launchPreview'
import { useNotifier } from '../composables/notifier'
import BaseSettingGlobalLabel from '@/components/BaseSettingGlobalLabel.vue'
import { useLaunchException } from '@/composables/launchException'
import { kInstanceVersion } from '@/composables/instanceVersion'

const { t } = useI18n()
const { preview, refresh, command, error } = useLaunchPreview()
const { notify } = useNotifier()
const {
  save,
  isGlobalMcOptions,
  resetMcOptions,
  mcOptions,
  isGlobalPreExecuteCommand,
  resetPreExecuteCommand,
  preExecuteCommand,
} = injection(InstanceEditInjectionKey)
const isPreviewShown = ref(false)
const previewText = computed(() => preview.value.join('\n'))
const previewCopied = ref(false)
const copyPreview = () => {
  windowController.writeClipboard(previewText.value)
  previewCopied.value = true
  setTimeout(() => { previewCopied.value = false }, 2000)
}
function argColor(arg: string) {
  if (arg.startsWith('-D') || arg.startsWith('-X')) {
    return 'rgb(var(--v-theme-info))'
  }
  if (arg.startsWith('--')) {
    return 'rgb(var(--v-theme-warning))'
  }
  if (arg.startsWith('-')) {
    return 'rgb(var(--v-theme-success))'
  }
  return undefined
}
const { push } = useRouter()

const { path } = injection(kInstance)
const { isGameOptionsLinked, linkGameOptions, unlinkGameOptions } =
  useService(InstanceOptionsServiceKey)

const { data: isGameOptionsLinkedCache, mutate: mutateOptions } = useSWRV(
  computed(() => `${path.value}/options.txt`),
  (key) => isGameOptionsLinked(key.substring(0, key.lastIndexOf('/'))),
)

const { model, show, target, confirm, cancel } = useSimpleDialog<'options.txt'>(
  (type) => {
    if (type === 'options.txt') {
      linkGameOptions(path.value).then(() => mutateOptions())
    }
  },
)

async function showPreview(side = 'client' as 'client' | 'server') {
  try {
    await save()
  } catch (e) {
    onError(e)
    notify({ level: 'error', icon: 'error', title: title.value, body: description.value })
    return
  }
  await refresh(side)
  if (!error.value) {
    isPreviewShown.value = true
  } else {
    if (isException(LaunchException, error.value)) {
      onException(error.value.exception)
    } else {
      onError(error.value)
    }
    notify({ level: 'error', icon: 'error', title: title.value, body: description.value })
  }
}

const { versionId, serverVersionId } = injection(kInstanceVersion)
const copiedClient = ref(false)
const copiedServer = ref(false)
const title = ref('')
const description = ref('')
const unexpected = ref(false)
const extraText = ref('')
const { onError, onException } = useLaunchException(title, description, unexpected, extraText)
async function copyToClipboard(side = 'client' as 'client' | 'server') {
  try {
    await save()
  } catch (e) {
    onError(e)
    notify({ level: 'error', icon: 'error', title: title.value, body: description.value })
    return
  }
  await refresh(side)
  if (!error.value) {
    windowController.writeClipboard(command.value)
    if (side === 'client') {
      copiedClient.value = true
      setTimeout(() => {
        copiedClient.value = false
      }, 4000)
    } else {
      copiedServer.value = true
      setTimeout(() => {
        copiedServer.value = false
      }, 4000)
    }
  } else {
    if (isException(LaunchException, error.value)) {
      onException(error.value.exception)
    } else {
      onError(error.value)
    }
    notify({ level: 'error', icon: 'error', title: title.value, body: description.value })
  }
}
const gotoSetting = () => {
  push('/setting')
}
</script>

<style>
.v-textarea.v-text-field--enclosed .v-text-field__slot textarea {
  word-break: break-all;
}
</style>
