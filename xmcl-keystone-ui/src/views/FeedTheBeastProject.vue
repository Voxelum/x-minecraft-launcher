<template>
  <div class="flex flex-col gap-4 overflow-auto p-4">
    <v-progress-linear
      class="absolute left-0 top-0 z-10 m-0 p-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <v-card
      outlined
      class="flex flex-1 flex-grow-0 gap-6 rounded-lg p-4"
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
        <span class="align-center flex gap-4">
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
              {{ t('FeedTheBeastProject.versions') }}
            </template>
            <template #item="{ item, on }">
              <v-list-item
                class="flex justify-start gap-4"
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
            :disabled="refreshing"
            :loading="installing"
            @click="install"
          >
            <v-icon left>
              download
            </v-icon>
            {{ t('FeedTheBeastProject.install', { version: selectedVersionInstance ? selectedVersionInstance.name : '' })
            }}
          </v-btn>
        </span>
      </div>
    </v-card>

    <v-card outlined>
      <v-tabs
        v-model="tab"
        class="flex-1 flex-grow-0 rounded-lg"
      >
        <v-tab :key="0">
          {{ t('FeedTheBeastProject.overview') }}
        </v-tab>
        <v-tab :key="1">
          {{ t('FeedTheBeastProject.details') }}
        </v-tab>
        <v-tab :key="2">
          {{ t('FeedTheBeastProject.changelog') }}
        </v-tab>
      </v-tabs>
      <v-tabs-items v-model="tab">
        <v-tab-item :key="0">
          <v-card class="rounded-b-xl">
            <div
              class="markdown-body p-4"
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
import { useFeedTheBeastProject, useFeedTheBeastVersionsCache } from '../composables/ftb'
import { useRefreshable, useService } from '@/composables'
import FeedTheBeastProjectVersion from './FeedTheBeastProjectVersion.vue'
import FeedTheBeastProjectChangelog from './FeedTheBeastProjectChangelog.vue'
import { useDialog } from '../composables/dialog'
import { AddInstanceDialogKey } from '../composables/instanceTemplates'
import { useMarkdown } from '@/composables/markdown'
import { swrvGet } from '@/util/swrvGet'
import { injection } from '@/util/inject'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { clientFTB } from '@/util/clients'

const { render } = useMarkdown()
const props = defineProps<{ id: number }>()

const { refreshing, manifest } = useFeedTheBeastProject(computed(() => props.id))
const { show } = useDialog(AddInstanceDialogKey)

const tab = ref(0)
const { t } = useI18n()
const avatar = computed(() => manifest.value?.art.find(a => a.type === 'square') || manifest.value?.art[0])
const title = computed(() => manifest.value?.name || '')
const shortDescription = computed(() => manifest.value?.synopsis ?? '')
const description = computed(() => manifest.value?.description ? render(manifest.value.description) : '')
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

const { cache: cachedList } = useFeedTheBeastVersionsCache()
const { cache, dedupingInterval } = injection(kSWRVConfig)
const { refresh: install, refreshing: installing } = useRefreshable(async () => {
  if (selectedVersionInstance.value) {
    const version = selectedVersionInstance.value
    // ensure the cached list has the version
    const versionManifest = await swrvGet(`/ftb/${props.id}/${version.id}`, () => clientFTB.getModpackVersionManifest({
      modpack: props.id,
      version,
    }), cache, dedupingInterval)
    if (!cachedList.value.find(v => v.id === version.id)) {
      cachedList.value.push({
        ...versionManifest,
        iconUrl: avatar.value?.url ?? '',
        projectName: title.value ?? '',
        authors: manifest.value?.authors ?? [],
      })
    }

    setTimeout(() => {
      show(`${props.id}-${version.id}`)
    }, 1000)
  }
})

</script>
