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

async function getForgeList(minecraft: string) {
  const { body } = await request(`https://bmclapi2.bangbang93.com/forge/minecraft/${minecraft}`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36 Edg/83.0.478.45',
    },
  })
  const forges: BMCLForge[] = await body.json()
  return forges
}
