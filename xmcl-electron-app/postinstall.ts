import { existsSync, mkdirSync, readFileSync, write, writeFileSync } from 'fs'
import { join } from 'path'

if (!existsSync(join(__dirname, 'dist'))) {
  mkdirSync(join(__dirname, 'dist'))
}

if (!existsSync(join(__dirname, '.env'))) {
  writeFileSync(join(__dirname, '.env'), 'CURSEFORGE_API_KEY=')
}

if (process.platform === 'linux' || process.platform === 'openbsd' || process.platform === 'freebsd') {
  // Overwrite the linux electron-builder js code
  const fpmTargetFilePath = './node_modules/app-builder-lib/out/targets/FpmTarget.js'
  const linuxTargetHelperFilePath = './node_modules/app-builder-lib/out/targets/LinuxTargetHelper.js'
  const linuxAfterInstallShPath = './node_modules/app-builder-lib/templates/linux/after-install.tpl'
  writeFileSync(fpmTargetFilePath, readFileSync(fpmTargetFilePath, 'utf-8')
    // eslint-disable-next-line no-template-curly-in-string
    .replace('installPrefix}/${appInfo.sanitizedProductName}', 'installPrefix}/xmcl'), 'utf-8')
  writeFileSync(linuxTargetHelperFilePath, readFileSync(linuxTargetHelperFilePath, 'utf-8')
    // eslint-disable-next-line no-template-curly-in-string
    .replace('installPrefix}/${appInfo.sanitizedProductName}', 'installPrefix}/xmcl'), 'utf-8')
  writeFileSync(linuxAfterInstallShPath, readFileSync(linuxAfterInstallShPath, 'utf-8')
    // eslint-disable-next-line no-template-curly-in-string
    .replaceAll('${sanitizedProductName}', 'xmcl'), 'utf-8')
  console.log('Patched linux build target')
}
