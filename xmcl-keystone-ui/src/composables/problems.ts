import { Ref } from 'vue'
import { AssetIndexIssueKey, AssetsIssueKey, IncompatibleJavaIssueKey, isIssue, Issue, LibrariesIssueKey, MissingJavaIssueKey, VersionIssueKey, VersionJarIssueKey, VersionJsonIssueKey } from '@xmcl/runtime-api'
import { useIssues } from '@/composables'

export function useProblemItems(issues: Ref<Issue[]>) {
  const { t } = useI18n()
  const items = computed(() => issues.value
    .filter(i => !isIssue(VersionIssueKey, i))
    .map((i) => {
      if (isIssue(AssetsIssueKey, i)) {
        if (i.parameters[0].assets.some(v => v.type === 'corrupted')) {
          return { title: t('diagnosis.corruptedAssets.name', 2, { named: { count: i.parameters[0].assets.length } }), description: t('diagnosis.corruptedAssets.message'), ...i }
        } else {
          return { title: t('diagnosis.missingAssets.name', 2, { named: { count: i.parameters[0].assets.length } }), description: t('diagnosis.missingAssets.message'), ...i }
        }
      } else if (isIssue(LibrariesIssueKey, i)) {
        if (i.parameters[0].libraries.some(v => v.type === 'corrupted')) {
          return { title: t('diagnosis.corruptedLibraries.name', 2, { named: { count: i.parameters[0].libraries.length } }), description: t('diagnosis.corruptedLibraries.message'), ...i }
        } else {
          return { title: t('diagnosis.missingLibraries.name', 2, { named: { count: i.parameters[0].libraries.length } }), description: t('diagnosis.missingLibraries.message'), ...i }
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
      } else if (isIssue(IncompatibleJavaIssueKey, i)) {
        return {
          title: t('diagnosis.incompatibleJava.name', { version: i.parameters[0].version, javaVersion: i.parameters[0].selectedJava.version || i.parameters[0].selectedJava.path }),
          description: t('diagnosis.incompatibleJava.message'),
          ...i,
        }
      } else if (isIssue(MissingJavaIssueKey, i)) {
        return {
          title: t('diagnosis.missingJava.name'),
          description: t('diagnosis.missingJava.message'),
          ...i,
        }
      }
      return { title: t(`diagnosis.${i.id}.name`, i.parameters.length || 0, i.parameters[0]), description: t(`diagnosis.${i.id}.message`, { }), ...i }
    }))
  return items
}
