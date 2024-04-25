
const core = require('@actions/core');

async function main() {
  const body = core.getInput('body')
  const version = core.getInput('version')

  let content = body

  const rpmUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-x86_64.rpm`
  const rpmArmUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-aarch64.rpm`
  const tarUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-x64.tar.xz`
  const tarArmUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-arm64.tar.xz`
  const debUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-amd64.deb`
  const debArmUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-arm64.deb`
  const appImageUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-x86_64.AppImage`
  const appImageArmUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-arm64.AppImage`
  const darwinZipUrl = `https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-darwin-x64.zip`

  content += `\n\n## Downloads\n\n`
  content += `- Windows (x64): [zip](https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-win32-x64.zip)\n`
  content += `- Linux (x64): [AppImage](${appImageUrl}) [deb](${debUrl}) [tar.xz](${tarUrl}) [rpm](${rpmUrl})\n`
  content += `- Linux (arm64): [AppImage](${appImageArmUrl}) [deb](${debArmUrl}) [tar.xz](${tarArmUrl}) [rpm](${rpmArmUrl})\n`
  content += `- Mac (x64): [dmg](https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}.dmg) [zip](${darwinZipUrl})\n`
  content += `- Mac (arm64): [zip](https://github.com/Voxelum/x-minecraft-launcher/releases/download/v${version}/xmcl-${version}-darwin-arm64.zip)\n`

  core.setOutput('body', content)
}

main();

