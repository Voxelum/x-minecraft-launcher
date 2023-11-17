import { ForgeVersion } from '@xmcl/runtime-api'
import { request } from 'undici'

export interface BMCLForge {
  'branch': string // '1.9';
  'build': string // 1766;
  'mcversion': string // '1.9';
  'modified': string // '2016-03-18T07:44:28.000Z';
  'version': string // '12.16.0.1766';
  files: {
    format: 'zip' | 'jar' // zip
    category: 'universal' | 'mdk' | 'installer'
    hash: string
  }[]
}

export async function getForgeListFromBMCL(minecraft: string) {
  const response = await request(`https://bmclapi2.bangbang93.com/forge/minecraft/${minecraft}`, {
    method: 'GET',
    maxRedirections: 2,
  })
  const forges: BMCLForge[] = await response.body.json()

  return forges.map(v => ({
    mcversion: v.mcversion,
    version: v.version,
    type: 'common',
    date: v.modified,
  } as ForgeVersion))
}
