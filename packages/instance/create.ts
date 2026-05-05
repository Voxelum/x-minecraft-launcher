import { Instance, InstanceDataWithTime, InstanceSchema, PartialRuntimeVersions } from './instance'
import { VersionMetadataProvider } from './internal_type'

export type CreateInstanceOptions = Partial<Omit<InstanceDataWithTime, 'runtime'>> & {
  name: string
  path?: string
  runtime?: PartialRuntimeVersions
  /**
   * Create resourcepacks folder
   */
  resourcepacks?: boolean
  /**
   * Create shaderpacks folder
   */
  shaderpacks?: boolean
}


/**
 * Create or load an instance
 * @param options The instance json data
 * @param getCandidatePath The helper function to allocate the path
 * @param getLatestRelease The helper function to get latest minecraft release
 * @param isCreate Is create a fresh new instance
 * @returns The loaded instance
 */
export function createInstance(
  options: unknown,
  getCandidatePath: (name: string) => string,
  getLatestRelease: VersionMetadataProvider,
  isCreate: boolean = true,
): Instance {
  const raw = InstanceSchema.parse(options)
  if (!raw.runtime.minecraft) {
    raw.runtime.minecraft = getLatestRelease()
  }
  if (isCreate) {
    raw.creationDate = Date.now()
    raw.lastAccessDate = Date.now()
    raw.playtime = 0
    raw.lastPlayedDate = 0
  }
  return {
    ...raw,
    path: raw.path || getCandidatePath(raw.name)
  }
}
