<template>
  <v-list
    two-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-subheader>Minecraft</v-subheader>

    <SettingItemCheckbox
      :value="isGameOptionsLinkedCache || false"
      :disabled="isGameOptionsLinkedCache === undefined"
      :title="t('instance.useSharedOptions')"
      :description="t('instance.useSharedOptionsDesc')"
      @input="!isGameOptionsLinkedCache ? show('options.txt') : unlinkGameOptions(path).then(() => mutateOptions())"
    />
    <SettingItemCheckbox
      :value="isServersListLinkedCache || false"
      :disabled="isServersListLinkedCache === undefined"
      :title="t('instance.useSharedServersList')"
      :description="t('instance.useSharedServersListDesc')"
      @input="!isServersListLinkedCache ? show('servers.dat') : unlinkServersList(path).then(() => mutateServers())"
    />

    <v-list-item>
      <v-list-item-content class="max-w-70 mr-4">
        <v-list-item-title>
          {{ t("instance.preExecCommand") }}
          <BaseSettingGlobalLabel
            :global="isGlobalPreExecuteCommand"
            @clear="resetPreExecuteCommand"
            @click="gotoSetting"
          />
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-text-field
            v-model="preExecuteCommand"
            outlined
            filled
            dense
            class="m-1 mt-2"
            hide-details
            required
            :placeholder="t('instance.preExecCommandHint')"
          />
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-content style="flex: 1">
        <v-list-item-title>
          {{ t("instance.mcOptions") }}
          <BaseSettingGlobalLabel
            :global="isGlobalMcOptions"
            @clear="resetMcOptions"
            @click="gotoSetting"
          />
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-text-field
            v-model="mcOptions"
            outlined
            filled
            dense
            class="m-1 mt-2"
            hide-details
            required
            :placeholder="t('instance.mcOptionsHint')"
          />
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>

    <v-list-item>
      <v-list-item-action>
        <v-icon class="material-icons-outlined icon-image-preview">
          preview
        </v-icon>
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("instance.launchArguments")
          }}
        </v-list-item-title>
      </v-list-item-content>

      {{ t('modrinth.environments.server') }}
      <v-divider
        vertical
        class="my-4 mx-2"
      />
      <v-list-item-action>
        <v-btn
          icon
          @click="copyToClipboard('server')"
        >
          <v-icon>content_copy</v-icon>
        </v-btn>
      </v-list-item-action>
      <v-list-item-action>
        <v-btn
          icon
          @click="showPreview('server')"
        >
          <v-icon>print</v-icon>
        </v-btn>
      </v-list-item-action>
      <span class="mx-4" />
      {{ t('modrinth.environments.client') }}
      <v-divider
        vertical
        class="my-4 mx-2"
      />
      <v-list-item-action>
        <v-btn
          icon
          @click="copyToClipboard('client')"
        >
          <v-icon>content_copy</v-icon>
        </v-btn>
      </v-list-item-action>
      <v-list-item-action class="mx-0">
        <v-btn
          icon
          @click="showPreview('client')"
        >
          <v-icon>print</v-icon>
        </v-btn>
      </v-list-item-action>
    </v-list-item>
    <v-dialog
      v-model="isPreviewShown"
      :width="500"
      style="overflow: hidden"
    >
      <v-card>
        <v-toolbar color="primary">
          {{
            t("instance.launchArguments")
          }}
        </v-toolbar>
        <v-textarea
          hide-details
          readonly
          filled
          :value="previewText"
          no-resize
          :height="480"
        />
      </v-card>
    </v-dialog>
    <v-dialog
      v-model="model"
      width="400"
    >
      <v-card>
        <v-card-title>
          {{ t('instance.linkFileTitle', { file: target }) }}
        </v-card-title>

        <v-card-text>
          {{ t('instance.linkFileDesc', { file: target }) }}
        </v-card-text>

        <v-card-actions>
          <v-btn
            text
            @click="cancel"
          >
            {{ t('cancel') }}
          </v-btn>
          <div class="flex-grow" />
          <v-btn
            text
            color="primary"
            @click="confirm"
          >
            <v-icon left>
              link
            </v-icon>
            {{ t('yes') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-divider />
  </v-list>
</template>

<script lang=ts setup>
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import { useService } from '@/composables'
import { useSimpleDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'
import { InstanceOptionsServiceKey, InstanceServerInfoServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { useLaunchPreview } from '../composables/launchPreview'
import { useNotifier } from '../composables/notifier'
import BaseSettingGlobalLabel from './BaseSettingGlobalLabel.vue'

const { t } = useI18n()
const { preview, refresh, command, error } = useLaunchPreview()
const { notify } = useNotifier()
const { save, isGlobalMcOptions, resetMcOptions, mcOptions, isGlobalPreExecuteCommand, resetPreExecuteCommand, preExecuteCommand } = injection(InstanceEditInjectionKey)
const isPreviewShown = ref(false)
const previewText = computed(() => preview.value.join('\n'))
const { push } = useRouter()

const { path } = injection(kInstance)
const { isGameOptionsLinked, linkGameOptions, unlinkGameOptions } = useService(InstanceOptionsServiceKey)
const { isLinked: isServersListLinked, unlink: unlinkServersList, link: linkServersList } = useService(InstanceServerInfoServiceKey)

const { data: isGameOptionsLinkedCache, mutate: mutateOptions } = useSWRV(computed(() => `${path.value}/options.txt`), (key) => isGameOptionsLinked(key.substring(0, key.lastIndexOf('/'))))
const { data: isServersListLinkedCache, mutate: mutateServers } = useSWRV(computed(() => `${path.value}/servers.dat`), (key) => isServersListLinked(key.substring(0, key.lastIndexOf('/'))))

const { model, show, target, confirm, cancel } = useSimpleDialog<'options.txt' | 'servers.dat'>((type) => {
  if (type === 'options.txt') {
    linkGameOptions(path.value).then(() => mutateOptions())
  } else if (type === 'servers.dat') {
    linkServersList(path.value).then(() => mutateServers())
  }
})

async function showPreview(side = 'client' as 'client' | 'server') {
  await save()
  await refresh(side)
  if (!error.value) {
    isPreviewShown.value = true
  }
}
async function copyToClipboard(side = 'client' as 'client' | 'server') {
  await save()
  await refresh(side)
  if (!error.value) {
    notify({ level: 'success', title: t('copyClipboard.success') })
    windowController.writeClipboard(command.value)
  }
}
const gotoSetting = () => {
  push('/setting')
}
</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important;
}

.theme--.v-list .v-list__group--active:after,
.theme--.v-list .v-list__group--active:before {
  background: unset;
}
</style>

<style>
.v-textarea.v-text-field--enclosed .v-text-field__slot textarea {
  word-break: break-all;
}
</style>
