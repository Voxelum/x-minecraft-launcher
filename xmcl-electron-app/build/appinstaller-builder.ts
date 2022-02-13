import { writeFile } from 'fs-extra'

function getAppInstallerContent(version: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
  <AppInstaller
      xmlns="http://schemas.microsoft.com/appx/appinstaller/2021"
      Version="${version}"
      Uri="https://xmcl-release-ms.azureedge.net/releases/xmcl.appinstaller" >
  
      <MainPackage
          Name="X Minecraft Launcher"
          Publisher="E=cijhn@hotmail.com, CN=&quot;Open Source Developer, Hongze Xu&quot;, O=Open Source Developer, L=Beijing, C=CN"
          Version="${version}"
          ProcessorArchitecture="x64"
          Uri="https://xmcl-release-ms.azureedge.net/releases/xmcl-${version}-win32-x64.appx" />
  
      <UpdateURIs>
          <UpdateURI>https://xmcl-release-ms.azureedge.net/releases/xmcl.appinstaller</UpdateURI>
          <UpdateURI>https://xmcl-release.azureedge.net/releases/xmcl.appinstaller</UpdateURI>
      </UpdateURIs>
  
      <UpdateSettings>
          <OnLaunch HoursBetweenUpdateChecks="0"/>   
      </UpdateSettings>
  </AppInstaller>`
}

export async function buildAppInstaller(version: string, destination: string) {
  await writeFile(destination, getAppInstallerContent(version))
}
