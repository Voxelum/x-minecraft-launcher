
export const LockKey = {
  versions: 'versions',
  libraries: 'libraries',
  assets: 'assets',
  version: (v: string) => `versions/${v}`,
  forgePostProcess: (minecraft: string) => `forge-post-process/${minecraft}`,
  instance: (p: string) => `instances/${p}`,
  instanceVersion: (p: string) => `instance-versions/${p}`,
  instanceManifest: (p: string) => `instances/${p}/manifest`,
  instanceRemove: (p: string) => `instances/${p}/remove`,
  shaderpacks: (p: string) => `shaderpacks/${p}`,
  resourcepacks: (p: string) => `resourcepacks/${p}`,
}
