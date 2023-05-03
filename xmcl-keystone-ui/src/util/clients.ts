import { CurseforgeV1Client } from '@xmcl/curseforge'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { FTBClient } from './ftbClient'

export const clientModrinthV2 = new ModrinthV2Client()
export const clientModrinchV2Locale = new ModrinthV2Client({ baseUrl: 'https://api.xmcl.app/modrinth' })
export const clientCurseforgeV1 = new CurseforgeV1Client('', {})
export const clientCurseforgeV1Locale = new CurseforgeV1Client('', { baseUrl: 'https://api.xmcl.app/curseforge' })
export const clientFTB = new FTBClient()
