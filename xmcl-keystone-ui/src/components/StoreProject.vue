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
    class="visible-scroll flex flex-col gap-4 overflow-auto p-4"
  >
    <v-progress-linear
      class="absolute left-0 top-0 z-10 m-0 p-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <v-card class="flex flex-col gap-1 xl:flex-row">
      <StoreProjectGallery
        class="h-full flex-grow"
        :project="project"
      />
      <StoreProjectHeader
        class="flex-shrink flex-grow-0"
        :project="project"
        :installing="isTryingToShowDialog || installing || false"
        :installed="installed"
        @open="onOpen"
        @install="onInstall"
      />
    </v-card>
    <div class="xl:(grid grid-cols-3) flex flex-col gap-4">
      <v-card class="flex flex-col p-4">
        <StoreProjectExternal :project="project" />
        <v-divider class="my-2 w-full" />
        <StoreProjectMembers
          :members="members"
          :loading="loadingMembers"
          :error="teamError"
        />
        <v-divider class="my-2 w-full" />
        <StoreProjectTags :project="project" />
      </v-card>
      <div class="col-span-2 flex max-w-full flex-col">
        <div
          v-if="project.htmlDescription"
          class="markdown-body p-4"
          v-html="project.htmlDescription"
        />
      </div>
    </div>
    <StoreProjectInstallFeaturedVersionDialog
      :value="installDialog"
      :versions="featuredVersions || []"
      @input="isTryingToShowDialog = false"
      @install="onInstallVersion"
    />
  </div>
</template>
<script lang="ts"  setup>
import ErrorView from '@/components/ErrorView.vue'
import StoreProjectExternal from './StoreProjectExternal.vue'
import StoreProjectGallery from './StoreProjectGallery.vue'
import StoreProjectHeader from './StoreProjectHeader.vue'
import StoreProjectInstallFeaturedVersionDialog, { StoreProjectVersion } from './StoreProjectInstallFeaturedVersionDialog.vue'
import StoreProjectMembers, { TeamMember } from './StoreProjectMembers.vue'
import StoreProjectTags from './StoreProjectTags.vue'

export interface StoreProject {
  id: string
  title: string
  iconUrl: string | undefined
  url: string
  description: string
  categories: Array<{ icon?: string; name: string }>
  downloads: number
  follows: number
  createDate: string
  updateDate: string
  links: Array<{ url: string; name: string }>
  info: Array<{ name: string; value: string; url?: string; icon?: string }>
  htmlDescription?: string
  gallery: Array<{
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

  featuredVersions: StoreProjectVersion[]

  installed?: boolean
  installing?: boolean
}>()

const emit = defineEmits<{
  (event: 'install', version: StoreProjectVersion): void
  (event: 'open'): void
}>()

const isTryingToShowDialog = ref(false)
const installDialog = computed(() => isTryingToShowDialog.value && props.featuredVersions && props.featuredVersions.length > 0)
const onInstall = () => {
  if (props.featuredVersions && props.featuredVersions.length === 1) {
    // Directly install the version
    emit('install', props.featuredVersions[0])
  } else {
    // Show the dialog
    isTryingToShowDialog.value = true
  }
}
const onOpen = () => {
  emit('open')
}
const onInstallVersion = (v: StoreProjectVersion) => {
  isTryingToShowDialog.value = false
  emit('install', v)
}
</script>
