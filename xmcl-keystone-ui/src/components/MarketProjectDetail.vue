<template>
  <div
    class="mod-detail contained w-full overflow-auto"
    @scroll="onScroll"
  >
    <v-alert
      v-if="detail.archived"
      type="error"
      text
      tile
    >
      {{ t('modInstall.archived', { name: detail.title }) }}
    </v-alert>
    <div class="header-container flex flex-grow gap-4 p-4">
      <div class="self-center">
        <v-skeleton-loader
          v-if="loading"
          width="128"
          height="128"
          type="card"
        />
        <img
          v-else
          v-fallback-img="BuiltinImages.unknownServer"
          width="128"
          height="128"
          class="rounded-xl"
          :src="detail.icon || BuiltinImages.unknownServer"
        >
      </div>
      <div class="flex flex-col">
        <v-skeleton-loader
          v-if="loading"
          type="heading"
          class="mb-2"
        />
        <span
          v-else
          class="inline-flex items-center gap-2 text-2xl font-bold"
        >
          <a
            v-if="detail.url"
            target="browser"
            :href="detail.url"
          >
            {{ detail.title }}
          </a>
          <template v-else>
            {{ detail.title }}
          </template>

          <v-btn
            icon
            small
            :loading="loading"
            color="grey"
            @click="emit('refresh')"
          >
            <v-icon size="20">
              sync
            </v-icon>
          </v-btn>
        </span>
        <div class="ml-1 flex flex-grow-0 items-center gap-2 pt-1">
          <template v-if="loading">
            <v-skeleton-loader
              width="100"
              type="text"
            />
            <v-skeleton-loader
              width="100"
              type="text"
            />
            <v-skeleton-loader
              width="100"
              type="text"
            />
          </template>
          <template v-else>
            <template
              v-for="(h, i) of detailsHeaders"
            >
              <div
                :key="h.text"
                class="flex flex-grow-0"
              >
                <v-icon
                  v-if="h.icon"
                  :color="h.color"
                  class="material-icons-outlined pb-0.5"
                  left
                >
                  {{ h.icon }}
                </v-icon>
                {{ h.text }}
              </div>
              <v-divider
                v-if="i < detailsHeaders.length - 1"
                :key="i"
                class="ml-1"
                vertical
              />
            </template>
          </template>
        </div>
        <div class="my-1 ml-1">
          <v-skeleton-loader
            v-if="loading"
            type="text, text"
          />
          <template v-else-if="detail.description.includes('§')">
            <TextComponent :source="detail.description" />
          </template>
          <template v-else>
            {{ detail.description }}
          </template>
        </div>
        <div
          class="my-2 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end"
        >
          <div class="flex items-end gap-2">
            <v-btn
              v-if="selectedInstalled && !noEnabled"
              :disabled="updating"
              :loading="loadingVersions"
              small
              plain
              outlined
              hide-details
              @click="_enabled = !_enabled"
            >
              <v-icon left>
                {{ enabled ? 'flash_off' : 'flash_on' }}
              </v-icon>
              {{ !enabled ? t('enable') : t('disable') }}
            </v-btn>
            <v-btn
              v-if="!selectedInstalled"
              class="primary"
              :loading="loadingVersions || updating"
              :disabled="!selectedVersion"
              small
              @click="onInstall"
            >
              <v-icon
                class="material-icons-outlined"
                left
              >
                file_download
              </v-icon>
              {{ !hasInstalledVersion ? t('modInstall.install') : t('modInstall.switch') }}
            </v-btn>
            <div
              v-if="!selectedInstalled"
              class="v-card border-transparent bg-transparent!"
              :class="{ 'theme--dark': isDark, 'theme--light': !isDark }"
            >
              <div class="v-card__subtitle overflow-hidden overflow-ellipsis whitespace-nowrap p-0">
                {{
                  versions.length > 0 ?
                    t('modInstall.installHint', { file: 1, dependencies: dependencies.filter(d => d.type === 'required').length })
                    : t('modInstall.noVersionSupported', {
                      supported: supportedVersions?.join(', ')
                    })
                }}
              </div>
            </div>
            <v-btn
              v-if="selectedInstalled && !noDelete"
              class="red"
              :loading="loadingVersions"
              :disabled="!selectedVersion || updating"
              small
              @click="emit('delete')"
            >
              <v-icon
                class="material-icons-outlined"
                left
              >
                delete
              </v-icon>
              {{ t('delete.yes') }}
            </v-btn>
          </div>

          <div class="flex-grow" />
          <div
            v-if="!noVersion"
            class="text-center"
          >
            <v-menu
              open-on-hover
              :disabled="loadingVersions"
              offset-y
            >
              <template #activator="{ on, attrs }">
                <div
                  class="cursor-pointer items-center"
                  :class="{ flex: versions.length > 0, hidden: versions.length === 0 }"
                  style="color: var(--color-secondary-text)"
                  v-bind="attrs"
                  v-on="on"
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
                  <v-btn
                    v-else
                    small
                    plain
                    outlined
                    hide-details
                  >
                    <span class="xl:max-w-50 max-w-40 overflow-hidden overflow-ellipsis whitespace-nowrap 2xl:max-w-full">

                      {{ selectedVersion?.name }}
                    </span>
                    <v-icon
                      class="material-icons-outlined"
                      right
                    >
                      arrow_drop_down
                    </v-icon>
                  </v-btn>
                </div>
              </template>
              <v-list
                class="max-h-[400px] overflow-auto"
                dense
              >
                <v-list-item
                  v-for="(item, index) in versions"
                  :key="index"
                  :class="{ 'v-list-item--active': item === selectedVersion }"
                  :value="item.installed"
                  @click="selectedVersion = item"
                >
                  <v-list-item-content>
                    <v-list-item-title>{{ item.name }}</v-list-item-title>
                    <v-list-item-subtitle>{{ item.version }}</v-list-item-subtitle>
                  </v-list-item-content>
                  <v-list-item-avatar
                    class="self-center"
                  >
                    <v-icon
                      v-if="item.installed"
                      small
                    >
                      folder
                    </v-icon>
                  </v-list-item-avatar>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </div>
      </div>
    </div>

    <v-tabs
      v-model="tab"
      background-color="transparent"
    >
      <v-tab>
        {{ t('modrinth.description') }}
      </v-tab>
      <v-tab :disabled="props.detail.galleries.length === 0">
        {{ t('modrinth.gallery') }}
      </v-tab>
      <v-tab v-if="versions.length > 0 && !noVersion">
        {{ t('modrinth.versions') }}
      </v-tab>
    </v-tabs>
    <v-divider />

    <div class="grid w-full grid-cols-4 gap-2">
      <v-tabs-items
        v-model="tab"
        class="main-content h-full max-h-full max-w-full bg-transparent! p-4"
      >
        <v-tab-item>
          <v-expansion-panels
            v-if="dependencies.length > 0"
            v-model="showDependencies"
            :disabled="dependencies.length === 0"
            class="mb-4"
          >
            <v-expansion-panel>
              <v-expansion-panel-header>
                <span>
                  <v-badge
                    inline
                    :content="dependencies.length || '0'"
                  >
                    {{ t('dependencies.name') }}
                  </v-badge>
                </span>
              </v-expansion-panel-header>
              <v-expansion-panel-content>
                <div class="">
                  <template
                    v-if="loadingDependencies"
                  >
                    <v-skeleton-loader
                      type="list-item-two-line, list-item-two-line"
                    />
                    <v-skeleton-loader
                      type="list-item-two-line, list-item-two-line"
                    />
                    <v-skeleton-loader
                      type="list-item-two-line, list-item-two-line"
                    />
                  </template>
                  <template v-else>
                    <v-list-item
                      v-for="dep of dependencies"
                      :key="dep.id"
                      @click="emit('open-dependency', dep)"
                    >
                      <v-list-item-avatar>
                        <v-img :src="dep.icon" />
                      </v-list-item-avatar>
                      <v-list-item-content>
                        <v-list-item-title>
                          {{ dep.title }}
                        </v-list-item-title>
                        <v-list-item-subtitle>
                          {{ dep.description }}
                        </v-list-item-subtitle>
                        <v-list-item-subtitle class="flex gap-2">
                          <div v-if="dep.parent">
                            {{ dep.parent }}
                          </div>
                          <div
                            class="inline font-bold"
                            :class="{
                              'text-red-400': dep.type === 'incompatible',
                              'text-green-400': dep.type === 'required'
                            }"
                          >
                            {{ tDepType(dep.type) }}
                          </div>
                          <v-divider
                            v-if="dep.installedVersion"
                            vertical
                          />
                          <div v-if="dep.installedVersion">
                            {{ t('modInstall.installed') }}
                          </div>
                          <v-divider
                            v-if="dep.installedDifferentVersion"
                            vertical
                          />
                          <span v-if="dep.installedDifferentVersion">
                            {{ t('modInstall.dependencyHint', { version: dep.installedDifferentVersion }) }}
                          </span>
                        </v-list-item-subtitle>
                      </v-list-item-content>
                      <v-list-item-action class="self-center">
                        <v-btn
                          text
                          icon
                          :disabled="!!dep.installedVersion"
                          :loading="dep.progress >= 0"
                          @click.stop="emit('install-dependency', dep)"
                        >
                          <v-icon class="material-icons-outlined">
                            file_download
                          </v-icon>
                          <template #loader>
                            <v-progress-circular
                              v-if="dep.progress >= 0"
                              :size="20"
                              :width="2"
                              :value="dep.progress * 100"
                            />
                          </template>
                        </v-btn>
                      </v-list-item-action>
                    </v-list-item>
                  </template>
                </div>
              </v-expansion-panel-content>
            </v-expansion-panel>
          </v-expansion-panels>
          <v-card-text
            v-if="loading"
            class="overflow-auto"
          >
            <v-skeleton-loader type="heading, list-item, paragraph, card, sentences, image, paragraph, paragraph" />
          </v-card-text>
          <div
            v-else-if="detail.htmlContent"
            data-description-div
            class="markdown-body select-text whitespace-normal"
            :class="{ 'project-description': curseforge }"
            @click="onDescriptionDivClicked"
            v-html="detail.htmlContent"
          />
          <template v-else-if="detail.description.includes('§')">
            <TextComponent :source="detail.description" />
          </template>
          <template v-else>
            {{ detail.description }}
          </template>
        </v-tab-item>
        <v-tab-item>
          <div class="grid grid-cols-2 gap-2 p-4">
            <v-card
              v-for="g of detail.galleries"
              :key="g.url + g.title"
              hover
              @click="onShowImage(g)"
            >
              <v-img
                :src="g.url"
                height="200px"
              />
              <v-card-title>
                {{ g.title }}
              </v-card-title>
              <v-card-subtitle>
                {{ g.description }}
                <div v-if="g.date">
                  {{ getDateString(g.date) }}
                </div>
              </v-card-subtitle>
            </v-card>
          </div>
        </v-tab-item>
        <v-tab-item class="h-full">
          <v-skeleton-loader
            v-if="loadingVersions"
            type="table-thead, table-tbody"
          />
          <template v-else-if="versions.length > 0">
            <v-subheader
              v-if="installed"
            >
              {{ t('modInstall.installed') }}
            </v-subheader>
            <ModDetailVersion
              v-if="installed"
              :key="installed.id"
              :version="installed"
              :show-changelog="selectedVersion?.id === installed.id"
              @click="onVersionClicked"
            />
            <v-divider
              v-if="installed && notInstalled.length > 0"
              class="my-2"
            />
            <ModDetailVersion
              v-for="version of notInstalled"
              :key="version.id"
              :version="version"
              :show-changelog="selectedVersion?.id === version.id"
              @click="onVersionClicked"
            />
          </template>
          <Hint
            v-else
            class="h-full"
            :size="100"
            icon="cancel"
            :text="t('modInstall.noVersionSupported')"
          />
        </v-tab-item>
      </v-tabs-items>
      <aside
        class="side-content"
      >
        <template v-if="curseforge || modrinth">
          <v-subheader>
            {{ t('modInstall.source') }}
          </v-subheader>
          <template v-if="loading">
            <v-skeleton-loader
              type="avatar"
            />
          </template>
          <span
            v-else
            class="flex flex-wrap gap-2 px-2"
          >
            <v-btn
              v-if="modrinth"
              text
              icon
              :color="currentTarget === 'modrinth' ? 'primary' : ''"
              @click="goModrinthProject(modrinth)"
            >
              <v-icon>
                $vuetify.icons.modrinth
              </v-icon>
            </v-btn>
            <v-btn
              v-if="curseforge"
              text
              icon
              :color="currentTarget === 'curseforge' ? 'primary' : ''"
              @click="goCurseforgeProject(curseforge)"
            >
              <v-icon
                class="mt-0.5"
                :size="30"
              >
                $vuetify.icons.curseforge
              </v-icon>
            </v-btn>
          </span>

          <v-divider
            class="mt-4 w-full"
          />
        </template>

        <template v-if="validModLoaders.length > 0">
          <v-subheader>
            {{ t('modrinth.modLoaders.name') }}
          </v-subheader>
          <span class="flex flex-wrap gap-2 px-2">
            <div
              v-for="l of validModLoaders"
              :key="l"
              style="width: 36px; height: 36px;"
            >
              <v-icon
                v-shared-tooltip="l"
                size="32px"
              >
                {{ iconMapping[l] }}
              </v-icon>
            </div>
          </span>
          <v-divider
            class="mt-4 w-full"
          />
        </template>

        <v-subheader v-if="detail.categories.length > 0">
          {{ t('modrinth.categories.categories') }}
        </v-subheader>
        <span class="flex flex-wrap gap-2">
          <template v-if="loading">
            <v-skeleton-loader
              type="chip"
            />
            <v-skeleton-loader
              type="chip"
            />
            <v-skeleton-loader
              type="chip"
            />
          </template>
          <template v-else>
            <v-chip
              v-for="item of detail.categories"
              :key="item.id"
              label
              outlined
              class="mr-2"
              @mousedown.prevent
              @click="emit('select:category', item.id)"
            >
              <v-avatar
                v-if="item.iconHTML"
                left
                v-html="item.iconHTML"
              />
              <v-icon
                v-else-if="item.icon"
                left
              >{{ item.icon }}</v-icon>
              <v-avatar
                v-else-if="item.iconUrl"
                left
              >
                <v-img :src="item.iconUrl" />
              </v-avatar>
              {{ item.name }}
            </v-chip>
          </template>
        </span>

        <v-divider
          v-if="detail.externals.length > 0 && detail.categories.length > 0"
          class="mt-4 w-full"
        />

        <v-subheader v-if="detail.externals.length > 0">
          {{ t('modrinth.externalResources') }}
        </v-subheader>
        <div class="px-1">
          <template v-if="loading">
            <v-skeleton-loader
              type="sentences, sentences"
            />
          </template>
          <template
            v-else
          >
            <span
              v-for="item of detail.externals"
              :key="item.name + item.url"
              class="flex flex-grow-0 items-center gap-1"
            >
              <v-icon>
                {{ item.icon }}
              </v-icon>
              <a :href="item.url">
                {{ item.name }}
              </a>
            </span>
          </template>
        </div>

        <v-divider
          v-if="detail.info.length > 0 && detail.externals.length > 0"
          class="mt-4 w-full"
        />

        <div
          v-if="detail.info.length > 0"
          class="px-1"
        >
          <v-subheader>
            {{ t('modrinth.technicalInformation') }}
          </v-subheader>
          <div class="grid grid-cols-1 gap-1 gap-y-3 overflow-auto overflow-y-hidden pr-2">
            <template v-if="loading">
              <v-skeleton-loader
                type="chip"
              />
              <v-skeleton-loader
                type="chip"
              />
              <v-skeleton-loader
                type="chip"
              />
              <v-skeleton-loader
                type="chip"
              />
            </template>
            <template v-else>
              <div
                v-for="item of detail.info"
                :key="item.name"
                class="item"
              >
                <v-icon>{{ item.icon }}</v-icon>
                <div class="overflow-x-auto overflow-y-hidden">
                  <span>{{ item.name }}</span>
                  <a
                    v-if="item.url"
                    :href="item.url"
                  >
                    {{ item.value }}
                  </a>
                  <AppCopyChip
                    :value="item.value"
                    outlined
                  />
                </div>
              </div>
            </template>
          </div>
        </div>
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
import { clientCurseforgeV1 } from '@/util/clients'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { vFallbackImg } from '@/directives/fallbackImage'
import { BuiltinImages } from '@/constant'

const props = defineProps<{
  detail: ProjectDetail
  versions: ProjectVersion[]
  enabled: boolean
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
  description: string
  author: string
  downloadCount: number
  follows: number
  url: string
  categories: CategoryItem[]
  modLoaders: string[]
  htmlContent: string
  externals: ExternalResource[]
  galleries: ModGallery[]
  info: Info[]
  archived?: boolean
}
const tab = ref(0)

const _enabled = computed({
  get() { return props.enabled },
  set(v: boolean) {
    emit('enable', v)
  },
})

const detailsHeaders = computed(() => {
  const result: Array<{
    icon: string
    text: string
    color?: string
  }> = []

  if (props.detail.author) {
    result.push({
      icon: 'person',
      text: props.detail.author,
    })
  }

  if (props.detail.downloadCount) {
    result.push({
      icon: 'file_download',
      text: getExpectedSize(props.detail.downloadCount, ''),
    })
  }
  if (props.detail.follows) {
    result.push({
      icon: 'star_rate',
      color: 'orange',
      text: props.detail.follows.toString(),
    })
  }

  return result
})

const { getDateString } = useDateString()
const hasInstalledVersion = computed(() => props.versions.some(v => v.installed))

const { push, replace, currentRoute } = useRouter()
const goCurseforgeProject = (id: number) => {
  replace({ query: { ...currentRoute.query, id: `curseforge:${id}` } })
}
const goModrinthProject = (id: string) => {
  replace({ query: { ...currentRoute.query, id: `modrinth:${id}` } })
}
const { isDark } = injection(kTheme)

const selectedVersion = inject('selectedVersion', ref(props.versions.find(v => v.installed) || props.versions[0] as ProjectVersion | undefined))
const onVersionClicked = (version: ProjectVersion) => {
  if (!selectedVersion.value || selectedVersion.value?.id === version.id) return
  selectedVersion.value = version
}
watch(selectedVersion, (v, o) => {
  if (v !== o && v) {
    emit('load-changelog', v)
  }
})
const { t } = useI18n()
watch(() => props.detail, (d, o) => {
  if (d?.id !== o?.id) {
    showDependencies.value = false
    selectedVersion.value = undefined
    tab.value = 0
  }
})

let dirty = false
watch([() => props.detail, () => props.loading], () => {
  dirty = true
}, { immediate: true })
watch(() => props.versions, (vers) => {
  if (dirty || !selectedVersion.value) {
    dirty = false
    selectedVersion.value = props.versions.find(v => v.installed) || vers[0]
  }
}, { immediate: true })

const showDependencies = ref(false)

const installed = computed(() => props.versions.find(v => v.installed))
const notInstalled = computed(() => props.versions.filter(v => !v.installed))

const tDepType = (ty: ProjectDependency['type']) => t(`dependencies.${ty}`)

const onInstall = () => {
  if (selectedVersion.value) {
    emit('install', selectedVersion.value)
  }
}

const onScroll = (e: Event) => {
  const t = e.target as HTMLElement
  if (t.scrollTop + t.clientHeight >= t.scrollHeight && tab.value === 3) {
    emit('load-more')
  }
}

// Image
const imageDialog = injection(kImageDialog)
const onShowImage = (img: ModGallery) => {
  imageDialog.show(img.url, { description: img.description, date: img.date })
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
  forge: '$vuetify.icons.forge',
  fabric: '$vuetify.icons.fabric',
  quilt: '$vuetify.icons.quilt',
  optifine: '$vuetify.icons.optifine',
  neoforge: '$vuetify.icons.neoForged',
} as Record<string, string>

const validModLoaders = computed(() => {
  return props.detail.modLoaders.filter(l => iconMapping[l])
})

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
      push({ query: { ...currentRoute.query, id: `modrinth:${slug}` } })
      e.preventDefault()
      e.stopPropagation()
    }
  }
  if ((url.host === 'www.curseforge.com' || url.host === 'curseforge.com') && url.pathname.startsWith('/minecraft')) {
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
          push({ query: { ...currentRoute.query, id: `curseforge:${id}` } })
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

.item {
  @apply flex items-center gap-2 overflow-x-auto overflow-y-hidden w-full;
}

.item .v-icon {
  @apply rounded-full p-2;
  background-color: rgba(0, 0, 0, 0.2);
}

.item div {
  @apply flex flex-col;
}

span {
  /* @apply dark:text-gray-400 text-gray-600; */
}

.contained {
  container-type: inline-size;
}
</style>
