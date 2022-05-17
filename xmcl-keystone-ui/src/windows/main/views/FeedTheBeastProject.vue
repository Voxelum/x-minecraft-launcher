<template>
  <div
    class="flex gap-4 overflow-auto p-4 flex-col"
  >
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <v-card
      outlined
      class="rounded-lg p-4 flex gap-6 flex-grow-0 flex-1"
    >
      <img
        :src="avatar ? avatar.url : ''"
        class="w-40"
      >
      <div class="flex flex-col gap-2">
        <h2 class="text-2xl font-bold">
          {{ title }}
        </h2>
        <span class="text-lg">{{ shortDescription }}</span>
        <span class="flex-grow" />
        <span class="flex gap-4 align-center">
          <span v-if="installs">
            <v-icon>download</v-icon>
            {{ installs }}
          </span>
          <span v-if="plays">
            <v-icon> person </v-icon>
            {{ plays }}
          </span>
          <div class="flex-grow" />
          <v-select
            v-model="currentVersion"
            :items="versions"
            outlined
            prepend-inner-icon="update"
            class="max-w-50"
            item-value="id"
            item-text="name"
            hide-details
          >
            <template #label>
              {{ t('versions') }}
            </template>
            <template #item="{ item, on }">
              <v-list-item
                class="flex gap-4 justify-start"
                v-on="on"
              >
                <v-chip
                  label
                  :color="typeToColor[item.type.toLowerCase()]"
                >
                  {{ t(`versionType.${item.type.toLowerCase()}`) }}
                </v-chip>
                {{ item.name }}
              </v-list-item>
            </template>
          </v-select>
          <v-btn
            color="primary"
            large
            :loading="installing"
            @click="install"
          >
            <v-icon left>
              download
            </v-icon>
            {{ t('install', { version: selectedVersionInstance ? selectedVersionInstance.name : '' }) }}
          </v-btn>
        </span>
      </div>
    </v-card>

    <v-card outlined>
      <v-tabs
        v-model="tab"
        class="rounded-lg flex-grow-0 flex-1"
      >
        <v-tab :key="0">
          {{ $t('overview') }}
        </v-tab>
        <v-tab :key="1">
          {{ $t('details') }}
        </v-tab>
        <v-tab :key="2">
          {{ $t('changelog') }}
        </v-tab>
      </v-tabs>
      <v-tabs-items v-model="tab">
        <v-tab-item :key="0">
          <v-card class="rounded-b-xl">
            <div
              class="p-4 markdown"
              v-html="description"
            />
          </v-card>
        </v-tab-item>
        <v-tab-item :key="1">
          <FeedTheBeastProjectVersion
            v-if="selectedVersionInstance"
            :id="id"
            :version="selectedVersionInstance"
          />
        </v-tab-item>
        <v-tab-item :key="2">
          <FeedTheBeastProjectChangelog
            v-if="selectedVersionInstance"
            :id="id"
            :version="selectedVersionInstance"
          />
        </v-tab-item>
      </v-tabs-items>
    </v-card>
  </div>
</template>

<script lang=ts setup>
import { useFeedTheBeastProject } from '../composables/ftb'
import MarkdownIt from 'markdown-it'
import { useI18n, useRefreshable, useService } from '/@/composables'
import FeedTheBeastProjectVersion from './FeedTheBeastProjectVersion.vue'
import FeedTheBeastProjectChangelog from './FeedTheBeastProjectChangelog.vue'
import { useDialog } from '../composables/dialog'
import { AddInstanceDialogKey } from '../composables/instanceAdd'
import { FeedTheBeastServiceKey } from '@xmcl/runtime-api'

const parser = new MarkdownIt()
const props = defineProps<{ id: number }>()

const { refresh, refreshing, manifest } = useFeedTheBeastProject(computed(() => props.id))
const { getModpackVersionManifest } = useService(FeedTheBeastServiceKey)
const { show } = useDialog(AddInstanceDialogKey)

const tab = ref(0)
const { t } = useI18n()
const avatar = computed(() => manifest.value?.art.find(a => a.type === 'square') || manifest.value?.art[0])
const title = computed(() => manifest.value?.name || '')
const shortDescription = computed(() => manifest.value?.synopsis ?? '')
const description = computed(() => manifest.value?.description ? parser.render(manifest.value.description) : '')
const installs = computed(() => manifest.value?.installs)
const plays = computed(() => manifest.value?.plays)
const versions = computed(() => manifest.value?.versions.reverse() || [])
const currentVersion = ref(-1)
const selectedVersionInstance = computed(() => manifest.value?.versions.find(v => v.id === currentVersion.value))
const typeToColor: Record<string, string> = {
  release: 'primary',
  alpha: 'red',
  beta: 'orange',
}

watch(manifest, (m) => {
  if (m) {
    currentVersion.value = m.versions[m.versions.length - 1].id
  }
})

const { refresh: install, refreshing: installing } = useRefreshable(async () => {
  if (selectedVersionInstance.value) {
    await getModpackVersionManifest({ modpack: props.id, version: selectedVersionInstance.value })
    show(`${props.id}-${selectedVersionInstance.value.id}`)
  }
})

</script>

<style>
.markdown h3 {
  font-size: 2em;
  font-weight: 400;
}
.markdown p {
  margin: 10px 0;
}
</style>

<i18n locale="en" lang="yaml">
overview: Overview
details: Details
changelog: Changelog
versions: Versions
install: Install {version}
</i18n>

<i18n locale="zh-CN" lang="yaml">
overview: 总览
details: 具体信息
changelog: 更变日志
versions: 版本
install: 安装 {version}
</i18n>
