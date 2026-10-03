import { open, readAllEntries } from '@xmcl/unzip'
import { ZipFile } from 'yazl'
import { describe, expect, it } from 'vitest'
import { createTechnicHandler } from './technicHandler'
import { getArchiveFiles } from './archiveFiles'

async function archive(files: Record<string, string>) {
  const writer = new ZipFile()
  for (const [name, value] of Object.entries(files)) writer.addBuffer(Buffer.from(value), name)
  writer.end()
  const chunks: Buffer[] = []
  for await (const chunk of writer.outputStream) chunks.push(Buffer.from(chunk))
  const zip = await open(Buffer.concat(chunks))
  return { zip, entries: await readAllEntries(zip) }
}
const handler = createTechnicHandler()

describe('Technic and overrides archives', () => {
  it.each<Record<string, string>>([
    { 'config/settings.cfg': 'configuration' },
    { 'mods/example-1.20.1-2.0.jar': 'unrelated mod version' },
  ])('does not invent Minecraft/Forge metadata for an unrecognized archive', async (files) => {
    const { zip, entries } = await archive(files)
    try { expect(await handler.readManifest(zip, entries)).toBeUndefined() } finally { zip.close() }
  })

  it.each([
    { id: '1.12.2-forge-14.23.5.2860', minecraft: '1.12.2', forge: '14.23.5.2860' },
    { id: 'fabric-loader-0.16.0-1.20.4', inheritsFrom: '1.20.4', minecraft: '1.20.4', fabricLoader: '0.16.0' },
  ])('reads declared loader metadata ($id)', async ({ minecraft, forge, fabricLoader, ...version }) => {
    const { zip, entries } = await archive({ 'bin/version.json': JSON.stringify(version), 'mods/test.jar': 'mod' })
    try {
      expect(await handler.readManifest(zip, entries)).toMatchObject({ minecraft, forge, fabricLoader })
    } finally { zip.close() }
  })

  it('does not invent Forge for a declared vanilla runtime', async () => {
    const { zip, entries } = await archive({ 'bin/version.json': '{"id":"1.20.1"}', 'config/settings.cfg': 'config' })
    try {
      expect(await handler.readManifest(zip, entries)).toMatchObject({ minecraft: '1.20.1', forge: undefined })
    } finally { zip.close() }
  })

  it('preserves override paths, CRCs and encoded ZIP entries without a manifest', async () => {
    const { zip, entries } = await archive({ 'config/a b.cfg': 'config', 'options.txt': 'options' })
    try {
      const files = getArchiveFiles('C:\\cache\\Configs.zip', entries)
      expect(files.map(file => file.path)).toEqual(['config/a b.cfg', 'options.txt'])
      expect(files[0]).toMatchObject({
        hashes: { crc32: entries[0].crc32.toString() },
        size: 6,
        downloads: ['zip:///C:\\cache\\Configs.zip?entry=config%2Fa%20b.cfg'],
      })
    } finally { zip.close() }
  })
})
