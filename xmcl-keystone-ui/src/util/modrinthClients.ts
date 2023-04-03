import { ModrinthV2Client } from '@xmcl/modrinth'

export const client = new ModrinthV2Client()
export const localeClient = new ModrinthV2Client({ baseUrl: 'https://api.xmcl.app/modrinth' })
