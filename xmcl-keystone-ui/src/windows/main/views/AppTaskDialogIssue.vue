<template>
  <v-card
    flat
    style="min-height: 300px; max-height: 400px; max-width: 100%; overflow: auto;"
  >
    <v-card-text>
      <!-- {{ items.length === 0 ? $t('issue.empty') : '' }} -->
      <v-treeview
        v-model="data.tree"
        :open="data.opened"
        :items="items"
        item-key="$id"
        item-children="items"
        transition
        hoverable
      >
        <template #append="{ item }">
          <div v-if="item.id">
            <v-progress-circular
              v-if="item.fixing"
              style="margin-right: 7px"
              class="mb-0"
              color="white"
              small
              :size="20"
              :width="3"
              :indeterminate="true"
            />
          </div>
        </template>

        <template #label="{ item }">
          <div
            class="flex items-center"
          >
            <div class="flex flex-col">
              <span
                style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;"
              >{{ item.title }}</span>
              <span
                class="tree-minor-label"
                style="max-width: 320px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
              >{{ item.description }}</span>
            </div>
            <v-spacer />
            <v-chip
              style="margin-left: 10px"
              outlined
              small
              label
              color="orange"
            />
          </div>
          <!-- <div
            v-else
            style="padding: 5px 0px;"
          >
            <div style="display: flex">
              <v-icon
                :color="!item.optional ? 'red': 'orange'"
                class="material-icons-outlined"
              >
                {{ item.optional ? 'warning' : 'cancel' }}
              </v-icon>
              <span
                style="display: inline-block; overflow: hidden; max-width: 300px; text-overflow: ellipsis; white-space: nowrap;"
              >{{ $tc(`diagnosis.${item.id}`, 0, item.arguments) }}</span>
            </div>
            <span
              v-if="item.arguments.file"
              class="tree-minor-label"
            >{{ item.arguments.file }}</span>
            <div
              v-if="item.expect"
              class="tree-minor-label"
            >
              Expect: {{ item.expect }}
            </div>
            <div
              v-if="item.actual"
              class="tree-minor-label"
            >
              Actual: {{ item.actual }}
            </div>
            <span
              class="tree-minor-label"
              style="margin-left: 5px; max-width: 320px; display: inline-block; overflow: hidden;"
            >
              {{ $t(`diagnosis.${item.id}.message`, item.arguments || {}) }}
            </span>
          </div> -->
        </template>
      </v-treeview>
    </v-card-text>
  </v-card>
</template>

<script setup lang=ts>
import { AssetIndexIssueKey, Issue, AssetsIssueKey, isIssue, LibrariesIssueKey, VersionIssueKey, VersionJarIssueKey, VersionJsonIssueKey } from '@xmcl/runtime-api'
import { useI18n, useIssues } from '/@/composables'

const props = defineProps<{
  issue: Issue<any>
}>()

const { t, tc } = useI18n()

const { issues } = useIssues()

const items = computed(() => issues.value
  .map((i) => {
    if (isIssue(AssetsIssueKey, i)) {
      if (i.parameters[0].assets.some(v => v.type === 'corrupted')) {
        return { title: tc('diagnosis.corruptedAssets.name', 3, { count: i.parameters[0].assets.length }), description: t('diagnosis.corruptedAssets.message'), ...i }
      } else {
        return { title: tc('diagnosis.missingAssets.name', 3, { count: i.parameters[0].assets.length }), description: t('diagnosis.missingAssets.message'), ...i }
      }
    } else if (isIssue(LibrariesIssueKey, i)) {
      if (i.parameters[0].libraries.some(v => v.type === 'corrupted')) {
        return { title: tc('diagnosis.corruptedLibraries.name', 3, { count: i.parameters[0].libraries.length }), description: t('diagnosis.corruptedLibraries.message'), ...i }
      } else {
        return { title: tc('diagnosis.missingLibraries.name', 3, { count: i.parameters[0].libraries.length }), description: t('diagnosis.missingLibraries.message'), ...i }
      }
    } else if (isIssue(AssetIndexIssueKey, i)) {
      if (i.parameters[0].type === 'corrupted') {
        return { title: t('diagnosis.corruptedAssetsIndex.name', { version: i.parameters[0].version }), description: t('diagnosis.corruptedAssetsIndex.message'), ...i }
      } else {
        return { title: t('diagnosis.missingAssetsIndex.name', { version: i.parameters[0].version }), description: t('diagnosis.missingAssetsIndex.message'), ...i }
      }
    } else if (isIssue(VersionJarIssueKey, i)) {
      if (i.parameters[0].type === 'corrupted') {
        return { title: t('diagnosis.corruptedVersionJar.name', { version: i.parameters[0].version }), description: t('diagnosis.corruptedVersionJar.message'), ...i }
      } else {
        return { title: t('diagnosis.missingVersionJar.name', { version: i.parameters[0].version }), description: t('diagnosis.missingVersionJar.message'), ...i }
      }
    } else if (isIssue(VersionJsonIssueKey, i)) {
      return { title: t('diagnosis.corruptedVersionJson.name'), description: t('diagnosis.corruptedVersionJson.message'), ...i }
    } else if (isIssue(VersionIssueKey, i)) {
      return { title: t('diagnosis.missingVersion.name', { version: i.parameters[0].version }), description: t('diagnosis.missingVersion.message'), ...i }
    }
    return { title: tc(`diagnosis.${i.id}.name`, i.parameters.length || 0, i.parameters[0]), description: t(`diagnosis.${i.id}.description`, { }), ...i }
  }))

function useIssuesTree() {
  // const { state } = useStore()
  // let $id = 0

  // function collect(id: string, reg: Registry<any, any, any>) {
  //   return reg.activeIssues.map((a) => ({
  //     id,
  //     $id: $id++,
  //     fixing: reg.fixing,
  //     autofix: reg.autofix,
  //     optional: reg.optional,
  //     arguments: a,
  //   }))
  // }

  // const assets = computed(() => {
  //   const items: IssueLeaf[] = []
  //   const corruptedAssets = state.diagnose.corruptedAssets
  //   const missingAssets = state.diagnose.missingAssets
  //   if (corruptedAssets.activeIssues.length !== 0) {
  //     items.push(...collect('corruptedAssets', corruptedAssets))
  //   }
  //   if (missingAssets.activeIssues.length !== 0) {
  //     items.push(...collect('missingAssets', missingAssets))
  //   }
  //   return { name: 'assets', items, location: `${state.base.root}/assets`, $id: $id++ }
  // })
  // const libraries = computed(() => {
  //   const items: IssueLeaf[] = []
  //   const corruptedLibraries = state.diagnose.corruptedLibraries
  //   const missingLibraries = state.diagnose.missingLibraries
  //   if (corruptedLibraries.activeIssues.length !== 0) {
  //     items.push(...collect('corruptedLibraries', corruptedLibraries))
  //   }
  //   if (missingLibraries.activeIssues.length !== 0) {
  //     items.push(...collect('missingLibraries', missingLibraries))
  //   }
  //   return { name: 'libraries', items, location: `${state.base.root}/libraries`, $id: $id++ }
  // })
  // const version = computed(() => {
  //   const items: IssueLeaf[] = []
  //   const missingVersionJar = state.diagnose.missingVersionJar
  //   const missingVersionJson = state.diagnose.missingVersionJson
  //   const corruptedVersionJar = state.diagnose.corruptedVersionJar
  //   if (missingVersionJar.activeIssues.length !== 0) {
  //     items.push(...collect('missingVersionJar', missingVersionJar))
  //   }
  //   if (missingVersionJson.activeIssues.length !== 0) {
  //     items.push(...collect('missingVersionJson', missingVersionJson))
  //   }
  //   if (corruptedVersionJar.activeIssues.length !== 0) {
  //     items.push(...collect('corruptedVersionJar', corruptedVersionJar))
  //   }
  //   return { name: 'version', items, location: `${state.base.root}/versions`, $id: $id++ }
  // })
  // const mods = computed(() => {
  //   const items: IssueLeaf[] = []
  //   const incompatibleMod = state.diagnose.incompatibleMod
  //   if (incompatibleMod.activeIssues.length !== 0) {
  //     items.push(...collect('incompatibleMod', incompatibleMod))
  //   }
  //   return { name: 'mod', items, location: `${state.base.root}/mods`, $id: $id++ }
  // })

  // const items = computed(() => {
  //   const result: IssueType[] = []
  //   if (version.value.items.length) {
  //     result.push(version.value)
  //   }
  //   if (assets.value.items.length) {
  //     result.push(assets.value)
  //   }
  //   if (libraries.value.items.length) {
  //     result.push(libraries.value)
  //   }
  //   if (mods.value.items.length) {
  //     result.push(mods.value)
  //   }
  //   return result
  // })

  // return { items, root: state.base.root }
}

const data = reactive({
  tree: [],
  opened: [],
})

</script>

<style scoped=true>
.v-treeview-node__label {
  font-size: 14px;
}
.v-treeview-node__label .material-icons-outlined {
  font-size: 20px;
}
.tree-minor-label {
  color: grey;
  font-size: 12px;
  font-style: italic;
}
</style>
