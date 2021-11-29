<template>
  <v-card class="h-full overflow-auto">
    <v-container v-if="loading" fill-height style="min-height: 65vh;">
      <v-layout justify-center align-center fill-height>
        <v-progress-circular indeterminate :size="100" />
      </v-layout>
    </v-container>
    <div class="flex flex-col h-full overflow-auto" v-else>
      <div class="flex gap-5 mx-5 mt-3">
        <v-select
          v-model="gameVersion"
          clearable
          hide-details
          flat
          solo
          dark
          dense
          :items="gameVersions"
          :label="$t('curseforge.file.gameVersion')"
        ></v-select>
        <v-select
          v-model="releaseType"
          clearable
          hide-details
          flat
          solo
          dark
          dense
          :items="releaseTypes"
          :label="$t('curseforge.file.releaseType')"
        ></v-select>
      </div>
      <virtual-list
        class="v-list max-h-[100vh] h-full overflow-auto transition-none"
        :data-component="Tile"
        :data-key="'id'"
        :data-sources="files"
        :estimate-size="56"
        :extra-props="{ getFileStatus: getFileStatus, install: install, download: download, modpack: type === 'modpacks' }"
      />
    </div>
    <v-dialog v-model="isConfirmDialogShown" persistent>
      <!-- TODO: impl this -->
      <!-- <add-instance-stepper
        :show="isConfirmDialogShown"
        :initial-template="initialTemplate"
        @quit="isConfirmDialogShown = false"
      />-->
    </v-dialog>
  </v-card>
</template>

<script lang=ts>
import VirtualList from 'vue-virtual-scroll-list'
import { defineComponent, computed, inject, ref, reactive, toRefs, watch } from '@vue/composition-api'
import { ProjectType } from '/@shared/entities/curseforge'
import { File } from '@xmcl/curseforge'
import {
  useCurseforgeProjectFiles,
  useCurseforgeInstall,
  useI18n,
} from '/@/hooks'
import { optional, required } from '/@/util/props'
import Tile from './FilesTile.vue'
import { isNonnull } from '/@shared/util/assert'
// import AddInstanceStepper from './InstancesPageAddInstanceStepper.vue'

export default defineComponent({
  components: { VirtualList },
  props: {
    project: required(Number),
    type: required<ProjectType>(String as any),
    from: optional(String),
  },
  setup(props) {
    const { files, loading, refresh } = useCurseforgeProjectFiles(props.project)
    const { install: installFile, getFileStatus, getFileResource } = useCurseforgeInstall(props.type, props.project)
    const data = reactive({
      isConfirmDialogShown: false,
      initialTemplate: '',
    })
    const { $t } = useI18n()
    const releaseMappper = computed(() => [,
      { text: $t('curseforge.fileReleaseType.release'), value: 1 },
      { text: $t('curseforge.fileReleaseType.alpha'), value: 2 },
      { text: $t('curseforge.fileReleaseType.beta'), value: 3 },
    ])
    const sortBy = ref('date')
    const sortBys = computed(() => [
      { text: $t('curseforge.file.sortByName'), value: 'name' },
      { text: $t('curseforge.file.sortByDate'), value: 'date' },
    ])
    const releaseType = ref(undefined as undefined | number)
    const releaseTypes = computed(() => {
      const set = new Set<number>()
      for (const file of files.value) {
        set.add(file.releaseType)
      }
      return [...set].map(i => releaseMappper.value[i]).filter(isNonnull)
    })
    const gameVersion = ref('')
    const gameVersions = computed(() => {
      const set = new Set<string>()
      for (const file of files.value) {
        for (const ver of file.gameVersion) {
          set.add(ver)
        }
      }
      return [...set]
    })
    async function install(file: File) {
      const stat = getFileStatus(file)
      if (props.type === 'modpacks') {
        let filePath: string
        if (stat === 'remote') {
          const resource = await installFile(file)
          filePath = resource.path
        } else {
          const res = getFileResource(file)
          if (res) {
            filePath = res.path
          } else {
            throw new Error(`Cannot find installed curseforge file named ${file.displayName} fileId=${file.id} projectId=${file.projectId}`)
          }
        }
        data.initialTemplate = filePath
        data.isConfirmDialogShown = true
      } else {
        await installFile(file, props.from)
      }
    }
    async function download(file: File) {
      await installFile(file, props.from)
    }
    const filteredFiles = computed(() => {
      const gameVersionVal = gameVersion.value
      const releaseTypeVal = releaseType.value
      return files.value.filter(v =>
        (!releaseTypeVal || (v.releaseType === releaseTypeVal)) &&
        (!gameVersionVal || v.gameVersion.indexOf(gameVersionVal) !== -1)
      )
    })
    return {
      ...toRefs(data),
      Tile,
      files: filteredFiles,
      loading,
      refresh,
      getFileStatus,
      download,
      install,
      gameVersions,
      releaseTypes,
      sortBys,
      releaseType,
      sortBy,
      gameVersion,
    }
  },
})
</script>

<style>
.v-image__image {
  background-repeat: no-repeat;
  background-position: center center;
}
</style>
