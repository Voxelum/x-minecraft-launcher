import { expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createLinkWin32, removeShortcut } from './index'

it('installs and removes third-party Vardrynn UI shortcuts without taking over XMCL shortcuts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vardrynn-shortcuts-'))
  const manifest = { name: 'Custom UI', url: 'https://ui.example/', iconSets: { icon: 'icon.png' } } as any
  try {
    await writeFile(join(directory, 'Custom UI.url'), 'xmcl://launcher/app?url=https://ui.example/')
    await writeFile(join(directory, 'Custom UI.lnk'), 'XMCL shortcut')
    await createLinkWin32({} as any, 'vardrynn.exe', directory, manifest, true)
    expect(await readFile(join(directory, 'Custom UI - Vardrynn.url'), 'utf8'))
      .toContain('URL=vardrynn://launcher/app?url=https://ui.example/')
    await removeShortcut(directory, manifest)
    expect((await readdir(directory)).sort()).toEqual(['Custom UI.lnk', 'Custom UI.url'])
    expect(await readFile(join(directory, 'Custom UI.url'), 'utf8')).toContain('xmcl://')
    expect(await readFile(join(directory, 'Custom UI.lnk'), 'utf8')).toBe('XMCL shortcut')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
