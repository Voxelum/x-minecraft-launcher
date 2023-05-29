<template>
  <div class="relative w-full">
    <v-list
      class="w-full"
      color="transparent"
      three-lines
    >
      <template v-for="(r, index) of resources">
        <v-tooltip
          :key="r.path"
          bottom
          color="black"
          transition="scroll-y-reverse-transition"
        >
          <template #activator="{ on }">
            <v-list-item
              :key="r.path"
              v-on="on"
            >
              <v-list-item-avatar>
                <v-img :src="r.icons ? r.icons[0] : ''" />
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>
                  {{ r.fileName }}
                </v-list-item-title>
                <v-list-item-subtitle class="flex gap-1">
                  <v-chip
                    v-for="d of coreDeps[index]"
                    :key="d.modId"
                    small
                    outlined
                    label
                  >
                    <v-avatar left>
                      {{ getCompatibleIcon(d) }}
                    </v-avatar>
                    {{ d.modId }}
                  </v-chip>
                </v-list-item-subtitle>
                <v-list-item-subtitle>
                  {{ getExpectedSize(r.size) }}
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action class="flex flex-row flex-grow-0 items-center gap-1">
                <v-btn
                  icon
                  text
                  @click="showFile(r)"
                >
                  <v-icon>
                    folder
                  </v-icon>
                </v-btn>
                <v-btn
                  v-if="r.metadata.modrinth"
                  icon
                  text
                  @click="goModrinthProject(r.metadata.modrinth.projectId)"
                >
                  <v-icon>
                    $vuetify.icons.modrinth
                  </v-icon>
                </v-btn>
                <v-btn
                  v-if="r.metadata.curseforge"
                  icon
                  text
                  @click="goCurseforgeProject(r.metadata.curseforge.projectId, 'mc-mods')"
                >
                  <v-icon>
                    $vuetify.icons.curseforge
                  </v-icon>
                </v-btn>
                <v-avatar
                  v-if="forge"
                  size="30px"
                >
                  <v-img
                    width="28"
                    :src="'image://builtin/forge'"
                  />
                </v-avatar>
                <v-avatar
                  v-if="fabric"
                  size="30px"
                >
                  <v-img
                    width="28"
                    :src="'image://builtin/fabric'"
                  />
                </v-avatar>

                <v-avatar
                  v-if="quilt"
                  size="30px"
                >
                  <v-img
                    width="28"
                    :src="'image://builtin/quilt'"
                  />
                </v-avatar>
                <v-btn
                  :disabled="isInstalled(r) || loading"
                  icon
                  @click="emit('install', r)"
                >
                  <v-icon>
                    {{ isInstalled(r) ? 'swap_horiz' : 'add' }}
                  </v-icon>
                </v-btn>
              </v-list-item-action>
            </v-list-item>
          </template>
          <table class="border-separate border-spacing-4">
            <thead class="text-left">
              <tr>
                <th class="pr-2">
                  {{ t('compatibleDetail.id') }}
                </th>
                <th class="pr-2">
                  {{ t('compatibleDetail.requirements') }}
                </th>
                <th class="pr-2">
                  {{ t('compatibleDetail.current') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="d of deps[index]"
                :key="d.modId"
              >
                <td class="italic pr-2">
                  {{ d.modId }}
                </td>
                <td class="pr-2">
                  {{ d.requirements }}
                </td>
                <td class="pr-2">
                  {{ d.version || '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </v-tooltip>
      </template>
    </v-list>
  </div>
</template>
<script setup lang="ts">
import { useService } from '@/composables'
import { getCompatibleIcon } from '@/composables/compatibleIcon'
import { kMarketRoute } from '@/composables/useMarketRoute'
import { injection } from '@/util/inject'
import { getModsCompatiblity } from '@/util/modCompatible'
import { getModDependencies } from '@/util/modDependencies'
import { getExpectedSize } from '@/util/size'
import { BaseServiceKey, Resource, RuntimeVersions } from '@xmcl/runtime-api'

const props = defineProps<{
  resources: Resource[]
  installed: Resource | undefined
  loader: string
  minecraft: string
  runtime: RuntimeVersions
  forge?: boolean
  fabric?: boolean
  quilt?: boolean
  loading: boolean
}>()

const emit = defineEmits(['install'])

const isInstalled = (r: Resource) => {
  return props.installed?.storedPath === r.path || props.installed?.path === r.path || props.installed?.path === r.storedPath || props.installed?.ino === r.ino
}
const { t } = useI18n()

const { showItemInDirectory } = useService(BaseServiceKey)
const showFile = (r: Resource) => {
  showItemInDirectory(r.path)
}

const { goCurseforgeProject, goModrinthProject } = injection(kMarketRoute)
const deps = computed(() => props.resources.map(getModDependencies).map(d => getModsCompatiblity(d, props.runtime as any)))
const coreDeps = computed(() => deps.value.map(v => v.filter(d => d.modId === 'minecraft' || d.modId === 'forge' || d.modId === 'fabric' || d.modId === 'quilt' || d.modId === 'fabricloader')))

</script>
