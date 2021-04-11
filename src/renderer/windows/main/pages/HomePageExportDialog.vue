<template>
  <v-dialog
    :value="value"
    width="600"
    @input="$emit('input', $event)"
  >
    <v-card>
      <v-toolbar
        dark
        tabs
        color="green darken"
      >
        <v-toolbar-title v-if="isCurseforge">
          {{ $t('profile.modpack.exportCurseforge') }}
        </v-toolbar-title>
        <v-toolbar-title v-else>
          {{ $t('profile.modpack.export') }}
        </v-toolbar-title>

        <v-spacer />
        <v-btn
          icon
          @click="$emit('input', false)"
        >
          <v-icon>arrow_drop_down</v-icon>
        </v-btn>
      </v-toolbar>
      <v-container
        grid-list-sm
        style="overflow: auto; max-height: 450px"
      >
        <v-subheader>{{ $t('profile.modpack.general') }}</v-subheader>
        <v-container
          grid-list-md
          style="padding-top: 0px"
        >
          <v-layout row>
            <v-flex d-flex>
              <v-text-field
                v-model="name"
                dark
                persistent-hint
                :hint="$t('profile.nameHint')"
                :label="$t('name')"
                required
              />
            </v-flex>
            <v-flex d-flex>
              <v-text-field
                v-model="author"
                dark
                persistent-hint
                :hint="$t('profile.authorHint')"
                :label="$t('author')"
                required
              />
            </v-flex>
          </v-layout>
          <v-layout row>
            <v-flex d-flex>
              <v-text-field
                v-model="version"
                dark
                persistent-hint
                :hint="$t('profile.instanceVersion')"
                :label="$t('profile.instanceVersion')"
                required
              />
            </v-flex>
            <v-flex
              d-flex
              xs6
            >
              <v-select
                v-model="gameVersion"
                :items="localVersions"
                dark
                persistent-hint
                :hint="$tc('profile.modpack.includeVersion', 2)"
                :label="$t('profile.gameVersion')"
                required
              />
            </v-flex>
          </v-layout>
          <v-layout
            v-if="!isCurseforge"
            row
          >
            <v-flex d-flex>
              <v-checkbox
                v-model="includeAssets"
                :label="$t('profile.modpack.includeAssets')"
                hint="abc"
              />
            </v-flex>
            <v-flex
              d-flex
              xs6
            >
              <v-checkbox
                v-model="includeLibraries"
                :label="$t('profile.modpack.includeLibraries')"
                hint="abc"
              />
            </v-flex>
          </v-layout>
        </v-container>

        <v-layout>
          <v-subheader v-if="isCurseforge">
            {{ $t('profile.modpack.overrides') }}
          </v-subheader>
          <v-subheader v-else>
            {{ $t('profile.modpack.includes') }}
          </v-subheader>
        </v-layout>
        <v-layout
          row
          style="padding: 5px; margin-bottom: 5px"
        >
          <instance-files
            v-model="selected"
            :items="files"
          />
        </v-layout>
        <v-layout row>
          <v-btn
            flat
            large
            @click="cancel"
          >
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn
            flat
            color="primary"
            large
            @click="confirm"
          >
            {{ $t('profile.modpack.export') }}
          </v-btn>
        </v-layout>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { computed, defineComponent, nextTick, reactive, toRefs, watch } from '@vue/composition-api'
import { useZipFilter } from '../hooks'
import InstanceFiles from './HomePageInstanceFiles.vue'
import { useI18n, useInstance, useInstanceVersion, useLocalVersions, useNativeDialog, useService } from '/@/hooks'
import { InstanceCurseforgeIOServiceKey } from '/@shared/services/InstanceCurseforgeIOServic'
import { InstanceFile, InstanceIOServiceKey } from '/@shared/services/InstanceIOService'

export default defineComponent({
  components: { InstanceFiles },
  props: {
    value: Boolean,
    isCurseforge: Boolean,
  },
  setup(props, context) {
    const { name, author } = useInstance()
    const { getInstanceFiles, exportInstance } = useService(InstanceIOServiceKey)
    const { exportCurseforgeModpack } = useService(InstanceCurseforgeIOServiceKey)
    const { showSaveDialog } = useNativeDialog()
    const { localVersions } = useLocalVersions()
    const { folder } = useInstanceVersion()
    const { $t } = useI18n()
    const zipFilter = useZipFilter()
    const data = reactive({
      name: name.value,
      author: author.value,
      version: '0.0.0',
      gameVersion: '',
      refreshing: false,
      exporting: false,
      selected: [] as string[],
      files: [] as InstanceFile[],
      includeLibraries: true,
      includeAssets: true,
    })
    function reset() {
      data.selected = []
      data.gameVersion = folder.value ? folder.value : ''
    }
    function refresh() {
      if (data.refreshing) return
      data.refreshing = true
      getInstanceFiles().then((files) => {
        let selected = [] as string[]
        if (props.isCurseforge) {
          selected = files.filter(p => p.path.startsWith('config') || p.path.startsWith('mods')).map(p => p.path)
        } else {
          selected = files
            .filter(file => !file.path.startsWith('logs'))
            .filter(file => !file.path.startsWith('resourcepacks'))
            .map(file => file.path)
        }
        nextTick().then(() => { data.selected = selected })
        data.files = files
      }).finally(() => { data.refreshing = false })
    }
    function cancel() {
      context.emit('input', false)
    }
    async function confirm() {
      data.exporting = true
      const { filePath } = await showSaveDialog({
        title: $t('profile.modpack.export'),
        defaultPath: `${data.name}-${data.version}`,
        filters: [zipFilter],
      })
      if (filePath) {
        if (props.isCurseforge) {
          try {
            const overrides = data.selected.filter(p => !!data.files.find(f => f.path === p && !f.isDirectory))
            await exportCurseforgeModpack({
              overrides,
              name: data.name,
              author: data.author,
              version: data.version,
              gameVersion: data.gameVersion,
              destinationPath: filePath,
            })
          } catch (e) {
            console.error(e)
          }
        } else {
          const files = data.selected.filter(p => !!data.files.find(f => f.path === p && !f.isDirectory))
          await exportInstance({
            destinationPath: filePath,
            includeLibraries: data.includeLibraries,
            includeAssets: data.includeAssets,
            files,
          })
        }
      }

      data.exporting = false
    }
    watch(() => props.value, () => {
      if (props.value) {
        reset()
        refresh()
      }
    })
    return {
      localVersions: computed(() => localVersions.value.map((v) => v.id)),
      ...toRefs(data),
      cancel,
      confirm,
      refresh,
    }
  },
})
</script>

<style>
</style>
