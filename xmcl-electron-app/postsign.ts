import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'

const files = readdirSync('./build/output')
const toUpdate = files.filter((file) => file.endsWith('.appx') || file.endsWith('.zip'))

for (const file of toUpdate) {
  const hash = createHash('sha256')
  const content = readFileSync(`./build/output/${file}`)
  hash.update(content)
  const digest = hash.digest('hex')
  const sha256File = `./build/output/${file}.sha256`
  writeFileSync(sha256File, digest)
  console.log(`Wrote sha256 hash to ${file} -> ${sha256File} = ${digest}`)
}
