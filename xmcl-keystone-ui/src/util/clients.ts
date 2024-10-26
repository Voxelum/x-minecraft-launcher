import { CurseforgeV1Client } from '@xmcl/curseforge'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { FTBClient } from './ftbClient'

export const clientModrinthV2 = new ModrinthV2Client()
export const clientCurseforgeV1 = new CurseforgeV1Client('', {})
export const clientFTB = new FTBClient()
