import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildReleaseManifest, generateReleaseKeyPair } from './vardrynnRelease'

const usage = `Usage:
  tsx scripts/vardrynn-release.ts keygen
  tsx scripts/vardrynn-release.ts manifest --version <x.y.z> --channel <name> --dir <packages> \\
      --download-base <https url> --notes-url <https url> --out <release.json>
Environment for manifest: VARDRYNN_RELEASE_SIGNING_KEY (base64 PKCS#8), VARDRYNN_RELEASE_PUBLIC_KEY (base64 raw).`

function option(args: string[], name: string) {
  const i = args.indexOf(`--${name}`)
  if (i < 0 || !args[i + 1]) throw new Error(`Missing --${name}\n${usage}`)
  return args[i + 1]
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'keygen') {
    const { publicKey, privateKey } = generateReleaseKeyPair()
    // The private key is printed once and never written to disk by this tool.
    console.log(`VARDRYNN_RELEASE_PUBLIC_KEY=${publicKey}`)
    console.log(`VARDRYNN_RELEASE_SIGNING_KEY=${privateKey}`)
  } else if (command === 'manifest') {
    const signingKey = process.env.VARDRYNN_RELEASE_SIGNING_KEY
    const publicKey = process.env.VARDRYNN_RELEASE_PUBLIC_KEY
    if (!signingKey || !publicKey) throw new Error(`Both signing environment variables are required\n${usage}`)
    const dir = option(args, 'dir')
    const files = await Promise.all((await readdir(dir)).map(async (name) => ({ name, bytes: await readFile(join(dir, name)).catch(() => Buffer.alloc(0)) })))
    const manifest = buildReleaseManifest({
      version: option(args, 'version'),
      channel: option(args, 'channel'),
      publishedAt: new Date().toISOString(),
      notesUrl: option(args, 'notes-url'),
      downloadBase: option(args, 'download-base'),
      files: files.filter((f) => f.bytes.length),
      signingKey,
      publicKey,
    })
    await writeFile(option(args, 'out'), JSON.stringify(manifest, null, 2) + '\n')
    console.log(`Signed ${manifest.assets.length} packages for ${manifest.version}`)
  } else {
    throw new Error(usage)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
