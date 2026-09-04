import type { ProjectGroup } from '@/composables/modGroup'
import type { ProjectEntry, ProjectFile } from '@/util/search'

export function isProjectInModGroup<T extends ProjectFile>(group: ProjectGroup<T>, projectId: string | undefined): boolean {
  return !!projectId && group.projects.some(project => project.id === projectId)
}

export function flattenVisibleModGroups<T extends ProjectFile>(
  items: Array<ProjectEntry<T> | ProjectGroup<T>>,
  matches: (item: ProjectEntry<T>) => boolean,
  collapsed: Record<string, boolean>,
): Array<ProjectEntry<T> | ProjectGroup<T>> {
  const result: Array<ProjectEntry<T> | ProjectGroup<T>> = []
  for (const item of items) {
    if ('projects' in item) {
      const visibleProjects = item.projects.filter(matches)
      if (visibleProjects.length === 0) continue
      result.push(item)
      if (!collapsed[item.name]) result.push(...visibleProjects)
    } else if (matches(item)) {
      result.push(item)
    }
  }
  return result
}