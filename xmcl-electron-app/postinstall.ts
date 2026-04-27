import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'

if (!existsSync(join(__dirname, 'dist'))) {
  mkdirSync(join(__dirname, 'dist'))
}

if (!existsSync(join(__dirname, '.env'))) {
  writeFileSync(join(__dirname, '.env'), 'CURSEFORGE_API_KEY=')
}

function findPath(relativePath: string) {
  const local = resolve(__dirname, relativePath)
  if (existsSync(local)) return local
  const root = resolve(__dirname, '..', relativePath)
  if (existsSync(root)) return root
  return undefined
}

if (process.platform === 'win32') {
  const appxManifestFilePath = findPath('node_modules/app-builder-lib/templates/appx/appxmanifest.xml')
  if (appxManifestFilePath) {
    writeFileSync(appxManifestFilePath, readFileSync(appxManifestFilePath, 'utf-8')
      // eslint-disable-next-line no-template-curly-in-string
      .replace("Publisher='${publisher}'", 'Publisher="${publisher}"'), 'utf-8')
  }
}

if (process.platform === 'linux' || process.platform === 'openbsd' || process.platform === 'freebsd') {
  // Overwrite the linux electron-builder js code
  const fpmTargetFilePath = findPath('node_modules/app-builder-lib/out/targets/FpmTarget.js')
  const linuxTargetHelperFilePath = findPath('node_modules/app-builder-lib/out/targets/LinuxTargetHelper.js')
  const linuxAfterInstallShPath = findPath('node_modules/app-builder-lib/templates/linux/after-install.tpl')
  
  if (fpmTargetFilePath && existsSync(fpmTargetFilePath)) {
    writeFileSync(fpmTargetFilePath, readFileSync(fpmTargetFilePath, 'utf-8')
      // eslint-disable-next-line no-template-curly-in-string
      .replace('installPrefix}/${appInfo.sanitizedProductName}', 'installPrefix}/xmcl'), 'utf-8')
  }
  if (linuxTargetHelperFilePath && existsSync(linuxTargetHelperFilePath)) {
    writeFileSync(linuxTargetHelperFilePath, readFileSync(linuxTargetHelperFilePath, 'utf-8')
      // eslint-disable-next-line no-template-curly-in-string
      .replace('installPrefix}/${appInfo.sanitizedProductName}', 'installPrefix}/xmcl'), 'utf-8')
  }
  if (linuxAfterInstallShPath && existsSync(linuxAfterInstallShPath)) {
    writeFileSync(linuxAfterInstallShPath, readFileSync(linuxAfterInstallShPath, 'utf-8')
      // eslint-disable-next-line no-template-curly-in-string
      .replaceAll('${sanitizedProductName}', 'xmcl'), 'utf-8')
  }
  console.log('Patched linux build target')
}
