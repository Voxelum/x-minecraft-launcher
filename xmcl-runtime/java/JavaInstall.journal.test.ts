import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import { readJavaReplacementJournal } from './javaReplacementJournal'

const inspectJava = vi.hoisted(() => vi.fn())
vi.mock('@xmcl/installer', () => ({
  createJavaArchiveInstallWorkflow: (options: { destination: string }) => options,
  createJavaRuntimeManifestInstallWorkflow: vi.fn(),
  runInstallWorkflow: (workflow: unknown, install: (plan: unknown) => Promise<void>) => install(workflow),
  onDownloadMultiple: vi.fn(),
  resolveJava: inspectJava,
}))
vi.mock('~/util/taskHelper', () => ({ getTracker: vi.fn() }))

import { installJavaRuntime } from './JavaInstall'

beforeEach(() => {
  inspectJava.mockReset().mockImplementation(async (path: string) => ({ path, version: '17.0.2', majorVersion: 17 }))
})

it.each([
  { layout: 'rooted', collision: false, fresh: false, os: 'linux', expected: 'bin/java' },
  { layout: 'wrapped', collision: false, fresh: false, os: 'linux', expected: 'bin/java' },
  { layout: 'wrapped', collision: false, fresh: true, os: 'linux', expected: 'bin/java' },
  { layout: 'wrapped', collision: true, fresh: false, os: 'linux', expected: 'bin/java' },
  { layout: 'multiple', collision: false, fresh: false, os: 'linux', expected: 'jdk/bin/java' },
  { layout: 'mac', collision: false, fresh: false, os: 'osx', expected: 'Contents/Home/bin/java' },
  { layout: 'wrapped', collision: false, fresh: false, os: 'windows', expected: 'bin/java.exe' },
])('installs $layout layout with collision=$collision and fresh=$fresh', async ({ layout, collision, fresh, os, expected }) => {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-java-activation-'))
  const jre = join(root, 'jre')
  const old = join(jre, collision ? 'temurin17.0.2+1' : 'old')
  const metadata = {
    runtimes: [{
      name: 'temurin17.0.2+1', vendor: 'eclipse', runtimeOS: `${os === 'osx' ? 'mac-os' : os}-x64`,
      downloadType: 'archive', url: 'https://example.test/java.tar.gz',
      checksum: { type: 'sha256', hash: '1234' },
    }],
  }
  const app = {
    platform: { os, arch: 'x64' },
    fetch: async () => new Response(JSON.stringify(metadata)),
    mutex: { of: () => ({ runExclusive: (action: () => Promise<unknown>) => action() }) },
  }
  const installer = {
    async install(plan: { destination: string }) {
      const javaHome = layout === 'rooted' ? plan.destination
        : join(plan.destination, 'jdk', ...(layout === 'mac' ? ['Contents', 'Home'] : []))
      await mkdir(join(javaHome, 'bin'), { recursive: true })
      await mkdir(join(javaHome, 'lib'))
      await writeFile(join(javaHome, 'bin', os === 'windows' ? 'java.exe' : 'java'), 'fake')
      await writeFile(join(javaHome, 'lib', 'runtime'), 'library')
      if (process.platform !== 'win32') {
        await symlink('../lib/runtime', join(javaHome, 'bin', 'runtime-link'))
      }
      if (layout === 'multiple') await writeFile(join(plan.destination, 'NOTICE'), 'keep')
    },
  }
  try {
    await mkdir(old, { recursive: true })
    await writeFile(join(old, 'preserved'), 'old')
    const result = await installJavaRuntime(
      app as never, ((...parts: string[]) => join(root, ...parts)) as never,
      installer as never, { controller: new AbortController() } as never,
      'net.adoptium.java', 'java17', 17,
      async (path) => {
        const directory = join(jre, relative(jre, path).split(sep)[0])
        if (fresh) {
          expect(await readJavaReplacementJournal(directory, jre, false)).toBeUndefined()
        } else {
          expect(await readJavaReplacementJournal(directory, jre, false)).toMatchObject({
            path, replacesJava: join(old, 'bin', 'java'), replacementRuntime: old,
            isInternal: true, installVendor: 'net.adoptium.java',
            replacementIdentity: expect.any(String),
          })
        }

        return { path, version: '17.0.2', majorVersion: 17 }
      },
      undefined, undefined, fresh ? undefined : { javaPath: join(old, 'bin', 'java'), runtimePath: old },
    )
    if (collision) {
      expect(result.path).toMatch(/temurin17\.0\.2\+1-xmcl-[0-9a-f]{32}[/\\]bin[/\\]java$/)
    } else {
      expect(result.path).toBe(join(jre, 'temurin17.0.2+1', ...expected.split('/')))
    }
    if (layout === 'multiple') expect(await readFile(join(jre, 'temurin17.0.2+1', 'NOTICE'), 'utf8')).toBe('keep')
    if (process.platform !== 'win32') {
      expect(await readFile(join(result.path, '..', 'runtime-link'), 'utf8')).toBe('library')
    }
    expect(await readFile(join(old, 'preserved'), 'utf8')).toBe('old')
    if (!fresh) expect(result.replacementIdentity).toEqual(expect.any(String))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each(['staging', 'activation'])('rejects a wrong Java major version during %s without replacing the old runtime', async (step) => {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-java-major-'))
  const jre = join(root, 'jre')
  const old = join(jre, 'old')
  const app = {
    platform: { os: 'linux', arch: 'x64' },
    fetch: async () => new Response(JSON.stringify({ runtimes: [{
      name: 'temurin17.0.2+1', vendor: 'eclipse', runtimeOS: 'linux-x64',
      downloadType: 'archive', url: 'https://example.test/java.tar.gz',
      checksum: { type: 'sha256', hash: '1234' },
    }] })),
    mutex: { of: () => ({ runExclusive: (action: () => Promise<unknown>) => action() }) },
  }
  const installer = {
    async install(plan: { destination: string }) {
      await mkdir(join(plan.destination, 'bin'), { recursive: true })
      await writeFile(join(plan.destination, 'bin', 'java'), 'new')
    },
  }
  const activate = vi.fn(async (path: string) => ({
    path, version: step === 'activation' ? '21' : '17', majorVersion: step === 'activation' ? 21 : 17,
  }))
  try {
    await mkdir(old, { recursive: true })
    await writeFile(join(old, 'preserved'), 'old')
    if (step === 'staging') inspectJava.mockResolvedValueOnce({ path: '/staged/java', version: '21', majorVersion: 21 })
    await expect(installJavaRuntime(
      app as never, ((...parts: string[]) => join(root, ...parts)) as never,
      installer as never, { controller: new AbortController() } as never,
      'net.adoptium.java', 'java17', 17, activate,
      undefined, undefined, { javaPath: join(old, 'bin', 'java'), runtimePath: old },
    )).rejects.toThrow('Expected Java 17')
    expect(await readFile(join(old, 'preserved'), 'utf8')).toBe('old')
    expect(await readdir(jre)).toEqual(['old'])
    if (step === 'staging') expect(activate).not.toHaveBeenCalled()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
