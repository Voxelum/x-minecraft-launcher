import { curseforgeModpackParser } from './curseforgeModpack'
import { fabricModParser } from './fabricMod'
import { forgeModParser } from './forgeMod'
import { liteloaderModParser } from './liteloaderMod'
import { mcbbsModpackParser } from './mcbbsModpack'
import { modpackParser } from './modpack'
import { modrinthModpackParser } from './modrinthModpack'
import { quiltModParser } from './quiltMod'
import { resourcePackParser } from './resourcePack'
import { saveParser } from './save'
import { shaderPackParser } from './shaderPack'

export default [
  modpackParser,
  fabricModParser,
  quiltModParser,
  liteloaderModParser,
  forgeModParser,
  shaderPackParser,
  modrinthModpackParser,
  resourcePackParser,
  saveParser,
  mcbbsModpackParser,
  curseforgeModpackParser,
]
