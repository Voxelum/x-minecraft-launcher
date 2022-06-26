<template>
  <v-list-item
    @click="onClick"
  >
    <v-list-item-avatar>
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
    </v-list-item-avatar>

    <v-list-item-content>
      <v-list-item-title>{{ project ? project.name : '' }}</v-list-item-title>
      <v-list-item-subtitle>
        <span
          v-if="project ? project.authors[0].name : ''"
          class="text--primary"
        >{{ project && project.authors[0] ? project.authors[0].name : '' }}</span>
        {{ project ? project.summary : '' }}
      </v-list-item-subtitle>
    </v-list-item-content>
  </v-list-item>
</template>
<script lang="ts">
import { computed, defineComponent, onMounted, Ref, ref } from '@vue/composition-api'
import type { AddonInfo } from '@xmcl/curseforge'
import { BaseServiceKey, CurseForgeServiceKey } from '@xmcl/runtime-api'
import { useService } from '/@/composables'
import { useRefreshable } from '../../../composables/refreshable'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    projectId: required(Number),
    fileId: required(Number),
  },
  setup(props) {
    const { fetchProject } = useService(CurseForgeServiceKey)
    const { openInBrowser } = useService(BaseServiceKey)
    onMounted(() => {
      refresh()
    })
    const project: Ref<AddonInfo | undefined> = ref(undefined)
    const image = computed(() => project.value?.logo ? project.value.logo.thumbnailUrl : '')
    const { refresh, refreshing } = useRefreshable(async () => {
      const result = await fetchProject(props.projectId)
      project.value = result
      console.log(result)
    })
    function onClick() {
      if (project.value?.slug) {
        if (project.value.classId === 6) {
          openInBrowser(`https://www.curseforge.com/minecraft/mc-mods/${project.value.slug}`)
        } else if (project.value.classId === 12) {
          openInBrowser(`https://www.curseforge.com/minecraft/texture-packs/${project.value.slug}`)
        }
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
