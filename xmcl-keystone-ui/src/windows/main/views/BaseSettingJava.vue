<template>
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
        {{ t("java.refresh") }}
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
        {{ t("java.importFromFile") }}
      </v-tooltip>
    </v-subheader>
    <v-list-group no-action>
      <template #activator>
        <v-list-item>
          <v-list-item-content>
            <v-list-item-title>{{ t("java.location") }}</v-list-item-title>
            <v-list-item-subtitle>
              {{
                java && java.path ? java.path : t("java.allocatedLong")
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
        <v-list-item-title>{{ t("java.memory") }}</v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("java.memoryHint")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action style="width: 20%; margin-right: 10px">
        <v-text-field
          v-model="instance.minMemory"
          hide-details
          type="number"
          required
          clearable
          :label="t('java.minMemory')"
          :placeholder="t('java.noMemory')"
        />
      </v-list-item-action>
      <v-list-item-action style="width: 20%">
        <v-text-field
          v-model="instance.maxMemory"
          hide-details
          type="number"
          required
          clearable
          :label="t('java.maxMemory')"
          :placeholder="t('java.noMemory')"
        />
      </v-list-item-action>
    </v-list-item>
    <v-list-item style="margin-top: 5px">
      <v-list-item-content>
        <v-list-item-title>{{ t("instance.vmOptions") }}</v-list-item-title>
        <v-list-item-subtitle>
          <v-text-field
            v-model="instance.vmOptions"
            style="width: 100%; padding-top: unset; margin-top: unset; margin-bottom: 5px;"
            hide-details
            required
            :placeholder="t('instance.vmOptionsHint')"
          />
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>

<script lang=ts setup>
import { JavaRecord } from '@xmcl/runtime-api'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { useJava } from '../composables/java'
import JavaList from './BaseSettingJavaList.vue'
import { useI18n } from '/@/composables'
import { injection } from '/@/util/inject'

const { t } = useI18n()
const { showOpenDialog } = windowController
const { all: javas, add, remove: removeJava, refreshLocalJava, refreshing: refreshingLocalJava } = useJava()
const { data: instance } = injection(InstanceEditInjectionKey)

const java = computed({
  get: () => javas.value.find(v => v.path === instance.javaPath) || { path: '', valid: false, majorVersion: 0, version: '' },
  set: (v: JavaRecord | undefined) => {
    instance.javaPath = v?.path ?? ''
  },
})

async function browseFile() {
  const { filePaths } = await showOpenDialog({
    title: t('java.importFromFile'),
  })
  filePaths.forEach(add)
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
