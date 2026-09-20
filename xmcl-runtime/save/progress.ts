import {
  InstanceProgressAdvancement,
  InstanceProgressChapter,
  InstanceProgressQuestItem,
  InstanceProgressQuests,
  InstanceProgressStats,
  InstanceSaveProgress,
} from '@xmcl/runtime-api'
import { FileSystem, openFileSystem } from '@xmcl/system'
import { pathExists, readdir, readFile, stat } from 'fs-extra'
import { basename, dirname, join } from 'path'
import { exists } from '../util/fs'
import { parseSnbt } from './snbt'

function normalizeId(id: any): string {
  if (id === undefined || id === null) return ''
  let s = String(id).trim().replace(/^[+]/, '').replace(/[bslfdBSLFD]$/, '')
  if (s.startsWith('0x') || s.startsWith('0X')) {
    s = s.substring(2)
  }
  const stripped = s.replace(/^0+/, '')
  return (stripped || '0').toLowerCase()
}

export function extractCleanItemId(raw: any): string {
  if (!raw) return ''
  if (typeof raw === 'object') {
    return raw.id || raw.name || raw.item || ''
  }
  let s = String(raw).trim()
  const imgMatch = s.match(/\{image:([^\s}]+)/i)
  if (imgMatch) return imgMatch[1]
  const idMatch = s.match(/(?:id|item):\s*["']([^"']+)["']/i)
  if (idMatch) return idMatch[1]
  const unquotedMatch = s.match(/(?:id|item):\s*([a-zA-Z0-9_.-]+:[a-zA-Z0-9_./-]+)/i)
  if (unquotedMatch) return unquotedMatch[1]
  if (s.startsWith('{') && s.endsWith('}')) {
    s = s.substring(1, s.length - 1).trim()
  }
  return s
}

export function cleanTitle(title?: string): string {
  if (!title) return ''
  let cleaned = title
    .replace(/\{image:[^}]+\}/gi, '')
    .replace(/§[0-9a-fk-or]/gi, '')
    .replace(/&[0-9a-fk-or]/gi, '')
    .replace(/^[\p{Extended_Pictographic}\p{Emoji}\p{Symbol}\p{Punctuation}\s]+-\s*/u, '')
    .trim()
  return cleaned || title.trim()
}

// Fallback metadata for standard vanilla advancements to ensure rich UI even if client JAR is minimal
// Comprehensive metadata for standard vanilla advancements
type AdvMeta = [id: string, icon: string, frame: 'task' | 'goal' | 'challenge', title: string, description: string, parent?: string]

const RAW_ADVANCEMENTS: AdvMeta[] = [
  // Story Branch
  ['minecraft:story/root', 'minecraft:crafting_table', 'task', 'Minecraft', 'The heart and story of the game'],
  ['minecraft:story/mine_stone', 'minecraft:wooden_pickaxe', 'task', 'Stone Age', 'Mine stone with your new pickaxe', 'minecraft:story/root'],
  ['minecraft:story/upgrade_gear', 'minecraft:stone_pickaxe', 'task', 'Getting an Upgrade', 'Construct a better pickaxe', 'minecraft:story/mine_stone'],
  ['minecraft:story/smelt_iron', 'minecraft:iron_ingot', 'task', 'Acquire Hardware', 'Smelt an iron ingot', 'minecraft:story/upgrade_gear'],
  ['minecraft:story/obtain_armor', 'minecraft:iron_chestplate', 'task', 'Suit Up', 'Protect yourself with a piece of iron armor', 'minecraft:story/smelt_iron'],
  ['minecraft:story/lava_bucket', 'minecraft:lava_bucket', 'task', 'Hot Stuff', 'Fill a bucket with lava', 'minecraft:story/smelt_iron'],
  ['minecraft:story/iron_tools', 'minecraft:iron_pickaxe', 'task', 'Isn\'t It Iron Pick', 'Upgrade your pickaxe', 'minecraft:story/smelt_iron'],
  ['minecraft:story/deflect_arrow', 'minecraft:shield', 'task', 'Not Today, Thank You', 'Deflect a projectile with a shield', 'minecraft:story/obtain_armor'],
  ['minecraft:story/form_obsidian', 'minecraft:obsidian', 'task', 'Ice Bucket Challenge', 'Obtain a block of obsidian', 'minecraft:story/lava_bucket'],
  ['minecraft:story/mine_diamond', 'minecraft:diamond', 'task', 'Diamonds!', 'Acquire diamonds', 'minecraft:story/iron_tools'],
  ['minecraft:story/enter_the_nether', 'minecraft:flint_and_steel', 'task', 'We Need to Go Deeper', 'Build, light, and enter a Nether Portal', 'minecraft:story/form_obsidian'],
  ['minecraft:story/shiny_gear', 'minecraft:diamond_chestplate', 'challenge', 'Cover Me with Diamonds', 'Diamond armor saves lives', 'minecraft:story/mine_diamond'],
  ['minecraft:story/enchant_item', 'minecraft:enchanted_book', 'task', 'Enchanter', 'Enchant an item at an Enchanting Table', 'minecraft:story/mine_diamond'],
  ['minecraft:story/cure_zombie_villager', 'minecraft:golden_apple', 'goal', 'Zombie Doctor', 'Weaken and cure a Zombie Villager', 'minecraft:story/mine_diamond'],
  ['minecraft:story/follow_ender_eye', 'minecraft:ender_eye', 'task', 'Eye Spy', 'Follow an Eye of Ender', 'minecraft:story/enter_the_nether'],
  ['minecraft:story/enter_the_end', 'minecraft:end_portal_frame', 'task', 'The End?', 'Enter the End Portal', 'minecraft:story/follow_ender_eye'],

  // Nether Branch
  ['minecraft:nether/root', 'minecraft:red_nether_bricks', 'task', 'Nether', 'Bring summer clothes'],
  ['minecraft:nether/fast_travel', 'minecraft:map', 'challenge', 'Subspace Bubble', 'Use the Nether to travel 7km in the Overworld', 'minecraft:nether/root'],
  ['minecraft:nether/find_fortress', 'minecraft:nether_bricks', 'task', 'A Terrible Fortress', 'Break your way into a Nether Fortress', 'minecraft:nether/root'],
  ['minecraft:nether/return_to_sender', 'minecraft:fire_charge', 'challenge', 'Return to Sender', 'Destroy a Ghast with a fireball', 'minecraft:nether/root'],
  ['minecraft:nether/find_bastion', 'minecraft:polished_blackstone_bricks', 'task', 'Those Were the Days', 'Enter a bastion remnant', 'minecraft:nether/root'],
  ['minecraft:nether/obtain_crying_obsidian', 'minecraft:crying_obsidian', 'task', 'Who is Cutting Onions?', 'Obtain crying obsidian', 'minecraft:nether/root'],
  ['minecraft:nether/distract_piglin', 'minecraft:gold_ingot', 'task', 'Oh Shiny', 'Distract a piglin with gold', 'minecraft:nether/root'],
  ['minecraft:nether/ride_strider', 'minecraft:warped_fungus_on_a_stick', 'task', 'This Boat Has Legs', 'Ride a strider with a warped fungus on a stick', 'minecraft:nether/root'],
  ['minecraft:nether/obtain_blaze_rod', 'minecraft:blaze_rod', 'task', 'Into Fire', 'Relieve a Blaze of its rod', 'minecraft:nether/find_fortress'],
  ['minecraft:nether/loot_bastion', 'minecraft:chest', 'task', 'War Pigs', 'Loot a chest in a bastion remnant', 'minecraft:nether/find_bastion'],
  ['minecraft:nether/brew_potion', 'minecraft:potion', 'task', 'Local Brewery', 'Brew a potion', 'minecraft:nether/obtain_blaze_rod'],
  ['minecraft:nether/get_wither_skull', 'minecraft:wither_skeleton_skull', 'task', 'Spooky Scary Skeleton', 'Obtain a Wither Skeleton Skull', 'minecraft:nether/find_fortress'],
  ['minecraft:nether/summon_wither', 'minecraft:nether_star', 'challenge', 'Withering Heights', 'Summon the Wither', 'minecraft:nether/get_wither_skull'],
  ['minecraft:nether/create_beacon', 'minecraft:beacon', 'task', 'Bring Home the Beacon', 'Construct and place a Beacon', 'minecraft:nether/summon_wither'],
  ['minecraft:nether/create_full_beacon', 'minecraft:beacon', 'goal', 'Beaconator', 'Bring a beacon to full power', 'minecraft:nether/create_beacon'],
  ['minecraft:nether/explore_nether', 'minecraft:netherite_boots', 'challenge', 'Hot Tourist Destinations', 'Explore all Nether biomes', 'minecraft:nether/root'],
  ['minecraft:nether/all_potions', 'minecraft:milk_bucket', 'challenge', 'A Furious Cocktail', 'Have every potion effect applied at the same time', 'minecraft:nether/brew_potion'],
  ['minecraft:nether/all_effects', 'minecraft:bucket', 'challenge', 'How Did We Get Here?', 'Have every effect applied at the same time', 'minecraft:nether/all_potions'],
  ['minecraft:nether/charge_respawn_anchor', 'minecraft:respawn_anchor', 'task', 'Not Quite "Nine" Lives', 'Charge a respawn anchor to the maximum', 'minecraft:nether/obtain_crying_obsidian'],
  ['minecraft:nether/netherite_armor', 'minecraft:netherite_chestplate', 'challenge', 'Cover Me in Debris', 'Get a full suit of netherite armor', 'minecraft:nether/obtain_crying_obsidian'],
  ['minecraft:nether/uneasy_alliance', 'minecraft:ghast_tear', 'challenge', 'Uneasy Alliance', 'Rescue a Ghast from the Nether, bring it safely home... and kill it', 'minecraft:nether/return_to_sender'],

  // End Branch
  ['minecraft:end/root', 'minecraft:end_stone', 'task', 'The End', 'Or the beginning?'],
  ['minecraft:end/kill_dragon', 'minecraft:dragon_head', 'task', 'Free the End', 'Good luck', 'minecraft:end/root'],
  ['minecraft:end/dragon_egg', 'minecraft:dragon_egg', 'goal', 'The Next Generation', 'Hold the Dragon Egg', 'minecraft:end/kill_dragon'],
  ['minecraft:end/enter_end_gateway', 'minecraft:ender_pearl', 'task', 'Remote Getaway', 'Escape the island', 'minecraft:end/kill_dragon'],
  ['minecraft:end/respawn_dragon', 'minecraft:end_crystal', 'goal', 'The End... Again...', 'Respawn the Ender Dragon', 'minecraft:end/kill_dragon'],
  ['minecraft:end/dragon_breath', 'minecraft:dragon_breath', 'goal', 'You Need a Mint', 'Collect dragon\'s breath in a glass bottle', 'minecraft:end/kill_dragon'],
  ['minecraft:end/find_end_city', 'minecraft:purpur_block', 'task', 'The City at the End of the Game', 'Go on in', 'minecraft:end/enter_end_gateway'],
  ['minecraft:end/elytra', 'minecraft:elytra', 'goal', 'Sky\'s the Limit', 'Find Elytra', 'minecraft:end/find_end_city'],
  ['minecraft:end/levitate', 'minecraft:shulker_shell', 'challenge', 'Great View From Up Here', 'Levitate up 50 blocks from the attacks of a Shulker', 'minecraft:end/find_end_city'],

  // Adventure Branch
  ['minecraft:adventure/root', 'minecraft:map', 'task', 'Adventure', 'Adventure, exploration and combat'],
  ['minecraft:adventure/kill_a_mob', 'minecraft:iron_sword', 'task', 'Monster Hunter', 'Kill any hostile monster', 'minecraft:adventure/root'],
  ['minecraft:adventure/shoot_arrow', 'minecraft:bow', 'task', 'Take Aim', 'Shoot something with an arrow', 'minecraft:adventure/kill_a_mob'],
  ['minecraft:adventure/sleep_in_bed', 'minecraft:red_bed', 'task', 'Sweet Dreams', 'Sleep in a bed to change your respawn point', 'minecraft:adventure/root'],
  ['minecraft:adventure/trade', 'minecraft:emerald', 'task', 'What a Deal!', 'Successfully trade with a Villager', 'minecraft:adventure/root'],
  ['minecraft:adventure/trade_at_world_height', 'minecraft:emerald', 'goal', 'Star Trader', 'Trade with a villager at the build height limit', 'minecraft:adventure/trade'],
  ['minecraft:adventure/honey_block_slide', 'minecraft:honey_block', 'task', 'Sticky Situation', 'Jump into a honey block to break your fall', 'minecraft:adventure/root'],
  ['minecraft:adventure/ol_betsy', 'minecraft:crossbow', 'task', 'Ol\' Betsy', 'Shoot a crossbow', 'minecraft:adventure/kill_a_mob'],
  ['minecraft:adventure/whos_the_pillager_now', 'minecraft:crossbow', 'task', 'Who\'s the Pillager Now?', 'Give a Pillager a taste of their own medicine', 'minecraft:adventure/ol_betsy'],
  ['minecraft:adventure/two_birds_one_arrow', 'minecraft:crossbow', 'challenge', 'Two Birds, One Arrow', 'Kill two Phantoms with a piercing arrow', 'minecraft:adventure/ol_betsy'],
  ['minecraft:adventure/arbalistic', 'minecraft:crossbow', 'challenge', 'Arbalistic', 'Kill five unique mobs with one crossbow shot', 'minecraft:adventure/ol_betsy'],
  ['minecraft:adventure/voluntary_exile', 'minecraft:ominous_banner', 'task', 'Voluntary Exile', 'Kill a raid captain', 'minecraft:adventure/root'],
  ['minecraft:adventure/hero_of_the_village', 'minecraft:emerald', 'challenge', 'Hero of the Village', 'Successfully defend a village from a raid', 'minecraft:adventure/voluntary_exile'],
  ['minecraft:adventure/sniper_duel', 'minecraft:arrow', 'challenge', 'Sniper Duel', 'Kill a Skeleton from more than 50 meters away', 'minecraft:adventure/shoot_arrow'],
  ['minecraft:adventure/bullseye', 'minecraft:target', 'challenge', 'Bullseye', 'Hit the bullseye of a Target block from at least 30 meters away', 'minecraft:adventure/shoot_arrow'],
  ['minecraft:adventure/totem_of_undying', 'minecraft:totem_of_undying', 'goal', 'Postmortal', 'Use a Totem of Undying to cheat death', 'minecraft:adventure/kill_a_mob'],
  ['minecraft:adventure/adventuring_time', 'minecraft:diamond_boots', 'challenge', 'Adventuring Time', 'Discover every biome', 'minecraft:adventure/root'],
  ['minecraft:adventure/fall_from_world_height', 'minecraft:water_bucket', 'task', 'Caves & Cliffs', 'Free fall from the top of the world to the bottom and survive', 'minecraft:adventure/root'],
  ['minecraft:adventure/spyglass_at_parrot', 'minecraft:spyglass', 'task', 'Is It a Bird?', 'Look at a parrot through a spyglass', 'minecraft:adventure/root'],
  ['minecraft:adventure/spyglass_at_ghast', 'minecraft:spyglass', 'task', 'Is It a Balloon?', 'Look at a Ghast through a spyglass', 'minecraft:adventure/spyglass_at_parrot'],
  ['minecraft:adventure/spyglass_at_dragon', 'minecraft:spyglass', 'task', 'Is It a Plane?', 'Look at the Ender Dragon through a spyglass', 'minecraft:adventure/spyglass_at_ghast'],

  // Husbandry Branch
  ['minecraft:husbandry/root', 'minecraft:hay_block', 'task', 'Husbandry', 'The world is full of friends and food'],
  ['minecraft:husbandry/breed_an_animal', 'minecraft:wheat', 'task', 'The Parrots and the Bats', 'Breed two animals together', 'minecraft:husbandry/root'],
  ['minecraft:husbandry/plant_seed', 'minecraft:wheat_seeds', 'task', 'A Seedy Place', 'Plant a seed and watch it grow', 'minecraft:husbandry/root'],
  ['minecraft:husbandry/balanced_diet', 'minecraft:apple', 'challenge', 'A Balanced Diet', 'Eat everything that is edible', 'minecraft:husbandry/plant_seed'],
  ['minecraft:husbandry/tame_an_animal', 'minecraft:lead', 'task', 'Best Friends Forever', 'Tame an animal', 'minecraft:husbandry/root'],
  ['minecraft:husbandry/fishy_business', 'minecraft:fishing_rod', 'task', 'Fishy Business', 'Catch a fish', 'minecraft:husbandry/root'],
  ['minecraft:husbandry/tactical_fishing', 'minecraft:pufferfish_bucket', 'task', 'Tactical Fishing', 'Catch a fish... without a fishing rod!', 'minecraft:husbandry/root'],
  ['minecraft:husbandry/bred_all_animals', 'minecraft:golden_carrot', 'challenge', 'Two by Two', 'Breed all the animals!', 'minecraft:husbandry/breed_an_animal'],
  ['minecraft:husbandry/complete_catalogue', 'minecraft:cod', 'challenge', 'A Complete Catalogue', 'Tame all cat variants!', 'minecraft:husbandry/tame_an_animal'],
  ['minecraft:husbandry/obtain_netherite_hoe', 'minecraft:netherite_hoe', 'challenge', 'Serious Dedication', 'Upgrade a hoe with Netherite', 'minecraft:husbandry/root'],
  ['minecraft:husbandry/safely_harvest_honey', 'minecraft:honey_bottle', 'task', 'Bee Our Guest', 'Collect Honey from a Beehive without aggravating the bees', 'minecraft:husbandry/root'],
  ['minecraft:husbandry/silk_touch_nest', 'minecraft:bee_nest', 'task', 'Total Beelocation', 'Move a Bee Nest with 3 bees inside using Silk Touch', 'minecraft:husbandry/safely_harvest_honey'],
  ['minecraft:husbandry/wax_on', 'minecraft:honeycomb', 'task', 'Wax On', 'Apply Honeycomb to a Copper block', 'minecraft:husbandry/safely_harvest_honey'],
  ['minecraft:husbandry/wax_off', 'minecraft:stone_axe', 'task', 'Wax Off', 'Scrape wax off of a Copper block', 'minecraft:husbandry/wax_on'],
  ['minecraft:husbandry/axolotl_in_a_bucket', 'minecraft:axolotl_bucket', 'task', 'The Cutest Predator', 'Catch an Axolotl in a bucket', 'minecraft:husbandry/tactical_fishing'],
  ['minecraft:husbandry/kill_axolotl_target', 'minecraft:tropical_fish_bucket', 'task', 'The Healing Power of Friendship!', 'Team up with an axolotl and win a fight', 'minecraft:husbandry/axolotl_in_a_bucket'],
  ['minecraft:husbandry/make_a_sign_glow', 'minecraft:glow_ink_sac', 'task', 'Glow and Behold!', 'Make the text of a sign glow', 'minecraft:husbandry/root'],
  ['minecraft:husbandry/ride_a_boat_with_a_goat', 'minecraft:oak_boat', 'task', 'Whatever Floats Your Goat!', 'Get in a boat and float with a goat', 'minecraft:husbandry/root'],
  ['minecraft:husbandry/leash_all_frog_variants', 'minecraft:lead', 'challenge', 'When the Squad Hops into Town', 'Get each frog variant on a lead', 'minecraft:husbandry/breed_an_animal'],
  ['minecraft:husbandry/froglights', 'minecraft:ochre_froglight', 'challenge', 'With Our Powers Combined!', 'Have all Froglights in your inventory', 'minecraft:husbandry/root'],
  ['minecraft:husbandry/allay_drop_item_in_note_block', 'minecraft:note_block', 'task', 'Birthday Song', 'Have an Allay drop a cake at a Note Block', 'minecraft:husbandry/root'],
  ['minecraft:husbandry/tadpole_in_a_bucket', 'minecraft:tadpole_bucket', 'task', 'Bukkit Bukkit', 'Catch a Tadpole in a bucket', 'minecraft:husbandry/tactical_fishing'],
]

const VANILLA_ADVANCEMENT_METADATA: Record<string, {
  parent?: string
  icon: string
  frame: 'task' | 'goal' | 'challenge'
  title: string
  description: string
}> = {}

for (const [id, icon, frame, title, description, parent] of RAW_ADVANCEMENTS) {
  VANILLA_ADVANCEMENT_METADATA[id] = { parent, icon, frame, title, description }
}

async function findLatestFile(dir: string, preferredUuid?: string): Promise<{ file: string; uuid: string } | undefined> {
  if (!await exists(dir)) return undefined
  const files = await readdir(dir).catch(() => [] as string[])
  const jsonFiles = files.filter(f => f.endsWith('.json'))
  if (jsonFiles.length === 0) return undefined

  if (preferredUuid) {
    const match = jsonFiles.find(f => f.toLowerCase() === `${preferredUuid.toLowerCase()}.json`)
    if (match) {
      return { file: join(dir, match), uuid: match.replace(/\.json$/, '') }
    }
  }

  let latestFile = jsonFiles[0]
  let latestMtime = 0
  for (const f of jsonFiles) {
    try {
      const s = await stat(join(dir, f))
      if (s.mtimeMs > latestMtime) {
        latestMtime = s.mtimeMs
        latestFile = f
      }
    } catch {}
  }

  return { file: join(dir, latestFile), uuid: latestFile.replace(/\.json$/, '') }
}

export async function parseAdvancements(
  filePath?: string,
  extraDefinitions?: Record<string, { parent?: string; icon: string; frame: 'task' | 'goal' | 'challenge'; title: string; description: string }>,
  includeUnearned: boolean = false,
): Promise<{
  completed: number
  categories: Record<string, number>
  items: InstanceProgressAdvancement[]
}> {
  try {
    let json: Record<string, any> = {}
    if (filePath && await pathExists(filePath)) {
      const content = await readFile(filePath, 'utf-8')
      json = JSON.parse(content)
    }

    const items: InstanceProgressAdvancement[] = []
    const categories: Record<string, number> = {}
    let completed = 0

    const allDefs: Record<string, { parent?: string; icon?: string; frame?: 'task' | 'goal' | 'challenge'; title?: string; description?: string }> = {
      ...VANILLA_ADVANCEMENT_METADATA,
      ...(extraDefinitions || {}),
    }

    const validPlayerKeys = Object.keys(json).filter(k => k !== 'DataVersion' && !k.includes('recipes/'))
    const keys = includeUnearned
      ? new Set([...Object.keys(allDefs), ...validPlayerKeys])
      : validPlayerKeys

    for (const key of keys) {
      const data = json[key]
      const def = allDefs[key]
      const done = Boolean(data?.done)
      const criteria = data?.criteria || {}
      const criteriaCompleted = Object.keys(criteria).length

      const colonIdx = key.indexOf(':')
      const mod = colonIdx !== -1 ? key.substring(0, colonIdx) : 'minecraft'

      if (done) {
        completed++
        categories[mod] = (categories[mod] || 0) + 1
      }

      items.push({
        id: key,
        mod,
        done,
        criteriaCompleted,
        totalCriteria: criteriaCompleted,
        completedTime: done && criteriaCompleted > 0 ? (Object.values(criteria)[0] as string) : undefined,
        parent: def?.parent,
        icon: def?.icon || '',
        frame: def?.frame || 'task',
        title: def?.title || undefined,
        description: def?.description || undefined,
      })
    }

    // Compute tree layout coordinates (x, y) per branch
    layoutAdvancementTree(items)

    // Sort items: completed first, then alphabetical
    items.sort((a, b) => {
      if (a.done !== b.done) return a.done ? -1 : 1
      return a.id.localeCompare(b.id)
    })

    return { completed, categories, items }
  } catch {
    return { completed: 0, categories: {}, items: [] }
  }
}

/**
 * Assign coordinates (x, y) for 2D tree layout per branch
 */
function layoutAdvancementTree(items: InstanceProgressAdvancement[]) {
  const itemMap = new Map<string, InstanceProgressAdvancement>()
  for (const item of items) {
    itemMap.set(item.id, item)
  }

  // Group by branch key (e.g. minecraft:story, minecraft:adventure)
  const branchMap = new Map<string, InstanceProgressAdvancement[]>()
  for (const item of items) {
    const colonIdx = item.id.indexOf(':')
    const mod = colonIdx !== -1 ? item.id.substring(0, colonIdx) : 'minecraft'
    const path = colonIdx !== -1 ? item.id.substring(colonIdx + 1) : item.id
    const slashIdx = path.indexOf('/')
    const branchName = slashIdx !== -1 ? path.substring(0, slashIdx) : path
    const branchKey = `${mod}:${branchName}`

    const list = branchMap.get(branchKey) || []
    list.push(item)
    branchMap.set(branchKey, list)
  }

  for (const [, branchItems] of branchMap) {
    const branchItemMap = new Map<string, InstanceProgressAdvancement>()
    for (const it of branchItems) branchItemMap.set(it.id, it)

    const roots: InstanceProgressAdvancement[] = []
    const childrenMap = new Map<string, InstanceProgressAdvancement[]>()

    for (const item of branchItems) {
      if (!item.parent || !branchItemMap.has(item.parent)) {
        roots.push(item)
      } else {
        const list = childrenMap.get(item.parent) || []
        list.push(item)
        childrenMap.set(item.parent, list)
      }
    }

    let yOffset = 0
    for (const root of roots) {
      function positionNode(node: InstanceProgressAdvancement, depth: number, yPos: number): number {
        node.x = depth * 1.8
        node.y = yPos

        const children = childrenMap.get(node.id) || []
        if (children.length === 0) {
          return yPos + 1.2
        }

        let nextY = yPos
        for (const child of children) {
          nextY = positionNode(child, depth + 1, nextY)
        }
        return nextY
      }

      const nextRootY = positionNode(root, 0, yOffset)
      yOffset = nextRootY + 1.0
    }
  }
}

export async function parseStats(filePath: string): Promise<InstanceProgressStats | undefined> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const json = JSON.parse(content)
    const statsObj = json.stats || json

    const custom = statsObj['minecraft:custom'] || statsObj
    const mined = statsObj['minecraft:mined'] || {}

    const playTimeTicks = custom['minecraft:play_time'] ??
      custom['minecraft:total_world_time'] ??
      custom['stat.playOneMinute'] ?? 0

    const deaths = custom['minecraft:deaths'] ?? custom['stat.deaths'] ?? 0
    const mobKills = custom['minecraft:mob_kills'] ?? custom['stat.mobKills'] ?? 0
    const damageDealt = custom['minecraft:damage_dealt'] ?? custom['stat.damageDealt'] ?? 0
    const damageTaken = custom['minecraft:damage_taken'] ?? custom['stat.damageTaken'] ?? 0
    const jump = custom['minecraft:jump'] ?? custom['stat.jump'] ?? 0

    let minedBlocksTotal = 0
    for (const count of Object.values(mined)) {
      if (typeof count === 'number') minedBlocksTotal += count
    }

    return {
      playTimeTicks,
      deaths,
      mobKills,
      damageDealt,
      damageTaken,
      jump,
      minedBlocksTotal,
    }
  } catch {
    return undefined
  }
}

export async function locateFtbPlayerFile(savePath: string, playerUuid?: string): Promise<string | undefined> {
  const possiblePlayerDirs = [
    join(savePath, 'ftbquests', 'players'),
    join(savePath, 'ftbquests', 'teams'),
    join(savePath, 'ftbquests'),
    join(savePath, 'serverconfig', 'ftbquests', 'players'),
    join(savePath, 'serverconfig', 'ftbquests', 'teams'),
    join(savePath, 'ftbteams', 'player'),
  ]

  for (const dir of possiblePlayerDirs) {
    if (!await exists(dir)) continue
    if (playerUuid) {
      const candidate = join(dir, `${playerUuid}.snbt`)
      if (await exists(candidate)) {
        return candidate
      }
    }
    const files = await readdir(dir).catch(() => [] as string[])
    const snbtCandidates = files.filter(f => f.endsWith('.snbt') && !['data.snbt', 'chapter_groups.snbt', 'snbt'].includes(f.toLowerCase()))
    if (snbtCandidates.length > 0) {
      let newestFile: string | undefined
      let newestMtime = -1
      for (const f of snbtCandidates) {
        const filePath = join(dir, f)
        const s = await stat(filePath).catch(() => undefined)
        if (s && s.mtimeMs > newestMtime) {
          newestMtime = s.mtimeMs
          newestFile = filePath
        }
      }
      if (newestFile) {
        return newestFile
      }
    }
  }
  return undefined
}

export async function readCompletedQuestIds(playerProgressFile: string): Promise<Set<string>> {
  const completedQuestIds = new Set<string>()
  try {
    const raw = await readFile(playerProgressFile, 'utf-8')
    const parsed = parseSnbt(raw)
    if (parsed) {
      if (parsed.completed) {
        const comp = Array.isArray(parsed.completed) ? parsed.completed : Object.keys(parsed.completed)
        for (const item of comp) completedQuestIds.add(normalizeId(item))
      }
      if (Array.isArray(parsed.quests)) {
        for (const q of parsed.quests) {
          if (q?.id && (q.completed || q.done)) completedQuestIds.add(normalizeId(q.id))
        }
      }
    }
  } catch {}
  return completedQuestIds
}

export async function parseFtbQuests(
  savePath: string,
  instancePath: string,
  playerUuid?: string,
): Promise<InstanceProgressQuests | undefined> {
  try {
    let chaptersDir: string | undefined
    const possibleChapterDirs = [
      join(instancePath, 'config', 'ftbquests', 'quests', 'chapters'),
      join(instancePath, 'config', 'ftbquests', 'chapters'),
      join(savePath, 'ftbquests', 'quests', 'chapters'),
      join(savePath, 'ftbquests', 'chapters'),
      join(instancePath, 'config', 'ftbquests', 'normal', 'chapters'),
      join(instancePath, 'defaultconfigs', 'ftbquests', 'quests', 'chapters'),
      join(instancePath, 'defaultconfigs', 'ftbquests', 'chapters'),
      join(instancePath, 'kubejs', 'data', 'ftbquests', 'chapters'),
    ]

    for (const dir of possibleChapterDirs) {
      if (await exists(dir)) {
        chaptersDir = dir
        break
      }
    }

    if (!chaptersDir) return undefined

    const chapterFiles = await readdir(chaptersDir).catch(() => [] as string[])
    const snbtFiles = chapterFiles.filter(f => f.endsWith('.snbt'))
    if (snbtFiles.length === 0) return undefined

    // 1. Locate player progress first to calculate completion & locked state
    const playerProgressFile = await locateFtbPlayerFile(savePath, playerUuid)
    const completedQuestIds = playerProgressFile ? await readCompletedQuestIds(playerProgressFile) : new Set<string>()

    // 2. Parse chapters with quest coordinates, shapes, icons, and dependencies
    const chapters: InstanceProgressChapter[] = []
    let totalCompletedQuests = 0
    let totalAllQuests = 0

    for (const file of snbtFiles) {
      try {
        const raw = await readFile(join(chaptersDir, file), 'utf-8')
        const parsed = parseSnbt(raw)
        if (!parsed) continue

        const chapterId = normalizeId(parsed.id || file.replace(/\.snbt$/, ''))
        const rawChapterTitle = parsed.title || parsed.filename || file.replace(/\.snbt$/, '')
        const imgMatch = rawChapterTitle.match(/\{image:([^\s}]+)/i)
        const chapterIcon = extractCleanItemId(parsed.icon) || imgMatch?.[1]
        let chapterTitle = cleanTitle(rawChapterTitle)
        if (!chapterTitle || chapterTitle === parsed.filename || chapterTitle === file.replace(/\.snbt$/, '')) {
          chapterTitle = (parsed.filename || file.replace(/\.snbt$/, '')).replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        }
        const defaultShape = parsed.default_quest_shape || 'circle'
        const rawQuests = Array.isArray(parsed.quests) ? parsed.quests : []

        const questItems: InstanceProgressQuestItem[] = []
        let chCompleted = 0

        for (const q of rawQuests) {
          const qId = normalizeId(q?.id)
          if (!qId) continue

          const isDone = completedQuestIds.has(qId)
          if (isDone) chCompleted++

          // Extract dependencies
          const depsRaw = Array.isArray(q?.dependencies) ? q.dependencies : []
          const dependencies: string[] = depsRaw.map(normalizeId).filter((d: string | undefined): d is string => Boolean(d))

          // Check if locked (if any dependency is incomplete)
          let locked = false
          if (!isDone && dependencies.length > 0) {
            locked = dependencies.some((depId: string) => !completedQuestIds.has(depId))
          }

          // Extract icon
          let icon: string | undefined
          if (q?.icon) {
            icon = extractCleanItemId(q.icon)
          } else if (Array.isArray(q?.tasks)) {
            for (const t of q.tasks) {
              if (t?.icon) {
                icon = extractCleanItemId(t.icon)
                if (icon) break
              }
              if (t?.item) {
                icon = extractCleanItemId(t.item)
                if (icon) break
              }
            }
          }

          // Extract coordinates
          const x = typeof q?.x === 'number' ? q.x : (parseFloat(q?.x) || 0)
          const y = typeof q?.y === 'number' ? q.y : (parseFloat(q?.y) || 0)
          const size = typeof q?.size === 'number' ? q.size : 1
          const shape = q?.shape || defaultShape

          // Format description
          let description: string | undefined
          if (Array.isArray(q?.description)) {
            description = q.description.join('\n')
          } else if (typeof q?.description === 'string') {
            description = q.description
          }

          const tasksCount = Array.isArray(q?.tasks) ? q.tasks.length : 0

          questItems.push({
            id: qId,
            title: cleanTitle(q?.title) || qId,
            subtitle: cleanTitle(q?.subtitle),
            description,
            icon,
            x,
            y,
            size,
            shape,
            dependencies,
            done: isDone,
            locked,
            tasksCount,
            tasksCompleted: isDone ? tasksCount : 0,
          })
        }

        if (questItems.length > 0) {
          totalCompletedQuests += chCompleted
          totalAllQuests += questItems.length
          const percentage = questItems.length > 0 ? Math.round((chCompleted / questItems.length) * 100) : 0

          chapters.push({
            id: chapterId,
            title: chapterTitle,
            icon: chapterIcon,
            defaultShape,
            completedQuests: chCompleted,
            totalQuests: questItems.length,
            percentage,
            quests: questItems,
          })
        }
      } catch {}
    }

    if (totalAllQuests === 0) return undefined

    const overallPercentage = totalAllQuests > 0 ? Math.round((totalCompletedQuests / totalAllQuests) * 100) : 0

    return {
      modType: 'ftbquests',
      completedQuests: totalCompletedQuests,
      totalQuests: totalAllQuests,
      percentage: overallPercentage,
      chapters,
    }
  } catch {
    return undefined
  }
}

/**
 * Extract textures from local client jar or mod jars
 */
const localTextureCache = new Map<string, string>()

const NS_ALIASES: Record<string, string[]> = {
  ae2: ['appliedenergistics2', 'ae2'],
  appliedenergistics2: ['ae2', 'appliedenergistics2'],
  rs: ['refinedstorage'],
  refinedstorage: ['rs', 'refinedstorage'],
  ie: ['immersiveengineering', 'immersive_engineering'],
  immersiveengineering: ['ie', 'immersiveengineering', 'immersive_engineering'],
  tc: ['tconstruct', 'thaumcraft'],
  tconstruct: ['tc', 'tconstruct'],
  ftbq: ['ftbquests', 'ftb-quests', 'ftb_quests'],
  ftbquests: ['ftbquests', 'ftb-quests', 'ftb_quests'],
  ftbt: ['ftbteams', 'ftb-teams', 'ftb_teams'],
  ftblibrary: ['ftblibrary', 'ftb-library', 'ftb_library'],
  thermal: ['thermal_expansion', 'thermal_foundation', 'thermal'],
  refurbished_furniture: ['refurbished_furniture', 'furniture'],
  endrem: ['endrem', 'end_rem'],
}


async function resolveClientJarPath(instancePath: string, gameDataPath?: string): Promise<string | undefined> {
  if (!gameDataPath) return undefined
  try {
    const versionsDir = join(gameDataPath, 'versions')
    if (!await pathExists(versionsDir)) return undefined

    const instFile = join(instancePath, 'instance.json')
    if (await pathExists(instFile)) {
      const instJson = JSON.parse(await readFile(instFile, 'utf-8'))
      const ver = instJson?.runtime?.minecraft || instJson?.version
      if (ver) {
        const candidate = join(versionsDir, ver, `${ver}.jar`)
        if (await pathExists(candidate)) return candidate
      }
    }
    const dirs = await readdir(versionsDir).catch(() => [] as string[])
    for (const d of dirs.reverse()) {
      const jar = join(versionsDir, d, `${d}.jar`)
      if (await pathExists(jar)) return jar
    }
  } catch {}
  return undefined
}

function getTextureSubpaths(name: string): string[] {
  const clean = name.replace(/^\/+/, '').replace(/\.png$/i, '')
  if (name.includes('/') || name.endsWith('.png')) {
    return [name, `${clean}.png`, `textures/${clean}.png`, `textures/gui/${clean}.png`, `textures/gui/icons/${clean}.png`]
  }
  return [
    `textures/item/${clean}.png`,
    `textures/block/${clean}.png`,
    `textures/items/${clean}.png`,
    `textures/blocks/${clean}.png`,
    `textures/gui/${clean}.png`,
    `textures/gui/icons/${clean}.png`,
    `textures/${clean}.png`,
  ]
}

async function extractLocalTextures(
  itemIds: string[],
  instancePath: string,
  gameDataPath?: string,
  existingClientFs?: FileSystem,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  if (itemIds.length === 0) return result

  const missingIds: string[] = []
  for (const id of itemIds) {
    const cached = localTextureCache.get(id)
    if (cached !== undefined) {
      if (cached) result[id] = cached
    } else {
      missingIds.push(id)
    }
  }
  if (missingIds.length === 0) return result

  const openedFs: FileSystem[] = []

  try {
    let clientFs: FileSystem | undefined = existingClientFs
    if (!clientFs && gameDataPath) {
      const clientJarPath = await resolveClientJarPath(instancePath, gameDataPath)
      if (clientJarPath) {
        clientFs = await openFileSystem(clientJarPath).catch(() => undefined)
        if (clientFs) openedFs.push(clientFs)
      }
    }

    // Search local instance disk assets (KubeJS, openloader, resources, resourcepacks)
    const localAssetDirs: string[] = []
    const baseDirs = [
      join(instancePath, 'kubejs', 'assets'),
      join(instancePath, 'resources'),
      join(instancePath, 'config', 'openloader', 'resources'),
    ]
    for (const d of baseDirs) {
      if (await pathExists(d)) localAssetDirs.push(d)
    }

    const subPackDirs = [
      join(instancePath, 'resourcepacks'),
      join(instancePath, 'config', 'openloader', 'resources'),
    ]
    for (const dir of subPackDirs) {
      if (await pathExists(dir)) {
        const entries = await readdir(dir).catch(() => [] as string[])
        for (const entry of entries) {
          const candidate = join(dir, entry, 'assets')
          if (await pathExists(candidate)) localAssetDirs.push(candidate)
        }
      }
    }

    // Search instance mods directory for modded textures
    const modsDir = join(instancePath, 'mods')
    const modFiles = await readdir(modsDir).catch(() => [] as string[])
    const modJars = modFiles.filter(f => f.endsWith('.jar'))
    const jarPromiseMap = new Map<string, Promise<FileSystem | null>>()

    function getOrOpenJar(modJar: string): Promise<FileSystem | null> {
      let p = jarPromiseMap.get(modJar)
      if (!p) {
        p = openFileSystem(join(modsDir, modJar)).catch(() => null).then(fs => {
          if (fs) openedFs.push(fs)
          return fs
        })
        jarPromiseMap.set(modJar, p)
      }
      return p
    }

    const targetIds = missingIds.slice(0, 150)

    const extractionWork = Promise.all(targetIds.map(async (itemId) => {
      if (!itemId) return
      const cleanId = extractCleanItemId(itemId)

      const colonIdx = cleanId.indexOf(':')
      const ns = colonIdx !== -1 ? cleanId.substring(0, colonIdx) : 'minecraft'
      const name = colonIdx !== -1 ? cleanId.substring(colonIdx + 1) : cleanId

      let foundDataUrl: string | undefined

      // Check local disk folders first (fastest)
      for (const baseDir of localAssetDirs) {
        foundDataUrl = await readTextureFromDisk(baseDir, ns, name)
        if (foundDataUrl) break
      }

      if (!foundDataUrl && ns === 'minecraft' && clientFs) {
        foundDataUrl = await readTextureFromFs(clientFs, ns, name)
      } else if (!foundDataUrl) {
        const aliases = NS_ALIASES[ns.toLowerCase()] || [ns.toLowerCase()]
        const candidateJars = modJars.filter(j => {
          const jLower = j.toLowerCase()
          return aliases.some(a => jLower.includes(a))
        }).slice(0, 2)

        for (const modJar of candidateJars) {
          const fs = await getOrOpenJar(modJar)
          if (fs) {
            foundDataUrl = await readTextureFromFs(fs, ns, name)
            if (foundDataUrl) break
          }
        }

        if (!foundDataUrl && clientFs) {
          foundDataUrl = await readTextureFromFs(clientFs, 'minecraft', name)
        }
      }

      if (foundDataUrl) {
        result[itemId] = foundDataUrl
        result[cleanId] = foundDataUrl
        localTextureCache.set(itemId, foundDataUrl)
        localTextureCache.set(cleanId, foundDataUrl)
      } else {
        localTextureCache.set(itemId, '')
        localTextureCache.set(cleanId, '')
      }
    }))

    await Promise.race([
      extractionWork,
      new Promise(resolve => setTimeout(resolve, 3000)),
    ])
  } catch {
  } finally {
    for (const fs of openedFs) {
      try { fs.close() } catch {}
    }
  }

  return result
}

async function readTextureFromDisk(baseDir: string, ns: string, name: string): Promise<string | undefined> {
  for (const sub of getTextureSubpaths(name)) {
    try {
      const p = join(baseDir, ns, sub)
      if (await pathExists(p)) {
        const buf = await readFile(p)
        if (buf && buf.length > 0) return `data:image/png;base64,${buf.toString('base64')}`
      }
    } catch {}
  }

  // Fallback: check models/item and models/block
  const cleanName = name.replace(/^\/+/, '').replace(/\.png$/i, '')
  for (const sub of ['item', 'block']) {
    try {
      const mp = join(baseDir, ns, 'models', sub, `${cleanName}.json`)
      if (await pathExists(mp)) {
        const json = JSON.parse(await readFile(mp, 'utf-8'))
        const texRef = json?.textures?.layer0 || json?.textures?.particle || (json?.textures && Object.values(json.textures)[0])
        if (typeof texRef === 'string') {
          const colon = texRef.indexOf(':')
          const targetNs = colon !== -1 ? texRef.substring(0, colon) : ns
          const targetName = colon !== -1 ? texRef.substring(colon + 1) : texRef
          const res = await readTextureFromDisk(baseDir, targetNs, targetName)
          if (res) return res
        }
      }
    } catch {}
  }

  return undefined
}

async function readTextureFromFs(fs: FileSystem, ns: string, name: string): Promise<string | undefined> {
  for (const sub of getTextureSubpaths(name)) {
    try {
      const buf = await fs.readFileBuffered(`assets/${ns}/${sub}`)
      if (buf && buf.length > 0) return `data:image/png;base64,${Buffer.from(buf).toString('base64')}`
    } catch {}
  }
  return undefined
}

interface ProgressCacheEntry {
  savePath: string
  instancePath: string
  playerUuid?: string
  levelDatMtime: number
  advFile?: string
  advMtime: number
  statsFile?: string
  statsMtime: number
  questPlayerFile?: string
  questPlayerMtime: number
  data: InstanceSaveProgress
}

const progressBackendCache = new Map<string, ProgressCacheEntry>()
let cachedClientFs: { path: string; fs: FileSystem } | undefined

export async function readSaveProgress(
  savePath: string,
  instancePath: string,
  gameDataPath?: string,
  preferredPlayerUuid?: string,
): Promise<InstanceSaveProgress> {
  const saveName = basename(savePath)

  const levelDatPath = join(savePath, 'level.dat')
  let levelDatMtime = 0
  try {
    const s = await stat(levelDatPath).catch(() => undefined)
    if (s) levelDatMtime = s.mtimeMs
  } catch {}

  const advInfo = await findLatestFile(join(savePath, 'advancements'), preferredPlayerUuid)
  const statsInfo = await findLatestFile(join(savePath, 'stats'), preferredPlayerUuid || advInfo?.uuid)
  const playerUuid = advInfo?.uuid || statsInfo?.uuid || preferredPlayerUuid
  const questPlayerFile = await locateFtbPlayerFile(savePath, playerUuid)

  let advMtime = 0
  if (advInfo?.file) {
    try {
      const s = await stat(advInfo.file).catch(() => undefined)
      if (s) advMtime = s.mtimeMs
    } catch {}
  }

  let statsMtime = 0
  if (statsInfo?.file) {
    try {
      const s = await stat(statsInfo.file).catch(() => undefined)
      if (s) statsMtime = s.mtimeMs
    } catch {}
  }

  let questPlayerMtime = 0
  if (questPlayerFile) {
    try {
      const s = await stat(questPlayerFile).catch(() => undefined)
      if (s) questPlayerMtime = s.mtimeMs
    } catch {}
  }

  const cached = progressBackendCache.get(savePath)
  if (cached && cached.instancePath === instancePath && cached.playerUuid === playerUuid) {
    const isLevelUnchanged = cached.levelDatMtime === levelDatMtime
    const isAdvUnchanged = cached.advMtime === advMtime
    const isStatsUnchanged = cached.statsMtime === statsMtime
    const isQuestUnchanged = cached.questPlayerMtime === questPlayerMtime

    // 1. Fully unchanged -> return cached data immediately (< 0.1ms)
    if (isLevelUnchanged && isAdvUnchanged && isStatsUnchanged && isQuestUnchanged) {
      return cached.data
    }

    // 2. Incremental update when player progress changed (< 1ms)
    let canIncremental = true

    if (!isQuestUnchanged && cached.data.quests && questPlayerFile) {
      const newDoneIds = await readCompletedQuestIds(questPlayerFile)
      let totalCompleted = 0
      let totalAll = 0
      for (const ch of cached.data.quests.chapters) {
        let chCompleted = 0
        for (const q of ch.quests) {
          q.done = newDoneIds.has(q.id)
          if (q.done) chCompleted++
          if (!q.done && q.dependencies?.length) {
            q.locked = q.dependencies.some(d => !newDoneIds.has(d))
          } else {
            q.locked = false
          }
        }
        ch.completedQuests = chCompleted
        ch.percentage = ch.totalQuests > 0 ? Math.round((chCompleted / ch.totalQuests) * 100) : 0
        totalCompleted += chCompleted
        totalAll += ch.totalQuests
      }
      cached.data.quests.completedQuests = totalCompleted
      cached.data.quests.percentage = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0
      cached.questPlayerMtime = questPlayerMtime
    } else if (!isQuestUnchanged && !cached.data.quests && questPlayerFile) {
      canIncremental = false
    }

    if (!isAdvUnchanged && cached.data.advancements && advInfo?.file) {
      try {
        const content = await readFile(advInfo.file, 'utf-8')
        const json = JSON.parse(content)
        let completed = 0
        const categories: Record<string, number> = {}
        for (const adv of cached.data.advancements.items) {
          const d = json[adv.id]
          adv.done = Boolean(d?.done)
          if (adv.done) {
            completed++
            categories[adv.mod] = (categories[adv.mod] || 0) + 1
          }
        }
        cached.data.advancements.completed = completed
        cached.data.advancements.categories = categories
        cached.advMtime = advMtime
      } catch {
        canIncremental = false
      }
    }

    if (!isStatsUnchanged && statsInfo?.file) {
      cached.data.stats = await parseStats(statsInfo.file)
      cached.statsMtime = statsMtime
    }

    if (canIncremental) {
      cached.levelDatMtime = levelDatMtime
      cached.data.lastPlayed = levelDatMtime
      return cached.data
    }
  }

  // 1. Resolve client JAR for texture extraction
  let clientFs: FileSystem | undefined
  try {
    const clientJarPath = await resolveClientJarPath(instancePath, gameDataPath)
    if (clientJarPath) {
      if (cachedClientFs && cachedClientFs.path === clientJarPath) {
        clientFs = cachedClientFs.fs
      } else {
        try { cachedClientFs?.fs.close() } catch {}
        clientFs = await openFileSystem(clientJarPath).catch(() => undefined)
        if (clientFs) cachedClientFs = { path: clientJarPath, fs: clientFs }
      }
    }
  } catch {}

  const quests = await parseFtbQuests(savePath, instancePath, playerUuid)
  const isFtbPack = !!quests && quests.chapters.length > 0

  const advancements = await parseAdvancements(advInfo?.file, undefined, !isFtbPack)
  const stats = statsInfo ? await parseStats(statsInfo.file) : undefined

  // Collect item icons needed
  const iconItemIds = new Set<string>()
  if (quests) {
    for (const ch of quests.chapters) {
      if (ch.icon) iconItemIds.add(ch.icon)
      for (const q of ch.quests) {
        if (q.icon) iconItemIds.add(q.icon)
      }
    }
  }
  if (!isFtbPack) {
    for (const adv of advancements.items) {
      if (adv.icon) iconItemIds.add(adv.icon)
    }
  }

  let icons: Record<string, string> = {}
  try {
    // Extract textures locally from Minecraft JAR & mods
    icons = await extractLocalTextures(Array.from(iconItemIds), instancePath, gameDataPath, clientFs)
  } catch {}

  // Assign data URLs
  for (const adv of advancements.items) {
    if (adv.icon && icons[adv.icon]) {
      adv.iconDataUrl = icons[adv.icon]
    }
  }
  if (quests) {
    for (const ch of quests.chapters) {
      if (ch.icon && icons[ch.icon]) ch.iconDataUrl = icons[ch.icon]
      for (const q of ch.quests) {
        if (q.icon && icons[q.icon]) q.iconDataUrl = icons[q.icon]
      }
    }
  }

  const result: InstanceSaveProgress = {
    savePath,
    saveName,
    playerUuid,
    lastPlayed: levelDatMtime,
    advancements,
    quests,
    stats,
    icons,
  }

  progressBackendCache.set(savePath, {
    savePath,
    instancePath,
    playerUuid,
    levelDatMtime,
    advFile: advInfo?.file,
    advMtime,
    statsFile: statsInfo?.file,
    statsMtime,
    questPlayerFile,
    questPlayerMtime,
    data: result,
  })

  return result
}
