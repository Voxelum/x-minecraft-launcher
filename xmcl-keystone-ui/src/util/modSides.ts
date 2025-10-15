import { Project } from '@xmcl/modrinth'
import { clientModrinthV2 } from './clients'

export async function getModSides(query: Array<{ hash: string, modrinth?: { projectId: string } }>, unboundClient = false) {
  const [modrinths, others] = query.reduce((acc, v) => {
    if (v.modrinth) {
      acc[0].push(v)
    } else {
      acc[1].push(v)
    }
    return acc
  }, [[], []] as [{ hash: string, modrinth?: { projectId: string } }[], { hash: string, modrinth?: { projectId: string } }[]])
  const hashes = others.map(v => v.hash)
  const dict = hashes.length > 0 ? await clientModrinthV2.getProjectVersionsByHash(hashes) : {}
  const hashToProjId = Object.fromEntries(Object.entries(dict).map(([hash, v]) => [hash, v.project_id]))
  const projIds = modrinths.map(v => v.modrinth!.projectId).concat(Object.values(hashToProjId))

  const allProjects = projIds.length > 0 ? await clientModrinthV2.getProjects(projIds) : []
  const allProjectsDict = Object.fromEntries(allProjects.map(v => [v.id, v]))

  const getSideFromProject = (p?: Project) => {
    if (!p) return undefined
    if (p.client_side === 'unsupported' && unboundClient) {
      return {
        client: 'optional',
        server: p.server_side,
      }
    }
    return {
      client: p.client_side,
      server: p.server_side,
    }
  }

  const hashToSide = Object.fromEntries(query.map(v => [
    v.hash,
    v.modrinth
      ? getSideFromProject(allProjectsDict[v.modrinth.projectId])
      : hashToProjId[v.hash]
        ? getSideFromProject(allProjectsDict[hashToProjId[v.hash]])
        : undefined
  ]))

  return hashToSide
}