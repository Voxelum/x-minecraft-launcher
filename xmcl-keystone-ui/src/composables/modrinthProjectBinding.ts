import type { Project } from '@xmcl/modrinth'
import type { ExportFileDirective, ModrinthPackProfile } from '@xmcl/runtime-api'
import { useEventBus } from '@vueuse/core'
import type { DialogKey } from './dialog'

const bindingChannel = new BroadcastChannel('modrinth-project-binding')
const bindingBus = useEventBus<Project>('modrinth-project-bound')
const projectCache = shallowReactive<Record<string, Project>>({})
const latestBoundProject = shallowRef<Project>()
bindingChannel.addEventListener('message', (event: MessageEvent<Project>) => notifyModrinthProjectBound(event.data))

export interface ModrinthProjectCreateDialogOptions {
  instancePath: string
  name: string
  summary: string
  hasServer: boolean
}

export interface ModrinthProjectBindDialogOptions {
  instancePath: string
}

export interface ModrinthVersionPublishDialogOptions {
  instancePath: string
  projectId: string
  projectSlug: string
  gameVersion: string
  loaders: string[]
  name: string
  author: string
  currentVersion: string
  destinationDirectory: string
  strictMode: boolean
  profile: ModrinthPackProfile
  versionType: 'release' | 'beta' | 'alpha'
  files: ExportFileDirective[]
  onPublished?: () => void | Promise<void>
}

export const ModrinthProjectCreateDialogKey: DialogKey<ModrinthProjectCreateDialogOptions> = 'modrinth-project-create'
export const ModrinthProjectBindDialogKey: DialogKey<ModrinthProjectBindDialogOptions> = 'modrinth-project-bind'
export const ModrinthVersionPublishDialogKey: DialogKey<ModrinthVersionPublishDialogOptions> = 'modrinth-version-publish'

export function useModrinthProjectBindingBus() {
  return bindingBus
}

export function notifyModrinthProjectBound(project: Project) {
  projectCache[project.id] = project
  latestBoundProject.value = project
  bindingBus.emit(project)
}

export function getCachedModrinthProject(projectId: string) {
  return projectCache[projectId]
}

export function useLatestBoundModrinthProject() {
  return readonly(latestBoundProject)
}