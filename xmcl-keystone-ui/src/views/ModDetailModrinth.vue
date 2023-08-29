<script setup lang="ts">
import { useService } from '@/composables'
import { kImageDialog } from '@/composables/imageDialog'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { useModDetailEnable, useModDetailUpdate, useModrinthModDetailData, useModrinthModDetailVersions } from '@/composables/modDetail'
import { useModrinthDependencies } from '@/composables/modrinthDependencies'
import { useModrinthProject } from '@/composables/modrinthProject'
import { useModrinthTask, useModrinthVersions, useModrinthVersionsResources } from '@/composables/modrinthVersions'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { ProjectVersion, SearchResultHit } from '@xmcl/modrinth'
import { InstanceModsServiceKey, ModrinthServiceKey, Resource } from '@xmcl/runtime-api'
import ModDetail, { ModDependency } from './ModDetail.vue'
import { ModVersion } from './ModDetailVersion.vue'

const props = defineProps<{
  modrinth?: SearchResultHit
  projectId: string
  installed: ModFile[]
  minecraft: string
  loader: string
}>()

const projectId = computed(() => props.projectId)
const { project, refreshing: loading } = useModrinthProject(projectId)
const { versions, refreshing: loadingVersions } = useModrinthVersions(projectId,
  undefined,
  computed(() => [props.loader]),
  computed(() => [props.minecraft]))

const model = useModrinthModDetailData(projectId, project, computed(() => props.modrinth))
const modVersions = useModrinthModDetailVersions(versions, computed(() => props.installed))

const imageDialog = injection(kImageDialog)

const selectedVersion = ref(modVersions.value[0] as ModVersion | undefined)
provide('selectedVersion', selectedVersion)

const { mods } = injection(kInstanceModsContext)
const { data: deps, isValidating, error } = useModrinthDependencies(computed(() => versions.value.find(v => v.id === selectedVersion.value?.id)))
const dependencies = computed(() => {
  if (!deps.value) return []

  return deps.value.map(({ recommendedVersion, versions, project, type }) => {
    // TODO: optimize this perf
    const file = computed(() => {
      for (const mod of mods.value) {
        if (mod.modrinth?.versionId === recommendedVersion.id) {
          return mod
        }
      }
    })
    const otherFile = computed(() => {
      for (const mod of mods.value) {
        if (mod.modrinth?.projectId === project.id && mod.modrinth?.versionId !== recommendedVersion.id) {
          return mod
        }
      }
    })
    const task = useModrinthTask(computed(() => recommendedVersion.id))
    const dep: ModDependency = reactive({
      id: project.id,
      icon: project.icon_url,
      title: project.title,
      version: recommendedVersion.name,
      description: recommendedVersion.files[0].filename,
      type,
      installedVersion: computed(() => file.value?.version),
      installedDifferentVersion: computed(() => otherFile.value?.version),
      progress: computed(() => task.value ? task.value.progress / task.value.total : -1),
    })
    return dep
  }) ?? []
})

const { path } = injection(kInstance)
const { installVersion } = useService(ModrinthServiceKey)
const { install: installMod, uninstall: uninstallMod } = useService(InstanceModsServiceKey)
const installing = ref(false)
const { getResource } = useModrinthVersionsResources(versions)
const installModrinthVersion = async (v: ProjectVersion) => {
  const resource = getResource(v)
  if (resource) {
    await installMod({ mods: [resource], path: path.value })
  } else {
    await installVersion({ version: v, icon: project.value?.icon_url, instancePath: path.value })
  }
}

const updating = useModDetailUpdate()

const install = async (mod: ModVersion) => {
  const v = versions.value.find(v => v.id === mod.id)
  if (!v) return
  try {
    installing.value = true
    if (!hasInstalledVersion.value) {
      await Promise.all(deps.value
        ?.filter((v) => v.type === 'required')
        .filter(v => mods.value.every(m => m.modrinth?.projectId !== v.project.id))
        .map((v) => installModrinthVersion(v.recommendedVersion)) ?? [])
      await installModrinthVersion(v)
    } else {
      const resources = props.installed.map(i => i.resource)
      await Promise.all(deps.value
        ?.filter((v) => v.type === 'required')
        .filter(v => mods.value.every(m => m.modrinth?.projectId !== v.project.id))
        .map((v) => installModrinthVersion(v.recommendedVersion)) ?? [])
      await installModrinthVersion(v)
      await uninstallMod({ path: path.value, mods: resources })
    }
  } finally {
    installing.value = false
  }
}
const installDependency = async (dep: ModDependency) => {
  const d = deps.value?.find(d => d.project.id === dep.id)
  if (!d) return
  const ver = d.recommendedVersion
  try {
    installing.value = true
    const resources = [] as Resource[]
    if (dep.installedDifferentVersion) {
      for (const mod of mods.value) {
        if (mod.modrinth?.projectId === d.project.id) {
          resources.push(mod.resource)
        }
      }
    }
    await installModrinthVersion(ver)
    if (resources.length > 0) {
      await uninstallMod({ path: path.value, mods: resources })
    }
  } finally {
    installing.value = false
  }
}

watch(() => props.modrinth, () => {
  updating.value = false
})

const { enabled, installed, hasInstalledVersion } = useModDetailEnable(selectedVersion, computed(() => props.installed), updating)

const onDelete = async () => {
  updating.value = true
  await uninstallMod({ path: path.value, mods: props.installed.map(i => i.resource) })
}

const { push, currentRoute } = useRouter()
const onOpenDependency = (dep: ModDependency) => {
  push({ query: { ...currentRoute.query, id: `modrinth:${dep.id}` } })
}

</script>

<template>
  <ModDetail
    :detail="model"
    :has-more="false"
    :enabled="enabled"
    :selected-installed="installed"
    :has-installed-version="hasInstalledVersion"
    :versions="modVersions"
    :updating="updating || installing"
    :loading-dependencies="isValidating"
    :dependencies="dependencies"
    :loading="loading"
    :loading-versions="loadingVersions"
    @open-dependency="onOpenDependency"
    @show-image="imageDialog.show($event.url, { description: $event.description, date: $event.date })"
    @install="install"
    @enable="enabled = $event"
    @delete="onDelete"
    @install-dependency="installDependency"
  />
</template>
