import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

let getUpgradePlanReleaseNote: typeof import('./modUpgrade').getUpgradePlanReleaseNote

beforeAll(async () => {
  vi.stubGlobal('window', {
    navigator: {
      platform: 'Linux',
    },
  })
  ;({ getUpgradePlanReleaseNote } = await import('./modUpgrade'))
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('getUpgradePlanReleaseNote', () => {
  test('builds curseforge release notes from the provider changelog', async () => {
    const getCurseforgeChangelog = vi.fn().mockResolvedValue('<p>Fixed a crash</p>')
    const note = await getUpgradePlanReleaseNote({
      file: {
        id: 2,
        displayName: 'Test Mod 1.1.0',
        fileName: 'test-mod-1.1.0.jar',
      } as any,
      mod: {
        name: 'Test Mod',
        fileName: 'test-mod-1.0.0.jar',
        version: '1.0.0',
        curseforge: {
          projectId: 42,
          fileId: 1,
        },
      } as any,
      updating: false,
      filePath: 'test-mod-1.0.0.jar',
    } as any, {
      renderMarkdown: vi.fn(),
      getCurseforgeChangelog,
    })

    expect(getCurseforgeChangelog).toHaveBeenCalledWith(42, 2)
    expect(note).toEqual({
      id: '42',
      source: 'curseforge',
      title: 'Test Mod',
      currentVersion: '1.0.0',
      targetVersion: 'Test Mod 1.1.0',
      html: '<p>Fixed a crash</p>',
    })
  })

  test('builds modrinth release notes from markdown changelog content', async () => {
    const renderMarkdown = vi.fn().mockReturnValue('<p>Added blocks</p>')
    const note = await getUpgradePlanReleaseNote({
      version: {
        id: 'ver-2',
        name: '2.0.0',
        version_number: '2.0.0',
        changelog: '## Added blocks',
      } as any,
      mod: {
        fileName: 'test-mod-1.0.0.jar',
        modrinth: {
          projectId: 'proj-1',
          versionId: 'ver-1',
        },
      } as any,
      updating: false,
      filePath: 'test-mod-1.0.0.jar',
    } as any, {
      renderMarkdown,
      getCurseforgeChangelog: vi.fn(),
    })

    expect(renderMarkdown).toHaveBeenCalledWith('## Added blocks')
    expect(note).toEqual({
      id: 'proj-1',
      source: 'modrinth',
      title: 'test-mod-1.0.0.jar',
      currentVersion: 'test-mod-1.0.0.jar',
      targetVersion: '2.0.0',
      html: '<p>Added blocks</p>',
    })
  })
})
