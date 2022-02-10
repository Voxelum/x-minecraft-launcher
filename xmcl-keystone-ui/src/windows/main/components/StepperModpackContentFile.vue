<template>
  <v-list-tile
    avatar
    @click="onClick"
  >
    <v-list-tile-avatar>
      <v-img :src="image">
        <template #placeholder>
          <v-layout
            fill-height
            align-center
            justify-center
            ma-0
          >
            <v-progress-circular
              indeterminate
              color="grey lighten-5"
            />
          </v-layout>
        </template>
      </v-img>
    </v-list-tile-avatar>

    <v-list-tile-content>
      <v-list-tile-title>{{ project ? project.name : '' }}</v-list-tile-title>
      <v-list-tile-sub-title>
        <span
          v-if="project ? project.authors[0].name : ''"
          class="text--primary"
        >{{ project && project.authors[0] ? project.authors[0].name : '' }}</span>
        {{ project ? project.summary : '' }}
      </v-list-tile-sub-title>
    </v-list-tile-content>
  </v-list-tile>
</template>
<script lang="ts">
import { computed, defineComponent, onMounted, Ref, ref } from '@vue/composition-api'
import type { AddonInfo } from '@xmcl/curseforge'
import { CurseForgeServiceKey } from '@xmcl/runtime-api'
import { useBaseService, useService } from '/@/hooks'
import { useRefreshable } from '/@/hooks/useRefreshable'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    projectId: required(Number),
    fileId: required(Number),
  },
  setup(props) {
    const { fetchProject } = useService(CurseForgeServiceKey)
    const { openInBrowser } = useBaseService()
    onMounted(() => {
      refresh()
    })
    const project: Ref<AddonInfo | undefined> = ref(undefined)
    const image = computed(() => project.value?.attachments[0] ? project.value.attachments[0].thumbnailUrl : '')
    const { refresh, refreshing } = useRefreshable(async () => {
      const result = await fetchProject(props.projectId)
      project.value = result
    })
    function onClick() {
      if (project.value?.websiteUrl) {
        openInBrowser(project.value.websiteUrl)
      }
    }
    return {
      project,
      image,
      onClick,
    }
  },
})
</script>
