import type { ModFile } from '@/util/mod'
import type { CompatibleDetail, ModLoaderIncompatibility } from '@/util/modCompatible'
import type { PartialRuntimeVersions } from '@xmcl/instance'

export function isAgentRuntimeCompatibilityChanged(before: PartialRuntimeVersions, after: PartialRuntimeVersions) {
  const fields: Array<keyof PartialRuntimeVersions> = ['minecraft', 'forge', 'neoForged', 'fabricLoader', 'quiltLoader']
  return fields.some(field => (before[field] ?? '') !== (after[field] ?? ''))
}

export function createAgentModDiagnosis(
  mods: ModFile[],
  compatibility: Record<string, CompatibleDetail[]>,
  conflicted: Record<string, ModFile[]>,
  pending: boolean,
  loaderIncompatibilities: ModLoaderIncompatibility[] = [],
) {
  const incompatibilities = Object.entries(compatibility).flatMap(([mod, dependencies]) => dependencies
    .filter(dependency => dependency.compatible !== true)
    .map(dependency => ({
      mod,
      dependency: dependency.modId,
      installedVersion: dependency.version || undefined,
      required: dependency.requirements,
      compatible: dependency.compatible,
      optional: dependency.optional || undefined,
    })))
  const duplicates = Object.entries(conflicted).map(([mod, files]) => ({
    mod,
    files: files.map(file => file.fileName),
  }))
  return {
    status: pending ? 'pending' : incompatibilities.length || loaderIncompatibilities.length || duplicates.length ? 'issues' : 'compatible',
    checkedMods: mods.length,
    incompatibilities,
    loaderIncompatibilities,
    duplicates,
    ...(pending ? { note: 'The renderer mod state did not settle before the diagnosis timeout; these findings may be stale.' } : {}),
  }
}

export function getAgentModCompatibilityGuidance(diagnosis: ReturnType<typeof createAgentModDiagnosis>) {
  if (diagnosis.status === 'issues') {
    return [
      'Some installed mods are incompatible with the selected Minecraft/mod-loader runtime.',
      'Run `mod update check` without `--skip-version` to find compatible replacements; a replacement may be an upgrade or a downgrade.',
      'Then run `mod update stage`, review `instance manifest status`, and run `instance manifest apply` once.',
    ]
  }
  if (diagnosis.status === 'pending') {
    return ['Mod compatibility could not be confirmed because renderer state is still settling. Diagnose again before launching.']
  }
  return ['Installed mods are compatible with the selected runtime according to current local metadata.']
}

export function createAgentManifestApplyResult(
  added: string[],
  removed: string[],
  modDiagnosis?: ReturnType<typeof createAgentModDiagnosis>,
) {
  return {
    ok: true,
    summary: `Applied ${added.length} addition${added.length === 1 ? '' : 's'} and ${removed.length} removal${removed.length === 1 ? '' : 's'}.`,
    applied: added.length,
    removed: removed.length,
    files: { added, removed },
    ...(modDiagnosis ? { modDiagnosis } : {}),
    guidance: modDiagnosis
      ? getAgentModCompatibilityGuidance(modDiagnosis)
      : ['The manifest was applied successfully. No mod files changed, so mod compatibility was not re-evaluated.'],
  }
}