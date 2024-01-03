import { ForgeVersion } from '@xmcl/runtime-api'

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

export function getForgeListFromBMCLList(forges: BMCLForge[]) {
  return forges.map(v => ({
    mcversion: v.mcversion,
    version: v.version,
    type: 'common',
    date: v.modified,
  } as ForgeVersion))
}
