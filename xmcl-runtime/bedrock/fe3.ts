import { request, type Dispatcher } from 'undici'

/**
 * Minimal client for the Microsoft FE3 delivery ("Windows Update") SOAP
 * service, used to resolve the actual package download URL for a given
 * Minecraft Bedrock version.
 *
 * This is a faithful port of the `WUProtocol` / `VersionDownloader` classes in
 * MCMrARM's `mc-w10-version-launcher`. Only the anonymous `GetExtendedUpdateInfo2`
 * flow is implemented, which is enough to download public release builds. Beta
 * and preview builds are gated behind a Microsoft account subscription and
 * would additionally require an MSA ticket, which is not implemented here.
 */

const SECURED_URL = 'https://fe3.delivery.mp.microsoft.com/ClientWebService/client.asmx/secured'

/**
 * The download host that actually serves the package bytes. FE3 returns
 * several mirror URLs; we only trust the official delivery CDN.
 */
const DELIVERY_HOST_PREFIX = 'http://tlu.dl.delivery.mp.microsoft.com/'

/**
 * A GUID validation guard. `updateIdentity` values come from the remote
 * version database and are interpolated into a SOAP body, so we validate the
 * shape before use to keep the request well-formed.
 */
const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

// The device attributes blob is copied verbatim from the reference launcher.
// FE3 uses it to decide which update fragment to return; the exact values do
// not matter for resolving Minecraft's public download URL.
const DEVICE_ATTRIBUTES =
  'E:BranchReadinessLevel=CBB&DchuNvidiaGrfxExists=1&ProcessorIdentifier=Intel64%20Family%206%20Model%2063%20Stepping%202&CurrentBranch=rs4_release&DataVer_RS5=1942&FlightRing=Retail&AttrDataVer=57&InstallLanguage=en-US&DchuAmdGrfxExists=1&OSUILocale=en-US&InstallationType=Client&FlightingBranchName=&Version_RS5=10&UpgEx_RS5=Green&GStatus_RS5=2&OSSkuId=48&App=WU&InstallDate=1529700913&ProcessorManufacturer=GenuineIntel&AppVer=10.0.17134.471&OSArchitecture=AMD64&UpdateManagementGroup=2&IsDeviceRetailDemo=0&HidOverGattReg=C%3A%5CWINDOWS%5CSystem32%5CDriverStore%5CFileRepository%5Chidbthle.inf_amd64_467f181075371c89%5CMicrosoft.Bluetooth.Profiles.HidOverGatt.dll&IsFlightingEnabled=0&DchuIntelGrfxExists=1&TelemetryLevel=1&DefaultUserRegion=244&DeferFeatureUpdatePeriodInDays=365&Bios=Unknown&WuClientVer=10.0.17134.471&PausedFeatureStatus=1&Steam=URL%3Asteam%20protocol&Free=8to16&OSVersion=10.0.17134.472&DeviceFamily=Windows.Desktop'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildDownloadRequest(updateIdentity: string, revisionNumber: string): string {
  const now = new Date()
  const created = now.toISOString()
  const expires = new Date(now.getTime() + 5 * 60 * 1000).toISOString()
  return '<s:Envelope xmlns:a="http://www.w3.org/2005/08/addressing" xmlns:s="http://www.w3.org/2003/05/soap-envelope">' +
    '<s:Header>' +
    '<a:Action s:mustUnderstand="1">http://www.microsoft.com/SoftwareDistribution/Server/ClientWebService/GetExtendedUpdateInfo2</a:Action>' +
    '<a:MessageID>urn:uuid:5754a03d-d8d5-489f-b24d-efc31b3fd32d</a:MessageID>' +
    `<a:To s:mustUnderstand="1">${SECURED_URL}</a:To>` +
    '<o:Security s:mustUnderstand="1" xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">' +
    '<Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">' +
    `<Created>${created}</Created><Expires>${expires}</Expires>` +
    '</Timestamp>' +
    '<wuws:WindowsUpdateTicketsToken wsu:id="ClientMSA" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" xmlns:wuws="http://schemas.microsoft.com/msus/2014/10/WindowsUpdateAuthorization">' +
    '<TicketType Name="AAD" Version="1.0" Policy="MBI_SSL"></TicketType>' +
    '</wuws:WindowsUpdateTicketsToken>' +
    '</o:Security>' +
    '</s:Header>' +
    '<s:Body>' +
    '<GetExtendedUpdateInfo2 xmlns="http://www.microsoft.com/SoftwareDistribution/Server/ClientWebService">' +
    '<updateIDs>' +
    `<UpdateIdentity><UpdateID>${escapeXml(updateIdentity)}</UpdateID><RevisionNumber>${escapeXml(revisionNumber)}</RevisionNumber></UpdateIdentity>` +
    '</updateIDs>' +
    '<infoTypes><XmlUpdateFragmentType>FileUrl</XmlUpdateFragmentType></infoTypes>' +
    `<deviceAttributes>${escapeXml(DEVICE_ATTRIBUTES)}</deviceAttributes>` +
    '</GetExtendedUpdateInfo2>' +
    '</s:Body>' +
    '</s:Envelope>'
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
}

function extractDownloadUrls(responseXml: string): string[] {
  const urls: string[] = []
  const regex = /<Url>([^<]+)<\/Url>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(responseXml)) !== null) {
    urls.push(decodeXmlEntities(match[1]))
  }
  return urls
}

/**
 * Resolve the direct package download URL for a Bedrock version from the
 * Microsoft FE3 delivery service.
 *
 * @returns The download URL on the official delivery CDN, or `undefined` when
 * no usable URL was returned (e.g. the version requires account authorization).
 */
export async function resolveBedrockDownloadUrl(
  updateIdentity: string,
  revisionNumber = '1',
  dispatcher?: Dispatcher,
): Promise<string | undefined> {
  if (!GUID_REGEX.test(updateIdentity)) {
    throw new Error(`Invalid Bedrock update identity: ${updateIdentity}`)
  }
  const body = buildDownloadRequest(updateIdentity, revisionNumber)
  const response = await request(SECURED_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/soap+xml; charset=utf-8' },
    body,
    dispatcher,
  })
  const text = await response.body.text()
  if (response.statusCode >= 400) {
    throw new Error(`FE3 delivery request failed with status ${response.statusCode}: ${text.slice(0, 512)}`)
  }
  const urls = extractDownloadUrls(text)
  return urls.find((u) => u.startsWith(DELIVERY_HOST_PREFIX))
}
