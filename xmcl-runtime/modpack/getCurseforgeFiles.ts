import { File, CurseforgeApiError, CurseforgeV1Client, Mod } from '@xmcl/curseforge'

export async function getCurseforgeProjects(client: CurseforgeV1Client, ids: number[]): Promise<Mod[]> {
  if (ids.length === 0) return []
  try {
    const mods = await client.getMods(ids)
    return mods
  } catch (e) {
    if (e instanceof CurseforgeApiError && e.status === 400) {
      if (ids.length <= 1) {
        // TODO: handle this
        return []
      }
      // divide into two parts
      const mid = Math.floor(ids.length / 2)
      const [left, right] = await Promise.all([
        getCurseforgeProjects(client, ids.slice(0, mid)),
        getCurseforgeProjects(client, ids.slice(mid)),
      ])
      return [...left, ...right]
    }
    throw e
  }
}

export async function getCurseforgeFiles(client: CurseforgeV1Client, ids: number[]): Promise<File[]> {
  if (ids.length === 0) return []
  try {
    const files = await client.getFiles(ids)
    return files
  } catch (e) {
    if (e instanceof CurseforgeApiError && e.status === 400) {
      if (ids.length <= 1) {
        // TODO: handle this
        return []
      }
      // divide into two parts
      const mid = Math.floor(ids.length / 2)
      const [left, right] = await Promise.all([
        getCurseforgeFiles(client, ids.slice(0, mid)),
        getCurseforgeFiles(client, ids.slice(mid)),
      ])
      return [...left, ...right]
    }
    throw e
  }
}
