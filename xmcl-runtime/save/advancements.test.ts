import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { mkdtemp, outputFile, outputJson, rm } from 'fs-extra'
import { ZipFile } from 'yazl'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { readSaveProgress } from './progress'
import { readAdvancementDefinitions, resolveProgressVersion, translateText } from './advancements'
import { toMcLang } from '../util/minecraftLang'
import { openFileSystem } from '@xmcl/system'

describe('versioned advancement resources', () => {
  let root: string
  let instance: string
  let save: string
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xmcl-advancements-'))
    instance = join(root, 'instance')
    save = join(instance, 'saves', 'world')
  })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })

  async function version(id: string, directory: string, translated: string) {
    await outputJson(join(root, 'versions', id, `${id}.json`), {
      id, mainClass: 'net.minecraft.client.main.Main', libraries: [], assets: id, assetIndex: { id },
    })
    const lang = { 'test.title': translated, 'test.description': `Description ${translated}` }
    const content = JSON.stringify(lang)
    const hash = createHash('sha1').update(content).digest('hex')
    await outputFile(join(root, 'assets', 'objects', hash.slice(0, 2), hash), content)
    await outputJson(join(root, 'assets', 'indexes', `${id}.json`), {
      objects: { 'minecraft/lang/fr_fr.json': { hash } },
    })
    const zip = new ZipFile()
    // Explicit directory entries must not cause recursive traversal of the same path.
    zip.addEmptyDirectory(`data/minecraft/${directory}/story/`)
    zip.addBuffer(Buffer.from(JSON.stringify({
      'test.title': `English ${id}`, 'test.description': `English description ${id}`,
    })), 'assets/minecraft/lang/en_us.json')
    for (const name of ['root', id]) {
      zip.addBuffer(Buffer.from(JSON.stringify({
        parent: name === 'root' ? undefined : 'minecraft:story/root',
        display: { title: { translate: 'test.title' }, description: { translate: 'test.description' }, frame: 'goal' },
        criteria: { first: {}, second: {} },
      })), `data/minecraft/${directory}/story/${name}.json`)
    }
    zip.addBuffer(Buffer.from(JSON.stringify({ criteria: { first: {} } })), `data/minecraft/${directory}/recipes/hidden.json`)
    const done = pipeline(zip.outputStream, createWriteStream(join(root, 'versions', id, `${id}.jar`)))
    zip.end()
    await done
  }

  test('uses the inherited game version and its language index, and refreshes locale/version/player data', async () => {
    await version('old', 'advancements', 'Ancien')
    await version('new', 'advancement', 'Nouveau')
    await outputJson(join(root, 'versions', 'modded', 'modded.json'), {
      id: 'modded', inheritsFrom: 'old', mainClass: 'modded.Main', libraries: [],
    })
    await outputJson(join(instance, 'instance.json'), { version: 'modded', runtime: { minecraft: 'old' } })
    await outputJson(join(save, 'advancements', 'player.json'), {
      'minecraft:story/root': { done: true, criteria: { first: 'date' } },
    })
    expect((await resolveProgressVersion(instance, root))?.clientJarPath).toBe(join(root, 'versions', 'old', 'old.jar'))
    const french = await readSaveProgress(save, instance, root, 'player', 'fr')
    expect(french.advancements?.items).toHaveLength(2)
    expect(french.advancements?.items.map(item => item.title)).toEqual(['Ancien', 'Ancien'])
    expect(french.advancements?.items[0]).toMatchObject({
      done: true, criteriaCompleted: 1, totalCriteria: 2, description: 'Description Ancien', frame: 'goal',
    })
    const english = await readSaveProgress(save, instance, root, 'player', 'en')
    expect(english.advancements?.items[0].title).toBe('English old')
    const unavailableLocale = await readSaveProgress(save, instance, root, 'player', 'ja-JP')
    expect(unavailableLocale.advancements?.items[0].title).toBe('English old')
    // Live instance state can change before the asynchronous instance.json write finishes.
    const liveVersion = await readSaveProgress(save, instance, root, 'player', 'fr', 'new')
    expect(liveVersion.advancements.items[0].title).toBe('Nouveau')

    await outputJson(join(instance, 'instance.json'), { runtime: { minecraft: 'new' } })
    const newer = await readSaveProgress(save, instance, root, 'player', 'fr')
    expect(newer.advancements?.items.map(item => item.title)).toEqual(['Nouveau', 'Nouveau'])
    expect(newer.advancements?.items.some(item => item.id.endsWith('/old'))).toBe(false)
    await outputJson(join(save, 'advancements', 'player.json'), {})
    const reset = await readSaveProgress(save, instance, root, 'player', 'fr')
    expect(reset.advancements?.completed).toBe(0)
    expect(reset.advancements?.items.every(item => !item.done && item.criteriaCompleted === 0)).toBe(true)
    expect(french.advancements?.items[0].title).toBe('Ancien')
    expect(french.advancements?.completed).toBe(1)
  })

  test('does not substitute unrelated installed versions when the selected client is unavailable', async () => {
    await version('unrelated', 'advancement', 'Unrelated')
    await outputJson(join(instance, 'instance.json'), { runtime: { minecraft: 'missing' } })
    await outputJson(join(save, 'advancements', 'player.json'), {
      'minecraft:story/earned': { done: true, criteria: {} },
    })
    const progress = await readSaveProgress(save, instance, root)
    expect(progress.advancements?.items).toHaveLength(1)
    expect(progress.advancements?.items[0]).toMatchObject({ id: 'minecraft:story/earned', done: true })
    expect(progress.advancements?.items[0].title).toBeUndefined()
  })

  test('reads legacy assets advancements and lang files from the matching index', async () => {
    const pack = join(root, 'legacy-client')
    await outputJson(join(pack, 'assets', 'minecraft', 'advancements', 'story', 'root.json'), {
      display: { title: { translate: 'test.title' }, description: { translate: 'test.description' } },
    })
    await outputFile(join(pack, 'assets', 'minecraft', 'lang', 'en_us.lang'), '# comment\ntest.title=English\ntest.description=English detail\n')
    const content = 'test.title=Ancien\ntest.description=Ancien détail\n'
    const hash = createHash('sha1').update(content).digest('hex')
    await outputFile(join(root, 'assets', 'objects', hash.slice(0, 2), hash), content)
    await outputJson(join(root, 'assets', 'indexes', 'legacy.json'), { objects: { 'minecraft/lang/fr_fr.lang': { hash } } })
    const fs = await openFileSystem(pack)
    try {
      const definitions = await readAdvancementDefinitions(fs, 'fr', root, 'legacy')
      expect(definitions['minecraft:story/root']).toMatchObject({ title: 'Ancien', description: 'Ancien détail' })
    } finally {
      fs.close()
    }
  })

  test('localizes nested text, numbered parameters, literal suffixes and fallback text', () => {
    expect(translateText({
      translate: 'test',
      with: [{ translate: 'name' }, { text: 'second' }],
      extra: [{ text: '!' }],
    }, { test: '%2$s / %1$s / %%', name: 'localized' })).toBe('second / localized / %!')
    expect(translateText([{ translate: 'missing', fallback: 'Fallback' }, ' text'], {})).toBe('Fallback text')
    expect(toMcLang('zh-CN')).toBe('zh_cn')
    expect(toMcLang('ar-EG')).toBe('ar_sa')
    expect(toMcLang('en-IN')).toBe('en_us')
  })
})
