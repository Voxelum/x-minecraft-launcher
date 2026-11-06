import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

if (!existsSync(join(__dirname, 'dist'))) {
  mkdirSync(join(__dirname, 'dist'))
}

if (!existsSync(join(__dirname, '.env'))) {
  writeFileSync(join(__dirname, '.env'), '')
}

if (process.platform === 'win32') {
  const appxManifestFilePath = './node_modules/app-builder-lib/templates/appx/appxmanifest.xml'
  writeFileSync(appxManifestFilePath, readFileSync(appxManifestFilePath, 'utf-8')
    // eslint-disable-next-line no-template-curly-in-string
    .replace("Publisher='${publisher}'", 'Publisher="${publisher}"'), 'utf-8')
}

// Linux packages install to electron-builder's default /opt/<productName> (/opt/Vardrynn), which
// build/linux/*.tpl and the AppArmor profile expect. The upstream /opt/xmcl rewrite was removed.
