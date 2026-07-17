import { MinecraftFolder } from '@xmcl/core'
import { copyFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { expect, test } from 'vitest'
import { installMinecraft } from './minecraft'

test('can resolve the version JSON without installing the jar', async ({ temp }) => {
  const id = '1.17.1'
  const folder = MinecraftFolder.from(temp)
  await mkdir(folder.getVersionRoot(id), { recursive: true })
  await copyFile(
    new URL('../../mock/versions/1.17.1/1.17.1.json', import.meta.url),
    folder.getVersionJson(id),
  )

  const resolved = await installMinecraft(
    { id, url: 'https://invalid.invalid/version.json' },
    folder,
    { installJar: false },
  )

  expect(resolved.id).toBe(id)
  expect(existsSync(folder.getVersionJar(id))).toBe(false)
})