import { spawn, ChildProcess } from 'child_process'

let rendererProcess: ChildProcess | null = null
let mainProcess: ChildProcess | null = null

function killAll() {
  rendererProcess?.kill()
  mainProcess?.kill()
  process.exit(0)
}

process.on('SIGINT', killAll)
process.on('SIGTERM', killAll)
process.on('exit', killAll)

async function startRenderer(): Promise<number> {
  return new Promise((resolve, reject) => {
    rendererProcess = spawn('pnpm', ['dev:renderer'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    })

    let port = 3000
    rendererProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      console.log(`[renderer] ${output.trim()}`)
      const match = output.match(/Local:\s+http:\/\/localhost:(\d+)/)
      if (match) {
        port = parseInt(match[1], 10)
        console.log(`[dev] Renderer ready on port ${port}`)
        resolve(port)
      }
    })

    rendererProcess.stderr?.on('data', (data) => {
      console.error(`[renderer] ${data.toString().trim()}`)
    })

    rendererProcess.on('error', (err) => {
      reject(err)
    })

    rendererProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[renderer] exited with code ${code}`)
      }
    })
  })
}

function startMain(port: number) {
  mainProcess = spawn('pnpm', ['dev:main'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, XMCL_DEV_PORT: String(port) },
  })

  mainProcess.on('exit', (code) => {
    console.log(`[main] exited with code ${code}`)
    killAll()
  })
}

async function main() {
  console.log('[dev] Starting renderer...')
  const port = await startRenderer()
  console.log(`[dev] Starting main process on port ${port}...`)
  startMain(port)
}

main().catch((err) => {
  console.error('[dev] Failed to start:', err)
  killAll()
})