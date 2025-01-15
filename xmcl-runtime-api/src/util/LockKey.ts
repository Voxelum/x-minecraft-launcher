
export const LockKey = {
  versions: 'versions',
  libraries: 'libraries',
  assets: 'assets',
  version: (v: string) => `versions/${v}`,
  instance: (p: string) => `instances/${p}`,
  instanceRemove: (p: string) => `instances/${p}/remove`,
  shaderpacks: (p: string) => `shaderpacks/${p}`,
  resourcepacks: (p: string) => `resourcepacks/${p}`,
}
