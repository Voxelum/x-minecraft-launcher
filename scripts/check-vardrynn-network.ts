import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { auditBundle, auditNetworkLog, auditUndiciLog } from './vardrynnNetworkAudit'

async function bundleFiles(path: string): Promise<string[]> {
  if (/\.(js|html)$/.test(path)) return [path]
  const entries = await readdir(path, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? bundleFiles(join(path, entry.name))
    : /\.(js|html)$/.test(entry.name) ? [join(path, entry.name)] : []))).flat()
}

async function main() {
  const args = process.argv.slice(2)
  if (!args.length || args.length % 2) throw new Error('Usage: tsx scripts/check-vardrynn-network.ts --bundle <file-or-directory> [--net-log <capture.json>] [--undici-log <undici.log>]')
  let violations = 0
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--bundle') {
      const files = await bundleFiles(args[i + 1])
      if (!files.length) throw new Error(`No JavaScript or HTML artifacts found in ${args[i + 1]}`)
      for (const file of files) {
        const found = auditBundle(await readFile(file, 'utf8'))
        for (const url of found) console.error(`${file}: forbidden destination ${url}`)
        violations += found.length
      }
      console.log(`Audited ${files.length} build artifacts in ${args[i + 1]}`)
    } else if (args[i] === '--net-log') {
      const log = JSON.parse(await readFile(args[i + 1], 'utf8'))
      const found = auditNetworkLog(log)
      for (const origin of found) console.error(`Captured upstream traffic: ${origin}`)
      violations += found.length
      console.log(`Audited ${log.events.length} Chromium network events`)
    } else if (args[i] === '--undici-log') {
      const source = await readFile(args[i + 1], 'utf8')
      const found = auditUndiciLog(source)
      for (const origin of found) console.error(`Captured upstream Undici traffic: ${origin}`)
      violations += found.length
      console.log(`Audited ${[...source.matchAll(/client:sendHeaders\s/g)].length} Undici request headers`)
    } else {
      throw new Error(`Unknown option ${args[i]}`)
    }
  }
  if (violations) throw new Error(`Vardrynn network audit failed: ${violations} violations`)
  console.log('Vardrynn network audit passed')
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
