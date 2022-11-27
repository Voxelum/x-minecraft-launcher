import { AssetIndexIssueKey, AssetsIssueKey, InstallProfileIssueKey, isIssue, LibrariesIssueKey, VersionIssueKey, VersionJarIssueKey, VersionJsonIssueKey } from '@xmcl/runtime-api'
import { useIssues } from './issues'

export function useLaunchIssue() {
  const { issues } = useIssues()
  const issue = computed(() => {
    for (const i of issues.value) {
      if (isIssue(AssetsIssueKey, i)) {
        return i
      }
      if (isIssue(LibrariesIssueKey, i)) {
        return i
      }
      if (isIssue(AssetIndexIssueKey, i)) {
        return i
      }
      if (isIssue(VersionIssueKey, i)) {
        return i
      }
      if (isIssue(VersionJsonIssueKey, i)) {
        return i
      }
      if (isIssue(VersionJarIssueKey, i)) {
        return i
      }
      if (isIssue(InstallProfileIssueKey, i)) {
        return i
      }
    }
    return undefined
  })
  return issue
}
