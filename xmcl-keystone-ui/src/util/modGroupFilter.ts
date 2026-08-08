import type { ProjectGroup } from '@/composables/modGroup'
import type { ModFile } from '@/util/mod'
import type { ProjectEntry } from '@/util/search'

type ModEntry = ProjectEntry<ModFile>
type ModGroup = ProjectGroup<ModFile>

export function flattenVisibleModGroups(
  items: Array<ModEntry | ModGroup>,
  matches: (item: ModEntry) => boolean,
  collapsed: Record<string, boolean>,
): Array<ModEntry | ModGroup> {
  const result: Array<ModEntry | ModGroup> = []
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