<template>
  <v-list
    v-if="versions.length !== 0"
    dark
  >
    <template v-for="(item, index) in versions">
      <v-list-tile
        :key="item.id"
        ripple
        style="margin: 0px 0;"
        @click.stop.prevent="select(index)"
      >
        <v-list-tile-avatar>
          <v-checkbox
            :value="selected[index]"
            @click.stop.prevent="select(index)"
          />
        </v-list-tile-avatar>
        <v-list-tile-title>{{ item.folder }}</v-list-tile-title>
        <v-list-tile-sub-title>{{ item.minecraft }}</v-list-tile-sub-title>
      </v-list-tile>
    </template>
  </v-list>
  <v-container
    v-else
    fill-height
  >
    <v-layout
      align-center
      justify-center
      row
      fill-height
    >
      <v-flex
        shrink
        tag="h1"
        class="white--text"
      >
        <v-btn
          large
          color="primary"
          @click="browseVersoinsFolder"
        >
          <v-icon left>
            folder
          </v-icon>
          {{ $t('version.noLocalVersion') }}
        </v-btn>
        <v-btn
          large
          color="primary"
          @click="refreshVersions"
        >
          {{ $t('version.refresh') }}
        </v-btn>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { defineComponent, reactive, computed, toRefs, ref, watch } from '@vue/composition-api'
import { useLocalVersions } from '/@/hooks'
import { required } from '/@/util/props'
import { LocalVersion } from '/@shared/entities/version'

export default defineComponent({
  props: {
    value: required<LocalVersion[]>(Array),
  },
  setup(props, context) {
    const { localVersions, showVersionsDirectory, showVersionDirectory, refreshVersions } = useLocalVersions()
    const versions = localVersions

    const selected = ref([] as boolean[])

    function selectVersion(v: LocalVersion) {
      context.emit('input', v)
    }
    function browseVersoinsFolder() {
      showVersionsDirectory()
    }
    function openVersionDir(v: { folder: string }) {
      showVersionDirectory(v.folder)
    }
    function select(index: number) {
      selected.value[index] = !selected.value[index]
      selected.value = [...selected.value]
    }

    watch(selected, (set) => {
      context.emit('input', versions.value.filter((v, i) => set[i]).map((v) => v.folder))
    })

    return {
      selected,
      versions,
      openVersionDir,
      browseVersoinsFolder,
      refreshVersions,
      selectVersion,
      select,
    }
  },
})
</script>

<style>
</style>
