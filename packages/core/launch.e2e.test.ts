import { ChildProcess, spawnSync } from 'child_process'
import { EOL } from 'os'
import * as path from 'path'
import { describe, test } from 'vitest'
import { LaunchOption, launch, launchServer } from './launch'

function getJavaVersion(javaPath: string) {
  const { stderr } = spawnSync(javaPath, ['-version'], { encoding: 'utf8' })
  const line = stderr.split(EOL)[0]
  if (stderr.startsWith('java version')) {
    const parts = line.split(' ')[2].replace(/"/g, '').split('.')
    if (parts[0] === '1') {
      return Number.parseInt(parts[1].replace(/[^0-9]/g, ''), 10)
    } else {
      return Number.parseInt(parts[0].replace(/[^0-9]/g, ''), 10)
    }
  } else {
    return Number.parseInt(line.split(' ')[1].split('.')[0], 10)
  }
}

function waitGameProcess(process: ChildProcess, ...hints: string[]) {
  const found = new Array<boolean>(hints.length)
  found.fill(false)
  return new Promise<void>((resolve, reject) => {
    process.stdout!.on('data', (chunk) => {
      const content = chunk.toString()
      for (let i = 0; i < hints.length; i++) {
        if (content.indexOf(hints[i]) !== -1) {
          found[i] = true
        }
      }
      if (found.every((f) => f)) {
        process.kill('SIGINT')
      }
    })
    process.stderr!.on('data', (chunk) => {
      console.warn(chunk.toString())
    })
    process.on('exit', (code, signal) => {
      if (signal === 'SIGINT' || code === 130) {
        resolve()
      } else {
        // eslint-disable-next-line prefer-promise-reject-errors
        reject({ code, signal })
      }
    })
  })
}

describe('Launcher', () => {
  let javaPath: string
  let javaVersion: number

  // vi.setTimeout(10000000);

  if (process.env.JAVA_HOME) {
    javaPath = `${process.env.JAVA_HOME}/bin/java`
    try {
      javaVersion = getJavaVersion(javaPath)
    } catch {
      javaPath = ''
    }
  } else {
    javaPath = 'java'
    try {
      javaVersion = getJavaVersion(javaPath)
    } catch {
      javaPath = ''
    }
  }
  describe.skip('#launch', () => {
    describe.skipIf((javaVersion && javaVersion > 8) || !javaPath)('1.6.4', () => {
      test('should launch 1.6.4', async ({ temp }) => {
        const option: LaunchOption = { version: '1.6.4', gamePath: temp, javaPath }
        await waitGameProcess(await launch(option), 'OpenAL initialized.')
      })
    })
    describe.skipIf((javaVersion && javaVersion > 8) || !javaPath)('1.17.10', () => {
      test('should launch with forge', async ({ temp }) => {
        const option: LaunchOption = {
          version: '1.7.10-Forge10.13.3.1400-1.7.10',
          gamePath: temp,
          javaPath,
        }
        await waitGameProcess(await launch(option), 'OpenAL initialized.')
      })
    })

    describe.skipIf((javaVersion && javaVersion > 8) || !javaPath)('1.12.2', () => {
      test('should launch normal minecraft', async ({ temp }) => {
        const option: LaunchOption = { version: '1.12.2', gamePath: temp, javaPath }
        await waitGameProcess(
          await launch(option),
          '[Client thread/INFO]: Created: 1024x512 textures-atlas',
        )
      })
      test('should launch server', async ({ temp }) => {
        const option: LaunchOption = {
          version: '1.12.2',
          gamePath: temp,
          javaPath,
          server: {
            ip: '127.0.0.1',
            port: 25565,
          },
        }
        await waitGameProcess(
          await launch(option),
          '[Client thread/INFO]: Connecting to 127.0.0.1, 25565',
        )
      })
      test('should launch forge minecraft', async ({ temp }) => {
        const option: LaunchOption = {
          version: '1.12.2-forge1.12.2-14.23.5.2823',
          gamePath: temp,
          javaPath,
        }
        await waitGameProcess(await launch(option), '[main/INFO] [FML]:')
      })
      test('should launch liteloader minecraft', async ({ temp }) => {
        const option: LaunchOption = {
          version: '1.12.2-Liteloader1.12.2-1.12.2-SNAPSHOT',
          gamePath: temp,
          javaPath,
        }
        await waitGameProcess(await launch(option), 'LiteLoader begin POSTINIT')
      })
      test('should launch forge liteloader minecraft', async ({ temp }) => {
        const option: LaunchOption = {
          version: '1.12.2-forge1.12.2-14.23.5.2823-Liteloader1.12.2-1.12.2-SNAPSHOT',
          gamePath: temp,
          javaPath,
        }
        await waitGameProcess(
          await launch(option),
          'LiteLoader begin POSTINIT',
          '[main/INFO] [FML]:',
        )
      })
    })

    describe.skipIf(() => !javaPath)('1.14.4', () => {
      test('should launch normal minecraft', async ({ temp }) => {
        const option: LaunchOption = { version: '1.14.4', gamePath: temp, javaPath }
        await waitGameProcess(await launch(option), '[Client thread/INFO]: OpenAL initialized')
      })
    })
    describe.skipIf(() => !javaPath)('1.15.2', () => {
      test('should launch normal minecraft', async ({ temp }) => {
        const option: LaunchOption = { version: '1.15.2', gamePath: temp, javaPath }
        await waitGameProcess(await launch(option), 'OpenAL initialized.')
      })
    })
  })
  describe.skip('#launchServer', () => {
    test('should launch 1.12.2', async ({ temp }) => {
      const process = await launchServer({
        // version: '1.12.2',
        // path: temp,
        javaPath,
        // cwd: path.resolve('.'),
      })
      await waitGameProcess(
        process,
        'You need to agree to the EULA in order to run the server. Go to eula.txt for more info.',
      )
    })
  })
})
