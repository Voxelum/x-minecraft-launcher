import { describe, expect, test } from 'vitest'
import { cleanTitle, parseAdvancements, parseStats, parseFtbQuests, readCompletedQuestIds, readSaveProgress } from './progress'
import { join } from 'path'
import { ensureDir, writeFile, rm } from 'fs-extra'
import { tmpdir } from 'os'

describe('progress parser', () => {
  test('removes Minecraft formatting codes without changing quest title text', () => {
    expect(cleanTitle('\u00a7aGreen \u00a7LBold\u00a7r &6Gold')).toBe('Green Bold Gold')
    expect(cleanTitle('\u00a7zLiteral')).toBe('\u00a7zLiteral')
    expect(cleanTitle(undefined)).toBe('')
  })

  test('parseAdvancements correctly processes vanilla and modded criteria', async () => {
    const testDir = join(tmpdir(), 'xmcl-test-adv-' + Date.now())
    await ensureDir(testDir)
    const advFile = join(testDir, 'player.json')

    const data = {
      'minecraft:story/root': {
        criteria: {
          crafting_table: '2023-01-01 12:00:00 +0000',
        },
        done: true,
      },
      'minecraft:story/mine_stone': {
        criteria: {
          get_stone: '2023-01-01 12:05:00 +0000',
        },
        done: true,
      },
      'create:root': {
        criteria: {
          wrench: '2023-01-01 12:10:00 +0000',
        },
        done: true,
      },
      'minecraft:nether/root': {
        criteria: {},
        done: false,
      },
      DataVersion: 3465,
    }

    await writeFile(advFile, JSON.stringify(data), 'utf-8')

    const result = await parseAdvancements(advFile)
    expect(result.completed).toBe(3)
    expect(result.categories['minecraft']).toBe(2)
    expect(result.categories['create']).toBe(1)
    expect(result.items).toHaveLength(4)
    expect(result.items[0].done).toBe(true)

    const definitions = {
      'minecraft:husbandry/plant_seed': {
        title: 'Seed fixture', description: 'Plant fixture', icon: '', frame: 'task' as const, totalCriteria: 2,
      },
    }
    const fullResult = await parseAdvancements(advFile, definitions, true)
    expect(fullResult.completed).toBe(3)
    expect(fullResult.items).toHaveLength(5)
    const unearned = fullResult.items.find(i => i.id === 'minecraft:husbandry/plant_seed')
    expect(unearned).toBeDefined()
    expect(unearned?.done).toBe(false)
    expect(unearned?.title).toBe('Seed fixture')
    expect(unearned?.totalCriteria).toBe(2)
    expect((await parseAdvancements(undefined, undefined, true)).items).toEqual([])

    await rm(testDir, { recursive: true, force: true })
  })

  test('keeps distinct hex/string and long quest IDs through completion and dependencies', async () => {
    const baseDir = join(tmpdir(), 'xmcl-ftb-ids-' + Date.now())
    const chaptersDir = join(baseDir, 'config', 'ftbquests', 'quests', 'chapters')
    const playersDir = join(baseDir, 'ftbquests', 'players')
    await ensureDir(chaptersDir)
    await ensureDir(playersDir)
    try {
      await writeFile(join(chaptersDir, 'ids.snbt'), `{
        id: "001F"
        quests: [
          { id: "0001" }
          { id: "001B" dependencies: ["0001"] }
          { id: "001D" dependencies: ["001B"] }
          { id: "001F" dependencies: ["001D"] }
          { id: 9007199254740992L }
          { id: 9007199254740993L dependencies: [9007199254740992L] }
          { id: "word" dependencies: ["0001"] }
        ]
      }`)
      await writeFile(join(playersDir, 'player.snbt'), '{ completed: ["0001", "001B", 9007199254740992L] }')
      const result = await parseFtbQuests(baseDir, baseDir, 'player')
      expect(result?.chapters[0].id).toBe('001F')
      expect(result?.completedQuests).toBe(3)
      expect(result?.totalQuests).toBe(7)
      const quests = result!.chapters[0].quests
      expect(quests.map(q => q.id)).toEqual(['0001', '001B', '001D', '001F', '9007199254740992', '9007199254740993', 'word'])
      expect(quests.map(q => q.done)).toEqual([true, true, false, false, true, false, false])
      expect(quests.map(q => q.locked)).toEqual([false, false, false, true, false, false, false])
      expect(quests[3].dependencies).toEqual(['001D'])
      expect(quests[5].dependencies).toEqual(['9007199254740992'])

      await writeFile(join(playersDir, 'player.snbt'), '{ completed: { "001D": 1L } }')
      const refreshed = await readSaveProgress(baseDir, baseDir, undefined, 'player')
      expect(refreshed.quests?.completedQuests).toBe(1)
      expect(refreshed.quests?.chapters[0].quests[3].locked).toBe(false)
    } finally {
      await rm(baseDir, { recursive: true, force: true })
    }
  })

  test('propagates malformed quest files rather than reporting empty or stale progress', async () => {
    const baseDir = join(tmpdir(), 'xmcl-ftb-errors-' + Date.now())
    const chaptersDir = join(baseDir, 'config', 'ftbquests', 'quests', 'chapters')
    const playersDir = join(baseDir, 'ftbquests', 'players')
    await ensureDir(chaptersDir)
    await ensureDir(playersDir)
    try {
      const chapter = join(chaptersDir, 'broken.snbt')
      const player = join(playersDir, 'player.snbt')
      await writeFile(chapter, '{ id: "chapter" quests: [{ id: "001B" }] }')
      await writeFile(player, '{ completed: { "001B": 1L } }')
      expect((await readSaveProgress(baseDir, baseDir)).quests?.completedQuests).toBe(1)
      await writeFile(player, '{ completed: [')
      await expect(readCompletedQuestIds(player)).rejects.toThrow(/player\.snbt.*SyntaxError.*position/)
      await expect(readSaveProgress(baseDir, baseDir)).rejects.toThrow(/SyntaxError.*position/)
      await writeFile(player, '{}')
      await writeFile(chapter, '{ id: ')
      await expect(parseFtbQuests(baseDir, baseDir)).rejects.toThrow(/broken\.snbt.*SyntaxError.*position/)
    } finally {
      await rm(baseDir, { recursive: true, force: true })
    }
  })

  test('parseStats parses both modern and legacy stat keys', async () => {
    const testDir = join(tmpdir(), 'xmcl-test-stats-' + Date.now())
    await ensureDir(testDir)
    const statsFile = join(testDir, 'player.json')

    const data = {
      stats: {
        'minecraft:custom': {
          'minecraft:play_time': 72000, // 1 hour (72000 ticks)
          'minecraft:deaths': 3,
          'minecraft:mob_kills': 15,
          'minecraft:jump': 250,
        },
        'minecraft:mined': {
          'minecraft:stone': 120,
          'minecraft:iron_ore': 15,
        },
      },
      DataVersion: 3465,
    }

    await writeFile(statsFile, JSON.stringify(data), 'utf-8')

    const result = await parseStats(statsFile)
    expect(result).toBeDefined()
    expect(result?.playTimeTicks).toBe(72000)
    expect(result?.deaths).toBe(3)
    expect(result?.mobKills).toBe(15)
    expect(result?.jump).toBe(250)
    expect(result?.minedBlocksTotal).toBe(135)

    await rm(testDir, { recursive: true, force: true })
  })

  test('parseFtbQuests computes chapters and completion percentages', async () => {
    const baseDir = join(tmpdir(), 'xmcl-test-ftb-' + Date.now())
    const instanceDir = join(baseDir, 'instance')
    const saveDir = join(baseDir, 'save')

    const chaptersDir = join(instanceDir, 'config', 'ftbquests', 'quests', 'chapters')
    const playerDir = join(saveDir, 'ftbquests', 'players')

    await ensureDir(chaptersDir)
    await ensureDir(playerDir)

    // Create 2 chapters
    const chapter1 = `{
      id: "ch1"
      title: "Chapter One"
      quests: [
        { id: "q1", title: "Quest 1" }
        { id: "q2", title: "Quest 2" }
      ]
    }`
    const chapter2 = `{
      id: "ch2"
      title: "Chapter Two"
      quests: [
        { id: "q3", title: "Quest 3" }
        { id: "q4", title: "Quest 4" }
      ]
    }`

    await writeFile(join(chaptersDir, 'ch1.snbt'), chapter1, 'utf-8')
    await writeFile(join(chaptersDir, 'ch2.snbt'), chapter2, 'utf-8')

    // Player completed q1 and q2 (100% of ch1) and q3 (50% of ch2) => 3/4 = 75%
    const playerProgress = `{
      uuid: "test-uuid"
      completed: {
        "q1": 1690000000000L
        "q2": 1690000001000L
        "q3": 1690000002000L
      }
    }`
    await writeFile(join(playerDir, 'test-uuid.snbt'), playerProgress, 'utf-8')

    const result = await parseFtbQuests(saveDir, instanceDir, 'test-uuid')
    expect(result).toBeDefined()
    expect(result?.completedQuests).toBe(3)
    expect(result?.totalQuests).toBe(4)
    expect(result?.percentage).toBe(75)
    expect(result?.chapters).toHaveLength(2)

    const ch1 = result?.chapters.find(c => c.id === 'ch1')
    expect(ch1?.completedQuests).toBe(2)
    expect(ch1?.totalQuests).toBe(2)
    expect(ch1?.percentage).toBe(100)
    expect(ch1?.quests).toHaveLength(2)
    expect(ch1?.quests[0].id).toBe('q1')
    expect(ch1?.quests[0].done).toBe(true)

    const ch2 = result?.chapters.find(c => c.id === 'ch2')
    expect(ch2?.completedQuests).toBe(1)
    expect(ch2?.totalQuests).toBe(2)
    expect(ch2?.percentage).toBe(50)
    expect(ch2?.quests).toHaveLength(2)

    await rm(baseDir, { recursive: true, force: true })
  })

  test('parseFtbQuests preserves coordinates, gear shape, dependencies, and calculates locked status', async () => {
    const baseDir = join(tmpdir(), 'xmcl-test-ftb-graph-' + Date.now())
    const instanceDir = join(baseDir, 'instance')
    const saveDir = join(baseDir, 'save')

    const chaptersDir = join(instanceDir, 'config', 'ftbquests', 'quests', 'chapters')
    const playerDir = join(saveDir, 'ftbquests', 'players')

    await ensureDir(chaptersDir)
    await ensureDir(playerDir)

    const chapterWithGraph = `{
      id: "graph_ch"
      title: "Technology"
      default_quest_shape: "circle"
      quests: [
        {
          id: "smeltery"
          title: "Smeltery Controller"
          shape: "gear"
          x: 0.0d
          y: -2.0d
          icon: "tconstruct:smeltery_controller"
        }
        {
          id: "casting"
          title: "Casting Table"
          shape: "square"
          x: 0.0d
          y: 0.0d
          dependencies: ["smeltery"]
        }
        {
          id: "basin"
          title: "Casting Basin"
          shape: "gear"
          x: 2.0d
          y: 2.0d
          dependencies: ["casting"]
        }
      ]
    }`

    await writeFile(join(chaptersDir, 'tech.snbt'), chapterWithGraph, 'utf-8')

    // Player only completed smeltery, not casting
    const playerProgress = `{
      uuid: "p-uuid"
      completed: {
        "smeltery": 1690000000000L
      }
    }`
    await writeFile(join(playerDir, 'p-uuid.snbt'), playerProgress, 'utf-8')

    const result = await parseFtbQuests(saveDir, instanceDir, 'p-uuid')
    expect(result).toBeDefined()
    const ch = result?.chapters[0]
    expect(ch).toBeDefined()
    expect(ch?.quests).toHaveLength(3)

    const smeltery = ch?.quests.find(q => q.id === 'smeltery')
    expect(smeltery?.shape).toBe('gear')
    expect(smeltery?.x).toBe(0)
    expect(smeltery?.y).toBe(-2)
    expect(smeltery?.done).toBe(true)
    expect(smeltery?.locked).toBe(false)

    const casting = ch?.quests.find(q => q.id === 'casting')
    expect(casting?.shape).toBe('square')
    expect(casting?.x).toBe(0)
    expect(casting?.y).toBe(0)
    expect(casting?.done).toBe(false)
    // smeltery is completed, so casting is unlocked!
    expect(casting?.locked).toBe(false)

    const basin = ch?.quests.find(q => q.id === 'basin')
    expect(basin?.shape).toBe('gear')
    expect(basin?.x).toBe(2)
    expect(basin?.y).toBe(2)
    expect(basin?.done).toBe(false)
    // casting is NOT completed, so basin is LOCKED!
    expect(basin?.locked).toBe(true)

    await rm(baseDir, { recursive: true, force: true })
  })
})
