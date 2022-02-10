import { curseforgeModpackParser } from './curseforgeModpack'
import { fabricModParser } from './fabricMod'
import { forgeModParser } from './forgeMod'
import { liteloaderModParser } from './liteloaderMod'
import { mcbbsModpackParser } from './mcbbsModpack'
import { modpackParser } from './modpack'
import { resourcePackParser } from './resourcePack'
import { saveParser } from './save'
import { shaderPackParser } from './shaderPack'

export default [
  modpackParser,
  forgeModParser,
  fabricModParser,
  liteloaderModParser,
  resourcePackParser,
  saveParser,
  mcbbsModpackParser,
  curseforgeModpackParser,
  shaderPackParser,
]
