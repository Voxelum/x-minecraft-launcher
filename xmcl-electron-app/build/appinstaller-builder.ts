import { writeFile } from 'fs-extra'

function getAppInstallerContent(version: string) {
  const result = `<?xml version="1.0" encoding="utf-8"?>
  <AppInstaller
      xmlns="http://schemas.microsoft.com/appx/appinstaller/2018"
      Version="${version}.0"
      Uri="https://xmcl.blob.core.windows.net/releases/xmcl.appinstaller" >
      <MainPackage
          Name="XMCL"
          Publisher="E=cijhn@hotmail.com, CN=&quot;Open Source Developer, Hongze Xu&quot;, O=Open Source Developer, L=Beijing, C=CN"
          Version="${version}.0"
          ProcessorArchitecture="x64"
          Uri="https://xmcl-release-ms.azureedge.net/releases/xmcl-${version}.appx" />
      <UpdateSettings>
          <OnLaunch HoursBetweenUpdateChecks="0"/>
      </UpdateSettings>
  </AppInstaller>`
  return result.padEnd(1024, ' ')
}

export async function buildAppInstaller(version: string, destination: string) {
  await writeFile(destination, getAppInstallerContent(version))
}
