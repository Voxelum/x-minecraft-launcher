import { FileRelationType } from '@xmcl/curseforge'

export function getCurseforgeRelationType(type: FileRelationType) {
  return type === FileRelationType.RequiredDependency
    ? 'required'
    : type === FileRelationType.OptionalDependency || type === FileRelationType.Tool
      ? 'optional'
      : type === FileRelationType.Incompatible
        ? 'incompatible'
        : 'embedded'
}
