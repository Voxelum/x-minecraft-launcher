<template>
  <v-flex xs12>
    <v-list
      two-line
      subheader
      style="background: transparent; width: 100%"
    >
      <v-subheader style="padding-right: 2px">
        Java
        <v-spacer />
        <v-tooltip left>
          <template #activator="{ on }">
            <v-btn
              icon
              :loading="refreshingLocalJava"
              v-on="on"
              @click="refreshLocalJava"
            >
              <v-icon>refresh</v-icon>
            </v-btn>
          </template>
          {{ $t("java.refresh") }}
        </v-tooltip>
        <v-tooltip left>
          <template #activator="{ on }">
            <v-btn
              icon
              @click="browseFile"
              v-on="on"
            >
              <v-icon>add</v-icon>
            </v-btn>
          </template>
          {{ $t("java.browser") }}
        </v-tooltip>
      </v-subheader>
      <v-list-group no-action>
        <template #activator>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title>{{ $t("java.location") }}</v-list-item-title>
              <v-list-item-subtitle>
                {{
                  java && java.path ? java.path : $t("java.locationPlaceHolder")
                }}
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </template>
        <java-list
          v-model="java"
          :items="javas"
          :remove="removeJava"
        />
      </v-list-group>
      <v-list-item>
        <v-list-item-action>
          <v-icon>memory</v-icon>
        </v-list-item-action>
        <v-list-item-content>
          <v-list-item-title>{{ $t("java.memory") }}</v-list-item-title>
          <v-list-item-subtitle>
            {{
              $t("java.memoryHint")
            }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action style="width: 20%; margin-right: 10px">
          <v-text-field
            v-model="minMemory"
            hide-details
            type="number"
            required
            clearable
            :label="$t('java.minMemory')"
            :placeholder="$t('java.noMemory')"
          />
        </v-list-item-action>
        <v-list-item-action style="width: 20%">
          <v-text-field
            v-model="maxMemory"
            hide-details
            type="number"
            required
            clearable
            :label="$t('java.maxMemory')"
            :placeholder="$t('java.noMemory')"
          />
        </v-list-item-action>
      </v-list-item>
      <v-list-item style="margin-top: 5px">
        <v-list-item-content>
          <v-list-item-title>{{ $t("profile.vmOptions") }}</v-list-item-title>
          <v-list-item-subtitle>
            <v-text-field
              v-model="vmOptions"
              style="width: 100%; padding-top: unset; margin-top: unset; margin-bottom: 5px;"
              hide-details
              required
              :placeholder="$t('profile.vmOptionsHint')"
            />
          </v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>

      <v-subheader>Minecraft</v-subheader>

      <v-list-item>
        <v-list-item-content style="flex: 1">
          <v-list-item-title>{{ $t("profile.mcOptions") }}</v-list-item-title>
          <v-list-item-subtitle>
            <v-text-field
              v-model="mcOptions"
              style="width: 100%; padding-top: unset; margin-top: unset; margin-bottom: 5px;"
              hide-details
              required
              :placeholder="$t('profile.mcOptionsHint')"
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
              $t("profile.launchArguments")
            }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{
              java ? java.path : $t("java.locationPlaceHolder")
            }}
          </v-list-item-subtitle>
        </v-list-item-content>

        <v-list-item-action>
          <v-btn
            icon
            @click="copyToClipboard"
          >
            <v-icon>content_copy</v-icon>
          </v-btn>
        </v-list-item-action>
        <v-list-item-action>
          <v-btn
            icon
            @click="showPreview"
          >
            <v-icon>print</v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
    <v-dialog
      v-model="isPreviewShown"
      :width="500"
      style="overflow: hidden"
    >
      <v-card>
        <v-toolbar color="primary">
          {{
            $t("profile.launchArguments")
          }}
        </v-toolbar>
        <v-textarea
          hide-details
          readonly
          filled
          :value="preview"
          no-resize
          :height="480"
        />
      </v-card>
    </v-dialog>
  </v-flex>
</template>

<script lang=ts>
import { useI18n, useAutoSaveLoad } from '/@/composables'
import JavaList from './BaseSettingJavaList.vue'
import { useInstance } from '../composables/instance'
import { useNotifier } from '../composables/notifier'
import { useJava } from '../composables/java'
import { useLaunchPreview } from '../composables/launchPreview'

export default defineComponent({
  components: { JavaList },
  setup() {
    const { $t } = useI18n()
    const { showOpenDialog } = windowController
    const {
      editInstance: edit,
      maxMemory,
      minMemory,
      vmOptions,
      mcOptions,
      java,
    } = useInstance()
    const { preview, refresh, command } = useLaunchPreview()
    const { notify } = useNotifier()
    const { all: javas, add, remove, refreshLocalJava, refreshing: refreshingLocalJava } = useJava()

    const data = reactive({
      vmOptions: '',
      mcOptions: '',
      maxMemory: undefined as number | undefined,
      minMemory: undefined as number | undefined,
      memoryRange: [256, 10240],
      memoryRule: [(v: any) => Number.isInteger(v)],

      javaValid: true,
      java: { path: '', version: '', majorVersion: 0, valid: false },

      isPreviewShown: false,
    })
    function save() {
      return edit({
        minMemory: data.minMemory ? Number.parseInt(data.minMemory as any, 10) : undefined,
        maxMemory: data.maxMemory ? Number.parseInt(data.maxMemory as any, 10) : undefined,
        vmOptions: data.vmOptions.split(' ').filter(v => v.length !== 0),
        mcOptions: data.mcOptions.split(' ').filter(v => v.length !== 0),
        java: data.java.path,
      })
    }
    function load() {
      data.maxMemory = maxMemory.value <= 0 ? undefined : maxMemory.value
      data.minMemory = minMemory.value <= 0 ? undefined : minMemory.value
      data.vmOptions = vmOptions.value.join(' ')
      data.mcOptions = mcOptions.value.join(' ')
      data.java = javas.value.find(j => j.path === java.value)! ?? data.java
    }
    function showPreview() {
      save()
        .then(refresh)
        .then(() => {
          data.isPreviewShown = true
        })
    }
    function copyToClipboard() {
      save()
        .then(refresh)
        .then(() => {
          notify({ level: 'success', title: $t('copy.success') })
          navigator.clipboard.writeText(command.value)
        })
    }
    useAutoSaveLoad(save, load)

    return {
      ...toRefs(data),
      preview: computed(() => preview.value.join('\n')),
      refresh,
      javas,
      async browseFile() {
        const { filePaths } = await showOpenDialog({
          title: $t('java.browser'),
        })
        filePaths.forEach(add)
      },
      showPreview,
      removeJava: remove,
      refreshLocalJava,
      refreshingLocalJava,
      copyToClipboard,
    }
  },
})
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
