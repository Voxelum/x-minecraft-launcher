/**
 * Top-down block color table used to render a save world map similar to
 * Querz/mcaselector. Colors are an approximation of the block's top face.
 *
 * Keys are block ids without the `minecraft:` namespace. Unknown blocks fall
 * back to a deterministic hash color so the map still conveys structure.
 */
const BLOCK_COLORS: Record<string, [number, number, number]> = {
  air: [0, 0, 0],
  cave_air: [0, 0, 0],
  void_air: [0, 0, 0],

  // Terrain
  stone: [125, 125, 125],
  granite: [149, 103, 85],
  polished_granite: [154, 107, 89],
  diorite: [188, 188, 189],
  polished_diorite: [193, 193, 195],
  andesite: [136, 136, 138],
  polished_andesite: [131, 131, 131],
  deepslate: [80, 80, 82],
  cobbled_deepslate: [77, 77, 80],
  tuff: [108, 109, 102],
  calcite: [223, 224, 220],
  dripstone_block: [134, 107, 92],
  grass_block: [127, 178, 56],
  dirt: [134, 96, 67],
  coarse_dirt: [119, 85, 59],
  rooted_dirt: [144, 103, 76],
  podzol: [106, 67, 27],
  mycelium: [111, 99, 100],
  mud: [60, 56, 60],
  packed_mud: [142, 105, 76],
  farmland: [122, 76, 41],
  dirt_path: [148, 122, 65],
  sand: [219, 207, 163],
  red_sand: [189, 105, 50],
  sandstone: [216, 203, 155],
  red_sandstone: [186, 99, 29],
  gravel: [131, 127, 126],
  clay: [160, 166, 179],
  bedrock: [85, 85, 85],
  obsidian: [20, 18, 30],
  crying_obsidian: [38, 13, 75],
  netherrack: [97, 38, 38],
  soul_sand: [81, 62, 50],
  soul_soil: [76, 58, 47],
  basalt: [73, 72, 79],
  blackstone: [42, 35, 41],
  end_stone: [219, 222, 158],
  snow: [240, 251, 252],
  snow_block: [240, 251, 252],
  powder_snow: [248, 252, 253],
  ice: [145, 183, 252],
  packed_ice: [141, 180, 250],
  blue_ice: [116, 168, 252],
  magma_block: [142, 60, 28],

  // Ores
  coal_ore: [105, 105, 105],
  iron_ore: [185, 154, 125],
  copper_ore: [150, 122, 100],
  gold_ore: [188, 168, 99],
  redstone_ore: [151, 110, 110],
  emerald_ore: [108, 150, 116],
  lapis_ore: [101, 122, 156],
  diamond_ore: [129, 175, 173],
  deepslate_coal_ore: [73, 73, 75],
  deepslate_iron_ore: [124, 117, 108],
  deepslate_gold_ore: [134, 124, 86],
  deepslate_diamond_ore: [86, 119, 118],
  nether_quartz_ore: [120, 71, 65],
  nether_gold_ore: [120, 64, 51],
  ancient_debris: [95, 67, 56],

  // Water / lava
  water: [63, 118, 228],
  flowing_water: [63, 118, 228],
  lava: [212, 90, 18],
  flowing_lava: [212, 90, 18],

  // Vegetation
  grass: [101, 153, 56],
  short_grass: [101, 153, 56],
  tall_grass: [101, 153, 56],
  fern: [89, 138, 56],
  large_fern: [89, 138, 56],
  oak_leaves: [55, 110, 40],
  spruce_leaves: [46, 84, 46],
  birch_leaves: [78, 122, 60],
  jungle_leaves: [48, 110, 24],
  acacia_leaves: [83, 116, 36],
  dark_oak_leaves: [44, 80, 24],
  mangrove_leaves: [52, 110, 38],
  cherry_leaves: [225, 173, 200],
  azalea_leaves: [83, 122, 49],
  flowering_azalea_leaves: [99, 120, 67],
  moss_block: [89, 109, 45],
  moss_carpet: [89, 109, 45],
  vine: [42, 84, 28],
  lily_pad: [32, 78, 28],
  sugar_cane: [148, 192, 101],
  bamboo: [121, 166, 41],
  cactus: [88, 130, 53],
  pumpkin: [203, 121, 26],
  melon: [114, 158, 36],
  hay_block: [166, 138, 23],

  // Logs / wood
  oak_log: [109, 86, 52],
  spruce_log: [58, 39, 19],
  birch_log: [196, 188, 165],
  jungle_log: [86, 67, 26],
  acacia_log: [104, 60, 36],
  dark_oak_log: [49, 36, 21],
  mangrove_log: [89, 36, 33],
  cherry_log: [55, 32, 39],
  crimson_stem: [122, 57, 80],
  warped_stem: [44, 105, 105],
  oak_planks: [162, 131, 79],
  spruce_planks: [114, 84, 48],
  birch_planks: [192, 175, 121],
  jungle_planks: [160, 115, 80],
  acacia_planks: [168, 90, 50],
  dark_oak_planks: [66, 43, 20],
  mangrove_planks: [117, 54, 48],
  cherry_planks: [226, 178, 165],
  crimson_planks: [101, 48, 67],
  warped_planks: [43, 104, 99],

  // Building blocks
  cobblestone: [127, 127, 127],
  mossy_cobblestone: [109, 119, 92],
  stone_bricks: [122, 121, 122],
  mossy_stone_bricks: [110, 118, 101],
  cracked_stone_bricks: [118, 117, 115],
  bricks: [150, 97, 83],
  nether_bricks: [44, 21, 26],
  red_nether_bricks: [69, 12, 16],
  quartz_block: [235, 229, 222],
  prismarine: [99, 156, 151],
  prismarine_bricks: [99, 171, 158],
  dark_prismarine: [51, 91, 75],
  sea_lantern: [172, 199, 190],
  glowstone: [171, 131, 84],
  bookshelf: [121, 91, 53],
  glass: [191, 218, 221],
  white_concrete: [207, 213, 214],
  bone_block: [209, 205, 178],
  honeycomb_block: [229, 148, 29],

  // Wool / colored (used as generic builds)
  white_wool: [233, 236, 236],
  orange_wool: [240, 118, 19],
  magenta_wool: [189, 68, 179],
  light_blue_wool: [58, 175, 217],
  yellow_wool: [248, 198, 39],
  lime_wool: [112, 185, 25],
  pink_wool: [237, 141, 172],
  gray_wool: [62, 68, 71],
  light_gray_wool: [142, 142, 134],
  cyan_wool: [21, 137, 145],
  purple_wool: [121, 42, 172],
  blue_wool: [53, 57, 157],
  brown_wool: [114, 71, 40],
  green_wool: [84, 109, 27],
  red_wool: [160, 39, 34],
  black_wool: [20, 21, 25],

  // Misc structures
  netherite_block: [66, 61, 64],
  iron_block: [220, 220, 220],
  gold_block: [246, 208, 61],
  diamond_block: [110, 219, 214],
  emerald_block: [66, 191, 116],
  redstone_block: [175, 24, 5],
  lapis_block: [30, 67, 140],
  coal_block: [16, 15, 15],
  copper_block: [192, 107, 79],
  amethyst_block: [133, 97, 191],
  slime_block: [111, 192, 91],
  honey_block: [251, 184, 48],
  tnt: [219, 67, 51],
  crafting_table: [122, 78, 46],
  furnace: [104, 104, 104],
  chest: [137, 103, 47],
  spawner: [27, 42, 56],
  nether_portal: [99, 41, 167],
  end_portal: [12, 12, 28],
}

function hashColor(name: string): [number, number, number] {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (Math.imul(31, hash) + name.charCodeAt(i)) | 0
  }
  const h = Math.abs(hash)
  // Keep colors in a mid range so they stay visible on the map.
  return [
    64 + (h & 0x7f),
    64 + ((h >> 8) & 0x7f),
    64 + ((h >> 16) & 0x7f),
  ]
}

/**
 * Resolve the top-down color for a block id.
 * @param name The block id, with or without the `minecraft:` namespace.
 */
export function getBlockColor(name: string): [number, number, number] {
  const id = name.startsWith('minecraft:') ? name.slice('minecraft:'.length) : name
  const direct = BLOCK_COLORS[id]
  if (direct) return direct

  // Heuristics for unmapped variants so similar blocks share a tone.
  if (id.endsWith('_leaves')) return [56, 104, 40]
  if (id.endsWith('_log') || id.endsWith('_wood') || id.endsWith('_stem') || id.endsWith('_hyphae')) return [96, 75, 47]
  if (id.endsWith('_planks')) return [160, 128, 78]
  if (id.endsWith('_wool') || id.endsWith('_carpet')) return [200, 200, 200]
  if (id.endsWith('_concrete')) return [150, 150, 150]
  if (id.endsWith('_terracotta') || id.endsWith('_glazed_terracotta')) return [152, 94, 67]
  if (id.endsWith('_stained_glass') || id === 'glass') return [191, 218, 221]
  if (id.includes('water')) return [63, 118, 228]
  if (id.includes('lava')) return [212, 90, 18]
  if (id.includes('deepslate')) return [80, 80, 82]
  if (id.includes('sandstone')) return [216, 203, 155]
  if (id.includes('stone')) return [125, 125, 125]
  if (id.includes('dirt')) return [134, 96, 67]
  if (id.includes('sand')) return [219, 207, 163]
  if (id.includes('grass')) return [127, 178, 56]
  if (id.includes('snow') || id.includes('ice')) return [220, 235, 245]

  return hashColor(id)
}

/**
 * Block ids that should be treated as transparent / skipped when looking for
 * the surface block, so the map shows the first solid block underneath.
 */
export const TRANSPARENT_BLOCKS = new Set([
  'air',
  'cave_air',
  'void_air',
  'barrier',
  'light',
  'structure_void',
])
