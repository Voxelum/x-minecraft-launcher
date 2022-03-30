<template>
  <v-card
    flat
    style="min-height: 300px; max-height: 400px; max-width: 100%; overflow: auto;"

    color="grey en-4"
  >
    <!-- <v-card-text>
      {{ items.length === 0 ? $t('issue.empty') : '' }}
      <v-treeview
        v-model="tree"
        :open="opened"
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
            v-if="item.name"
            style="display: flex; align-items: center;"
          >
            <span
              style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;"
            >{{ $t(`${item.name}`) }}</span>
            <span
              class="tree-minor-label"
              style="margin-left: 5px; max-width: 320px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
            >{{ item.location }}</span>
            <v-spacer />
            <v-chip
              style="margin-left: 10px"
              outlined
              small
              label
              color="orange"
            >
              {{ item.items.length }}
            </v-chip>
          </div>
          <div
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
          </div>
        </template>
      </v-treeview>
    </v-card-text> -->
  </v-card>
</template>

<script lang=ts>
import { Registry } from '@xmcl/runtime-api'

interface IssueType {
  name: string
  $id: number
  items: IssueLeaf[]
}
interface IssueLeaf {
  id: string
  $id: number
  fixing: boolean
  autofix: boolean
  optional: boolean
  arguments: object
}

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

export default defineComponent({
  setup() {
    const data = reactive({
      tree: [],
      opened: [],
    })

    return {
      ...toRefs(data),
      // ...useIssuesTree(),
    }
  },
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
