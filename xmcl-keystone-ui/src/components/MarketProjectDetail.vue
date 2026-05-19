<template>
  <div class="mod-detail contained w-full overflow-auto" @scroll="onScroll">
    <v-alert v-if="detail.archived" type="error" variant="tonal" class="rounded-0">
      {{ t('modInstall.archived', { name: detail.title }) }}
    </v-alert>
    <div class="header-container flex flex-grow gap-4 p-4">
      <div class="self-center">
        <v-skeleton-loader v-if="loading" width="128" height="128" type="card" />
        <img
          v-else
          v-fallback-img="BuiltinImages.unknownServer"
          width="128"
          height="128"
          class="rounded-xl"
          :src="detail.icon || BuiltinImages.unknownServer"
        />
      </div>
      <div class="flex flex-col flex-grow">
        <v-skeleton-loader v-if="loading" type="heading" class="mb-2" />
        <span
          v-else
          v-roving-tabindex
          role="toolbar"
          :aria-label="titleToDisplay"
          class="inline-flex items-center gap-2 text-2xl font-bold"
        >
          <a v-if="detail.url" target="browser" :href="detail.url">
            {{ titleToDisplay }}
          </a>
          <template v-else>
            {{ titleToDisplay }}
          </template>

          <v-btn
            icon
            variant="text"
            :loading="loading"
            color="grey"
            @click="emit('refresh')"
            size="small"
          >
            <v-icon size="20"> sync </v-icon>
          </v-btn>

          <div class="flex-grow" />
          <template v-if="modrinth">
            <v-menu>
              <template #activator="{ props }">
                <v-btn
                  :variant="!collection ? 'plain' : 'text'"
                  icon
                  :loading="loadingCollections"
                  size="small"
                >
                  <v-icon :class="!collection ? 'material-icons-outlined' : ''"> label </v-icon>
                </v-btn>
              </template>
              <AppCollectionList
                :project-id="modrinth"
                no-favorite
                :select="collection"
                @update:select="emit('collection', $event)"
              />
            </v-menu>
            <v-btn
              :variant="!followed ? 'plain' : 'text'"
              icon
              color="yellow"
              :loading="following"
              @click="emit('follow', !followed)"
              size="small"
            >
              <v-icon :class="followed ? '' : 'material-icons-outlined'">
                {{ followed ? 'star' : 'star_rate' }}
              </v-icon>
            </v-btn>
          </template>

          <AppCopyChip
            v-if="currentTarget === 'curseforge' ? curseforge : modrinth"
            label
            :value="(currentTarget === 'curseforge' ? curseforge : modrinth)?.toString() || ''"
            outlined
          />
        </span>
        <div class="ml-1 flex flex-grow-0 items-center gap-2 pt-1">
          <template v-if="loading">
            <v-skeleton-loader width="100" type="text" />
            <v-skeleton-loader width="100" type="text" />
            <v-skeleton-loader width="100" type="text" />
          </template>
          <template v-else>
            <template v-for="(h, i) of detailsHeaders" :key="h.id">
              <div class="flex flex-grow-0">
                <v-icon v-if="h.icon" :color="h.color" class="material-icons-outlined pb-0.5" start>
                  {{ h.icon }}
                </v-icon>
                <template v-if="h.id.endsWith('-author')">
                  <a href="#" @click.prevent="onAuthorClicked(h.text.trim())">{{ h.text }}</a>
                </template>
                <template v-else>
                  {{ h.text }}
                </template>
              </div>
              <v-divider v-if="i < detailsHeaders.length - 1" class="ml-1" vertical />
            </template>
          </template>
        </div>
        <div class="my-1 ml-1">
          <v-skeleton-loader v-if="loading" type="text, text" />
          <template v-else-if="descriptionToDisplay.includes('§')">
            <TextComponent :source="descriptionToDisplay" />
          </template>
          <template v-else>
            {{ descriptionToDisplay }}
          </template>
        </div>
        <div class="my-2 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end">
          <div class="flex items-end gap-2 flex-wrap">
            <v-btn
              v-if="selectedInstalled && !noEnabled"
              :disabled="updating"
              :loading="loadingVersions"
              hide-details
              @click="_enabled = !_enabled"
              size="small"
              variant="text"
              :color="enabled ? '' : 'primary'"
              border
            >
              <v-icon start>
                {{ enabled ? 'flash_off' : 'flash_on' }}
              </v-icon>
              {{ !enabled ? t('shared.enable') : t('shared.disable') }}
            </v-btn>
            <v-btn
              v-if="!selectedInstalled"
              data-testid="market-detail-install"
              class="primary"
              :loading="loadingVersions || updating"
              :disabled="!selectedVersion || loadingVersions || updating"
              @click="onInstall"
              size="small"
              color="primary"
            >
              <v-icon class="material-icons-outlined" start> file_download </v-icon>
              {{ !hasInstalledVersion ? t('shared.install') : t('modInstall.switch') }}
            </v-btn>
            <div
              v-if="!selectedInstalled"
              class="v-card border-transparent bg-transparent!"
              :class="{ 'theme--dark': isDark, 'theme--light': !isDark }"
            >
              <div class="v-card__subtitle overflow-hidden overflow-ellipsis p-0">
                {{
                  versions.length > 0
                    ? t('modInstall.installHint', {
                        file: 1,
                        dependencies: dependencies.filter((d) => d.type === 'required').length,
                      })
                    : t('modInstall.noVersionSupported', {
                        supported: supportedVersions?.join(', '),
                      })
                }}
              </div>
            </div>
            <v-btn
              v-if="selectedInstalled && !noDelete"
              class="red"
              :loading="loadingVersions"
              :disabled="!selectedVersion || updating"
              @click="emit('delete')"
              color="error"
              size="small"
            >
              <v-icon class="material-icons-outlined" start> delete </v-icon>
              {{ t('delete.yes') }}
            </v-btn>
          </div>

          <div class="flex-grow" />
          <div v-if="!noVersion" class="text-center">
            <v-menu open-on-hover :disabled="loadingVersions" offset-y>
              <template #activator="{ props }">
                <div
                  class="cursor-pointer items-center"
                  :class="{ flex: versions.length > 0, hidden: versions.length === 0 }"
                  style="color: var(--color-secondary-text)"
                  v-bind="props"
                >
                  <span class="mr-2 whitespace-nowrap font-bold">
                    {{ t('modInstall.currentVersion') }}:
                  </span>
                  <v-skeleton-loader
                    v-if="loadingVersions"
                    width="100"
                    type="text"
                    class="self-center"
                  />
                  <v-btn v-else hide-details size="small" variant="text" border>
                    <span
                      class="xl:max-w-50 max-w-40 overflow-hidden overflow-ellipsis whitespace-nowrap 2xl:max-w-full"
                    >
                      {{ selectedVersion?.name }}
                    </span>
                    <v-icon class="material-icons-outlined" end> arrow_drop_down </v-icon>
                  </v-btn>
                </div>
              </template>
              <v-list class="max-h-[400px] overflow-auto w-60">
                <v-list-item
                  v-for="(item, index) in versions"
                  :key="item.id + index"
                  :class="{ 'v-list-item--active': item.id === selectedVersion?.id }"
                  :value="item.installed"
                  :title="item.name"
                  :subtitle="item.version"
                  @click="selectedVersion = item"
                >
                  <template #prepend>
                    <v-avatar v-if="item.installed" class="self-center">
                      <v-icon size="small"> folder </v-icon>
                    </v-avatar>
                  </template>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </div>
      </div>
    </div>

    <v-tabs v-roving-tabindex role="tablist" v-model="tab" bg-color="transparent">
      <v-tab :value="0">
        {{ t('modrinth.description') }}
      </v-tab>
      <v-tab :value="1" :disabled="props.detail.galleries.length === 0">
        {{ t('modrinth.gallery') }}
      </v-tab>
      <v-tab v-if="versions.length > 0 && !noVersion" :value="2">
        {{ t('modrinth.versions') }}
      </v-tab>
    </v-tabs>
    <v-divider />

    <div class="grid w-full grid-cols-4 gap-2">
      <v-tabs-window
        v-model="tab"
        class="main-content h-full max-h-full max-w-full bg-transparent! p-4"
      >
        <v-tabs-window-item :value="0">
          <v-expansion-panels
            v-if="dependencies.length > 0"
            v-model="showDependencies"
            :disabled="dependencies.length === 0"
            class="mb-4"
            variant="accordion"
          >
            <v-expansion-panel>
              <v-expansion-panel-title>
                <span class="flex items-center gap-2">
                  {{ t('dependencies.name') }}
                  <v-chip size="x-small" label variant="tonal" color="primary">
                    {{ dependencies.length || 0 }}
                  </v-chip>
                </span>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <template v-if="loadingDependencies">
                  <v-skeleton-loader type="list-item-two-line, list-item-two-line" />
                  <v-skeleton-loader type="list-item-two-line, list-item-two-line" />
                  <v-skeleton-loader type="list-item-two-line, list-item-two-line" />
                </template>
                <template v-else>
                  <v-list lines="three" class="bg-transparent pa-0">
                    <v-list-item
                      v-for="dep of dependencies"
                      :key="dep.id + dep.parent"
                      :title="dep.title"
                      @click="emit('open-dependency', dep)"
                    >
                      <template #prepend>
                        <v-avatar>
                          <v-img :src="dep.icon" />
                        </v-avatar>
                      </template>
                      <template #subtitle>
                        <div class="dep-subtitle">
                          <div class="dep-subtitle__description">
                            {{ dep.description }}
                          </div>
                          <div class="dep-subtitle__meta flex gap-2 items-center">
                            <span v-if="dep.parent">
                              {{ dep.parent }}
                            </span>
                            <span
                              class="font-bold"
                              :class="{
                                'text-red-400': dep.type === 'incompatible',
                                'text-green-400': dep.type === 'required',
                              }"
                            >
                              {{ tDepType(dep.type) }}
                            </span>
                            <v-divider v-if="dep.installedVersion" vertical />
                            <span v-if="dep.installedVersion">
                              {{ t('shared.installed') }}
                            </span>
                            <v-divider v-if="dep.installedDifferentVersion" vertical />
                            <span v-if="dep.installedDifferentVersion">
                              {{
                                t('modInstall.dependencyHint', {
                                  version: dep.installedDifferentVersion,
                                })
                              }}
                            </span>
                          </div>
                        </div>
                      </template>
                      <template #append>
                        <v-btn
                          icon
                          variant="text"
                          :disabled="!!dep.installedVersion || dep.progress >= 0 || updating"
                          :loading="dep.progress >= 0"
                          @click.stop="onInstallDependency(dep)"
                        >
                          <v-icon class="material-icons-outlined"> file_download </v-icon>
                          <template #loader>
                            <v-progress-circular
                              v-if="dep.progress >= 0"
                              :size="20"
                              :width="2"
                              :model-value="dep.progress * 100"
                            />
                          </template>
                        </v-btn>
                      </template>
                    </v-list-item>
                  </v-list>
                </template>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
          <v-card-text v-if="loading" class="overflow-auto">
            <v-skeleton-loader
              type="heading, list-item, paragraph, card, sentences, image, paragraph, paragraph"
            />
          </v-card-text>
          <slot v-if="$slots.content" name="content" />
          <div
            v-else-if="detail.htmlContent"
            data-description-div
            class="markdown-body select-text whitespace-normal"
            :class="{ 'project-description': curseforge }"
            @click="onDescriptionDivClicked"
            v-html="(isEnabled && detail.localizedHtmlContent) || detail.htmlContent"
          />
          <template v-else-if="detail.description.includes('§')">
            <TextComponent :source="detail.description" />
          </template>
          <template v-else>
            {{ detail.description }}
          </template>
        </v-tabs-window-item>
        <v-tabs-window-item :value="1">
          <div class="gallery-grid p-4">
            <v-card
              v-for="(g, i) of detail.galleries"
              :key="g.url + g.title"
              class="gallery-card overflow-hidden"
              hover
              @click="onShowImage(detail.galleries, i)"
            >
              <div class="gallery-card__media">
                <v-img
                  :src="g.url"
                  :alt="g.title"
                  cover
                  class="gallery-card__image"
                  :aspect-ratio="16 / 9"
                >
                  <template #placeholder>
                    <div class="flex items-center justify-center fill-height">
                      <v-progress-circular indeterminate color="grey-lighten-2" />
                    </div>
                  </template>
                </v-img>
                <div class="gallery-card__overlay">
                  <v-icon size="40" color="white">zoom_in</v-icon>
                </div>
              </div>
              <div v-if="g.title || g.description || g.date" class="gallery-card__content">
                <div v-if="g.title" class="gallery-card__title">
                  {{ g.title }}
                </div>
                <div v-if="g.description" class="gallery-card__description">
                  {{ g.description }}
                </div>
                <div v-if="g.date" class="gallery-card__date">
                  <v-icon size="x-small" class="material-icons-outlined">schedule</v-icon>
                  {{ getDateString(g.date) }}
                </div>
              </div>
            </v-card>
          </div>
        </v-tabs-window-item>
        <v-tabs-window-item :value="2" class="h-full p-l-[2px]">
          <v-skeleton-loader v-if="loadingVersions" type="table-thead, table-tbody" />
          <div
            v-else-if="versions.length > 0"
            v-roving-tabindex
            role="listbox"
            :aria-label="t('modrinth.versions')"
          >
            <v-list-subheader v-if="installed">
              {{ t('shared.installed') }}
            </v-list-subheader>
            <ModDetailVersion
              v-if="installed"
              :key="installed.id"
              :version="installed"
              :show-changelog="selectedVersion?.id === installed.id"
              @click="onVersionClicked"
            />
            <v-divider v-if="installed && notInstalled.length > 0" class="my-2" />
            <ModDetailVersion
              v-for="version of notInstalled"
              :key="version.id"
              :version="version"
              :show-changelog="selectedVersion?.id === version.id"
              @click="onVersionClicked"
            />
          </div>
          <Hint
            v-else
            class="h-full"
            :size="100"
            icon="cancel"
            :text="t('modInstall.noVersionSupported')"
          />
        </v-tabs-window-item>
      </v-tabs-window>
      <aside class="side-content">
        <template v-if="curseforge || modrinth">
          <v-list-subheader>
            {{ t('modInstall.source') }}
          </v-list-subheader>
          <template v-if="loading">
            <v-skeleton-loader type="avatar" />
          </template>
          <span v-else class="flex flex-wrap gap-2 px-2" v-roving-tabindex role="toolbar">
            <v-btn
              v-if="modrinth"
              icon
              :color="currentTarget === 'modrinth' ? 'primary' : ''"
              @click="goModrinthProject(modrinth)"
              variant="text"
            >
              <v-icon> xmcl:modrinth </v-icon>
            </v-btn>
            <v-btn
              v-if="curseforge"
              icon
              :color="currentTarget === 'curseforge' ? 'primary' : ''"
              @click="goCurseforgeProject(curseforge)"
              variant="text"
            >
              <v-icon class="mt-0.5" :size="30"> xmcl:curseforge </v-icon>
            </v-btn>
          </span>

          <v-divider class="mt-4 w-full" />
        </template>

        <template v-if="validModLoaders.length > 0">
          <v-list-subheader>
            {{ t('modrinth.modLoaders.name') }}
          </v-list-subheader>
          <span class="flex flex-wrap gap-2 px-2">
            <div v-for="l of validModLoaders" :key="l" style="width: 36px; height: 36px">
              <v-icon v-shared-tooltip="l" size="32px">
                {{ iconMapping[l] }}
              </v-icon>
            </div>
          </span>
          <v-divider class="mt-4 w-full" />
        </template>

        <v-list-subheader v-if="detail.categories.length > 0">
          {{ t('modrinth.categories.categories') }}
        </v-list-subheader>
        <span class="flex flex-wrap gap-2" v-roving-tabindex role="toolbar">
          <template v-if="loading">
            <v-skeleton-loader type="chip" />
            <v-skeleton-loader type="chip" />
            <v-skeleton-loader type="chip" />
          </template>
          <template v-else>
            <v-chip
              v-for="item of detail.categories"
              :key="item.id"
              label
              variant="outlined"
              class="mr-2"
              @mousedown.prevent
              @click="emit('select:category', item.id)"
            >
              <template #prepend>
                <v-avatar v-if="item.iconHTML" start v-html="item.iconHTML" />
                <v-icon v-else-if="item.icon" start>{{ item.icon }}</v-icon>
                <v-avatar v-else-if="item.iconUrl" start>
                  <v-img :src="item.iconUrl" />
                </v-avatar>
              </template>
              {{ item.name }}
            </v-chip>
          </template>
        </span>

        <v-divider
          v-if="detail.externals.length > 0 && detail.categories.length > 0"
          class="mt-4 w-full"
        />

        <v-list-subheader v-if="detail.externals.length > 0">
          {{ t('modrinth.externalResources') }}
        </v-list-subheader>
        <div v-if="detail.externals.length > 0 || loading" class="flex flex-col gap-1" v-roving-tabindex role="toolbar">
          <template v-if="loading">
            <v-skeleton-loader type="list-item, list-item, list-item" />
          </template>
          <template v-else>
            <a
              v-for="item of detail.externals"
              :key="item.name + item.url"
              :href="item.url"
              target="_blank"
              rel="noopener"
              class="external-row"
            >
              <v-icon size="small" class="external-row__icon">
                {{ item.icon }}
              </v-icon>
              <span class="external-row__label">{{ item.name }}</span>
              <v-icon size="x-small" class="external-row__arrow"> open_in_new </v-icon>
            </a>
          </template>
        </div>

        <v-divider
          v-if="detail.info.length > 0 && detail.externals.length > 0"
          class="mt-4 w-full"
        />

        <div v-if="detail.info.length > 0">
          <v-list-subheader>
            {{ t('modrinth.technicalInformation') }}
          </v-list-subheader>
          <div class="flex flex-col gap-2" v-roving-tabindex role="toolbar">
            <template v-if="loading">
              <v-skeleton-loader type="list-item-two-line" />
              <v-skeleton-loader type="list-item-two-line" />
              <v-skeleton-loader type="list-item-two-line" />
            </template>
            <template v-else>
              <div v-for="item of detail.info" :key="item.name" class="info-row">
                <div class="info-row__header">
                  <v-icon size="x-small" class="info-row__icon">
                    {{ item.icon }}
                  </v-icon>
                  <span class="info-row__label">{{ item.name }}</span>
                </div>
                <div class="info-row__value">
                  <a
                    v-if="item.url"
                    :href="item.url"
                    target="_blank"
                    rel="noopener"
                    class="info-row__text info-row__text--link truncate"
                    v-shared-tooltip="item.value"
                  >
                    {{ item.value }}
                  </a>
                  <span v-else v-shared-tooltip="item.value" class="info-row__text truncate">
                    {{ item.value }}
                  </span>
                  <AppCopyChip :value="item.value" outlined class="info-row__copy" />
                </div>
              </div>
            </template>
          </div>
        </div>

        <slot name="properties" />
      </aside>
    </div>
  </div>
</template>
<script setup lang="ts">
import Hint from '@/components/Hint.vue'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import ModDetailVersion, { ProjectVersion } from './MarketProjectDetailVersion.vue'
import AppCopyChip from './AppCopyChip.vue'
import { kImageDialog } from '@/composables/imageDialog'
import { useDateString } from '@/composables/date'
import { kTheme } from '@/composables/theme'
import { kSearchModel } from '@/composables/search'
import { clientCurseforgeV1 } from '@/util/clients'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { vFallbackImg } from '@/directives/fallbackImage'
import { BuiltinImages } from '@/constant'
import { kLocalizedContent, useLocalizedContentControl } from '@/composables/localizedContent'
import AppCollectionList from './AppCollectionList.vue'

const props = defineProps<{
  detail: ProjectDetail
  versions: ProjectVersion[]
  enabled: boolean
  error?: any
  updating?: boolean
  dependencies: ProjectDependency[]
  loading: boolean
  loadingDependencies?: boolean
  loadingVersions: boolean
  selectedInstalled: boolean
  supportedVersions?: string[]
  noDelete?: boolean
  noEnabled?: boolean
  noVersion?: boolean
  hasMore: boolean
  curseforge?: number
  modrinth?: string
  currentTarget?: 'curseforge' | 'modrinth'
  followed?: boolean
  following?: boolean
  loadingCollections?: boolean
  collection?: string
}>()

const emit = defineEmits<{
  (event: 'load-changelog', version: ProjectVersion): void
  (event: 'load-more'): void
  (event: 'install', version: ProjectVersion): void
  (event: 'install-dependency', dep: ProjectDependency): void
  (event: 'delete'): void
  (event: 'enable', value: boolean): void
  (event: 'open-dependency', dep: ProjectDependency): void
  (event: 'select:category', category: string): void
  (event: 'refresh'): void
  (event: 'description-link-clicked', e: MouseEvent, href: string): void
  (event: 'follow', followed: boolean): void
  (event: 'collection', collection?: string): void
}>()

export interface ProjectDependency {
  /**
   * The id of the dependency
   */
  id: string
  icon?: string
  /**
   * The title of the dependency
   */
  title: string
  /**
   * The description of the dependency
   */
  description: string
  /**
   * The version of the dependency that is required
   */
  version: string
  type: 'required' | 'optional' | 'incompatible' | 'embedded'
  /**
   * The parent project. Only present when the dependency's parent is not the current project
   */
  parent?: string
  /**
   * The progress of the installation. <= 0 means not installing
   */
  progress: number
  /**
   * The version of the dependency that is installed
   */
  installedVersion?: string
  /**
   * The version of the dependency that is installed but different from the required version
   */
  installedDifferentVersion?: string
}

export interface ModGallery {
  title: string
  description: string
  date?: string
  url: string
  rawUrl?: string
}
export interface CategoryItem {
  id: string
  name: string
  icon?: string
  iconUrl?: string
  iconHTML?: string
}
export interface ExternalResource {
  icon: string
  name: string
  url: string
}
export interface Info {
  icon: string
  name: string
  value: string
  url?: string
}
export interface ProjectDetail {
  id: string
  icon: string
  title: string
  localizedTitle?: string
  description: string
  localizedDescription?: string
  author: string
  downloadCount: number
  follows: number
  url: string
  categories: CategoryItem[]
  modLoaders: string[]
  htmlContent: string
  localizedHtmlContent?: string
  externals: ExternalResource[]
  galleries: ModGallery[]
  info: Info[]
  archived?: boolean
}
const tab = ref(0)

const _enabled = computed({
  get() {
    return props.enabled
  },
  set(v: boolean) {
    emit('enable', v)
  },
})

const titleToDisplay = computed(
  () =>
    (isEnabled.value && props.detail.localizedTitle) ||
    props.detail.title ||
    props.error?.name ||
    '',
)
const descriptionToDisplay = computed(
  () =>
    (isEnabled.value && props.detail.localizedDescription) ||
    props.detail.description ||
    props.error?.message ||
    '',
)

const detailsHeaders = computed(() => {
  const result: Array<{
    id: string
    icon: string
    text: string
    color?: string
  }> = []

  if (props.detail.author) {
    result.push({
      id: `${props.detail.id}-author`,
      icon: 'person',
      text: props.detail.author,
    })
  }

  if (props.detail.downloadCount) {
    result.push({
      id: `${props.detail.id}-download`,
      icon: 'file_download',
      text: getExpectedSize(props.detail.downloadCount, ''),
    })
  }
  if (props.detail.follows) {
    result.push({
      id: `${props.detail.id}-follow`,
      icon: 'star_rate',
      color: 'orange',
      text: props.detail.follows.toString(),
    })
  }

  return result
})

const { getDateString } = useDateString()
const hasInstalledVersion = computed(() => props.versions.some((v) => v.installed))

const { push, replace, currentRoute } = useRouter()
const goCurseforgeProject = (id: number) => {
  replace({ query: { ...currentRoute.value.query, id: `curseforge:${id}` } })
}
const goModrinthProject = (id: string) => {
  replace({ query: { ...currentRoute.value.query, id: `modrinth:${id}` } })
}
const { isDark } = injection(kTheme)
const searchModel = injection(kSearchModel)

function onAuthorClicked(name: string) {
  if (searchModel) {
    searchModel.keyword.value = name
    searchModel.source.value = 'remote'
  }
  replace({
    query: { ...currentRoute.value.query, keyword: name, source: 'remote', id: undefined },
  })
}

const selectedVersion = inject(
  'selectedVersion',
  ref(props.versions.find((v) => v.installed) || (props.versions[0] as ProjectVersion | undefined)),
)
const onVersionClicked = (version: ProjectVersion) => {
  if (!selectedVersion.value || selectedVersion.value?.id === version.id) return
  selectedVersion.value = version
}
watch(
  selectedVersion,
  (v, o) => {
    if (v !== o && v) {
      emit('load-changelog', v)
    }
  },
  { immediate: true },
)
const { t } = useI18n()
watch(
  () => props.detail,
  (d, o) => {
    if (d?.id !== o?.id) {
      showDependencies.value = undefined
      selectedVersion.value = undefined
      tab.value = 0
    }
  },
)

let dirty = false
watch(
  [() => props.detail, () => props.loading],
  () => {
    dirty = true
  },
  { immediate: true },
)
watch(
  () => props.versions,
  (vers) => {
    if (dirty || !selectedVersion.value) {
      dirty = false
      selectedVersion.value = props.versions.find((v) => v.installed) || vers[0]
    }
  },
  { immediate: true },
)

const showDependencies = ref<0 | undefined>(undefined)

const installed = computed(() => props.versions.find((v) => v.installed))
const notInstalled = computed(() => props.versions.filter((v) => !v.installed))

const tDepType = (ty: ProjectDependency['type']) => t(`dependencies.${ty}`)

const onInstall = () => {
  if (!props.updating && !props.loadingVersions && selectedVersion.value) {
    emit('install', selectedVersion.value)
  }
}

const onInstallDependency = (dep: ProjectDependency) => {
  if (props.updating || dep.installedVersion || dep.progress >= 0) return
  emit('install-dependency', dep)
}

const onScroll = (e: Event) => {
  const t = e.target as HTMLElement
  if (t.scrollTop + t.clientHeight >= t.scrollHeight && tab.value === 3) {
    emit('load-more')
  }
}

// Image
const imageDialog = injection(kImageDialog)
const onShowImage = (imgs: ModGallery[], index: number) => {
  imageDialog.showAll(
    imgs.map((img) => ({
      src: img.rawUrl || img.url,
      description: img.description,
      date: img.date,
    })),
    index,
  )
}

// Content clicked
function onDescriptionDivClicked(e: MouseEvent) {
  const isHTMLElement = (e: unknown): e is HTMLElement => {
    return !!e && e instanceof HTMLElement
  }
  let ele = e.target
  while (isHTMLElement(ele) && !ele.attributes.getNamedItem('data-description-div')) {
    if (ele.tagName === 'A') {
      const href = ele.getAttribute('href')

      if (href) {
        onDescriptionLinkClicked(e, href)
        break
      }
    }
    ele = ele.parentElement
  }
}

const iconMapping = {
  forge: 'xmcl:forge',
  fabric: 'xmcl:fabric',
  quilt: 'xmcl:quilt',
  optifine: 'xmcl:optifine',
  neoforge: 'xmcl:neoForged',
  iris: 'xmcl:iris',
  oculus: 'xmcl:oculus',
} as Record<string, string>

const validModLoaders = computed(() => {
  return props.detail.modLoaders.filter((l) => iconMapping[l])
})

const { isEnabled } = inject(kLocalizedContent, useLocalizedContentControl())

function onDescriptionLinkClicked(e: MouseEvent, href: string) {
  const url = new URL(href)
  if (url.host === 'modrinth.com') {
    const slug = url.pathname.split('/')[2] ?? ''
    let domain: string = ''
    if (url.pathname.startsWith('/mod/')) {
      domain = 'mods'
    } else if (url.pathname.startsWith('/shaders/')) {
      domain = 'shaderpacks'
    } else if (url.pathname.startsWith('/resourcepacks/')) {
      domain = 'resourcepacks'
    } else if (url.pathname.startsWith('/modpacks')) {
      domain = 'modpacks'
    }

    if (domain !== 'modpacks' && slug && domain) {
      push({ query: { ...currentRoute.value.query, id: `modrinth:${slug}` } })
      e.preventDefault()
      e.stopPropagation()
    }
  }
  if (
    (url.host === 'www.curseforge.com' || url.host === 'curseforge.com') &&
    url.pathname.startsWith('/minecraft')
  ) {
    const slug = url.pathname.split('/')[3] ?? ''
    let domain: string = ''
    if (url.pathname.startsWith('/minecraft/mc-mods/')) {
      domain = 'mods'
    } else if (url.pathname.startsWith('/texture-packs/')) {
      domain = 'resourcepacks'
    } else if (url.pathname.startsWith('/modpacks')) {
      domain = 'modpacks'
    }

    if (domain && domain !== 'modpacks' && slug) {
      clientCurseforgeV1.searchMods({ slug, pageSize: 1 }).then((result) => {
        const id = result.data[0]?.id
        if (id) {
          push({ query: { ...currentRoute.value.query, id: `curseforge:${id}` } })
        } else {
          window.open(href, '_blank')
        }
      })
      e.preventDefault()
      e.stopPropagation()
    }
  }
}
</script>

<style>
.mod-detail .v-badge__badge.primary {
  right: -10px;
  height: 20px;
  font-size: 12px;
}
</style>
<style scoped>
.main-content {
  grid-column: span 4 / span 4;
}
.side-content {
  grid-column: span 4 / span 4;
  margin-bottom: 10px;
}
.header-container {
  flex-direction: column;
}

@container (min-width: 450px) {
  .main-content {
    -ms-grid-column-span: span 3 / span 3;
    grid-column: span 3 / span 3;
  }
  .side-content {
    -ms-grid-column-span: span 1 / span 1;
    grid-column: span 1 / span 1;
  }
  .header-container {
    flex-direction: row;
  }
}

/* External resource link rows */
.external-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  color: inherit;
  text-decoration: none;
  transition: background-color 0.15s ease;
}
.external-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}
.external-row:hover .external-row__arrow {
  opacity: 1;
  transform: translate(2px, -2px);
}
.external-row__icon {
  flex-shrink: 0;
  opacity: 0.75;
}
.external-row__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
}
.external-row__arrow {
  flex-shrink: 0;
  opacity: 0.4;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

/* Technical info rows */
.info-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 6px;
  background-color: rgba(var(--v-theme-on-surface), 0.03);
}
.info-row__header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.info-row__icon {
  opacity: 0.6;
}
.info-row__label {
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}
.info-row__value {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.info-row__text {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.875rem;
  color: inherit;
  text-decoration: none;
}
.info-row__text--link {
  text-decoration: underline;
  text-decoration-color: rgba(var(--v-theme-on-surface), 0.2);
  text-underline-offset: 2px;
}
.info-row__text--link:hover {
  text-decoration-color: currentColor;
}
.info-row__copy {
  flex-shrink: 0;
}

/* Dependency list subtitle layout */
.dep-subtitle {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dep-subtitle__description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dep-subtitle__meta {
  font-size: 0.75rem;
}

/* Gallery grid layout */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.gallery-card {
  display: flex;
  flex-direction: column;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.gallery-card:hover {
  transform: translateY(-2px);
}
.gallery-card:hover .gallery-card__image :deep(img) {
  transform: scale(1.05);
}
.gallery-card:hover .gallery-card__overlay {
  opacity: 1;
}

.gallery-card__media {
  position: relative;
  overflow: hidden;
}
.gallery-card__image :deep(img) {
  transition: transform 0.4s ease;
}
.gallery-card__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.35);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.gallery-card__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
}
.gallery-card__title {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
}
.gallery-card__description {
  font-size: 0.8rem;
  line-height: 1.4;
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}
.gallery-card__date {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 0.7rem;
  opacity: 0.6;
}

span {
  /* @apply dark:text-gray-400 text-gray-600; */
}

.contained {
  container-type: inline-size;
}
</style>
