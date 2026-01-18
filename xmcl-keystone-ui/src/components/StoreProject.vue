<template>
  <div
    v-if="!project"
    class="flex w-full flex-col gap-4 overflow-auto p-4 lg:flex-row"
  >
    <v-progress-linear
      class="absolute left-0 top-0 z-10 m-0 p-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <ErrorView
      class="h-full"
      :error="error"
    />
  </div>
  <div
    v-else
    class="flex flex-col gap-4 p-4"
  >
    <v-progress-linear
      class="absolute left-0 top-0 z-10 m-0 p-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div class="w-full flex flex-col gap-2 lg:(grid grid-cols-3 gap-4 max-w-360)">
      <v-card class="col-span-2 flex flex-col gap-1 rounded-2xl!">
        <StoreProjectGallery
          class="h-full flex-grow"
          :project="project"
        />
        <StoreProjectHeader
          class="flex-shrink flex-grow-0"
          :project="project"
          :installing="installing || !!installDialog"
          :installed="installed"
          @open="onOpen"
          @install="onInstall"
        />
      </v-card>
      <v-card class="flex flex-col p-4 rounded-2xl!">
        <template v-if="project.links.length > 0">
          <StoreProjectExternal :project="project" />
          <v-divider class="my-2 w-full" />
        </template>
        <StoreProjectMembers
          :members="members"
          :loading="loadingMembers"
          :error="teamError"
        />
        <v-divider class="my-2 w-full" />
        <StoreProjectTags :project="project" />
      </v-card>
    </div>
    <div class="flex flex-col max-w-360">
      <div
        v-if="project.htmlDescription"
        class="markdown-body p-4"
        v-html="project.htmlDescription"
      />
    </div>
    <StoreProjectInstallVersionDialog
      :value="installDialog"
      :versions="versions || []"
      :get-version-detail="getVersionDetail"
      @load="emit('load')"
      @input="installDialog = false"
      @install="onInstallVersion"
    />
  </div>
</template>
<script lang="ts"  setup>
import ErrorView from '@/components/ErrorView.vue'
import StoreProjectExternal from './StoreProjectExternal.vue'
import StoreProjectGallery from './StoreProjectGallery.vue'
import StoreProjectHeader from './StoreProjectHeader.vue'
import StoreProjectInstallVersionDialog, { StoreProjectVersion, StoreProjectVersionDetail } from './StoreProjectInstallVersionDialog.vue'
import StoreProjectMembers, { TeamMember } from './StoreProjectMembers.vue'
import StoreProjectTags from './StoreProjectTags.vue'
import { CategoryChipProps } from './CategoryChip.vue'

export interface StoreProject {
  id: string
  title: string
  iconUrl: string | undefined
  url: string
  description: string
  categories: Array<CategoryChipProps>
  downloads: number
  follows: number
  createDate: string
  updateDate: string
  links: Array<{ url: string; name: string }>
  info: Array<{ name: string; value: string; url?: string; icon?: string }>
  htmlDescription?: string
  localizedTitle?: string
  localizedDescription?: string
  gallery: Array<{
    rawUrl?: string
    url: string
    description: string
  }>
}

const props = defineProps<{
  project?: StoreProject
  refreshing: boolean
  error: any

  members: TeamMember[]
  loadingMembers: boolean
  teamError: any

  versions: StoreProjectVersion[]

  installed?: boolean
  installing?: boolean

  getVersionDetail: (version: StoreProjectVersion) => Promise<StoreProjectVersionDetail>
}>()

const emit = defineEmits<{
  (event: 'install', version: StoreProjectVersion): void
  (event: 'open'): void
  (event: 'load'): void
}>()

const installDialog = ref(false)
const onInstall = () => {
  installDialog.value = true
}
const onOpen = () => {
  emit('open')
}
const onInstallVersion = (v: StoreProjectVersion) => {
  installDialog.value = false
  emit('install', v)
}
</script>
