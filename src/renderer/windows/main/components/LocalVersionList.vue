<template>
  <v-list
    v-if="versions.length !== 0"
    dark
    style="overflow-y: scroll; scrollbar-width: 0; background-color: transparent; max-height: 100%"
  >
    <template v-for="(item) in versions">
      <v-list-tile
        :key="item.id"
        ripple
        :class="{ grey: isSelected(item), 'darken-1': isSelected(item) }"
        style="margin: 0px 0;"
        @click="selectVersion(item)"
      >
        <v-list-tile-avatar>
          <v-btn
            icon
            style="cursor: pointer"
            @click.stop="openVersionDir(item)"
          >
            <v-icon>folder</v-icon>
          </v-btn>
        </v-list-tile-avatar>
        <v-list-tile-title>{{ item.id }}</v-list-tile-title>
        <v-list-tile-sub-title>{{ item.minecraftVersion }}</v-list-tile-sub-title>
        <v-list-tile-action style="flex-direction: row; justify-content: flex-end;">
          <v-btn
            style="cursor: pointer"
            icon
            flat
            @mousedown.stop
            @click.stop="startReinstall(item)"
          >
            <v-icon>build</v-icon>
          </v-btn>
        </v-list-tile-action>
        <v-list-tile-action style="flex-direction: row; justify-content: flex-end;">
          <v-btn
            style="cursor: pointer"
            icon
            color="red"
            flat
            @mousedown.stop
            @click.stop="startDelete(item)"
          >
            <v-icon>delete</v-icon>
          </v-btn>
        </v-list-tile-action>
      </v-list-tile>
    </template>
    <v-dialog
      v-model="deletingVersion"
      max-width="290"
    >
      <v-card dark>
        <v-card-title class="headline">
          {{ $t('version.deleteTitle') }}
        </v-card-title>
        <v-card-text>{{ $t('version.deleteDescription') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            flat
            @click="cancelDeleting()"
          >
            {{ $t('no') }}
          </v-btn>
          <v-btn
            color="red darken-1"
            flat
            @click="comfireDeleting()"
          >
            {{ $t('yes') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog
      v-model="reinstallVersion"
      max-width="390"
    >
      <v-card dark>
        <v-card-title
          class="headline"
        >
          {{ $t('version.reinstallTitle', { version: reinstallVersionId }) }}
        </v-card-title>
        <v-card-text>{{ $t('version.reinstallDescription') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            flat
            @click="cancelReinstall()"
          >
            {{ $t('no') }}
          </v-btn>
          <v-btn
            color="orange darken-1"
            flat
            @click="comfireReinstall()"
          >
            <v-icon left>
              build
            </v-icon>
            {{ $t('yes') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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
import { defineComponent, reactive, computed, toRefs } from '@vue/composition-api'
import { useLocalVersions } from '/@/hooks'
import type { ResolvedVersion } from '@xmcl/core'
import { required, withDefault } from '/@/util/props'

export default defineComponent({
  props: {
    filterText: withDefault(String, () => ''),
    value: required<ResolvedVersion>(Object),
  },
  setup(props, context) {
    const data = reactive({
      deletingVersion: false,
      deletingVersionId: '',

      reinstallVersion: false,
      reinstallVersionId: '',
    })
    const { localVersions, deleteVersion, showVersionsDirectory, showVersionDirectory, refreshVersions, reinstall } = useLocalVersions()
    const versions = computed(() => localVersions.value.filter(v => v.id.indexOf(props.filterText) !== -1))
    function isSelected(v: ResolvedVersion) {
      if (!props.value) return false
      return v.id === props.value.id
    }
    function selectVersion(v: ResolvedVersion) {
      context.emit('input', v)
    }
    function browseVersoinsFolder() {
      showVersionsDirectory()
    }
    function openVersionDir(v: ResolvedVersion) {
      showVersionDirectory(v.id)
    }
    function startDelete(v: ResolvedVersion) {
      data.deletingVersion = true
      data.deletingVersionId = v.id
    }
    function startReinstall(v: ResolvedVersion) {
      data.reinstallVersion = true
      data.reinstallVersionId = v.id
    }
    function comfireDeleting() {
      deleteVersion(data.deletingVersionId)
      data.deletingVersion = false
      data.deletingVersionId = ''
    }
    function comfireReinstall() {
      reinstall(data.reinstallVersionId)
      data.reinstallVersion = false
      data.reinstallVersionId = ''
    }
    function cancelDeleting() {
      data.deletingVersion = false
      data.deletingVersionId = ''
    }
    function cancelReinstall() {
      data.reinstallVersion = false
      data.reinstallVersionId = ''
    }

    return {
      ...toRefs(data),
      versions,
      isSelected,
      cancelDeleting,
      comfireDeleting,
      startDelete,
      openVersionDir,
      browseVersoinsFolder,
      refreshVersions,
      selectVersion,
      startReinstall,
      cancelReinstall,
      comfireReinstall,
    }
  },
})
</script>

<style>
</style>
