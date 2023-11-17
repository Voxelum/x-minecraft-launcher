export const IS_DEV = process.env.NODE_ENV === 'development'
export const HAS_DEV_SERVER = !!process.env.HAS_DEV_SERVER
export const HOST = HAS_DEV_SERVER ? 'localhost' : 'xmcl.runtime'
export const AZURE_CDN = 'https://xmcl-release.azureedge.net/releases'
export const AZURE_MS_CDN = 'https://xmcl-release-ms.azureedge.net/releases'
export const BUILTIN_TRUSTED_SITES = Object.freeze(['https://www.java.com/download/'])

export enum AccentState {
  ACCENT_DISABLED = 0,
  ACCENT_ENABLE_GRADIENT = 1,
  ACCENT_ENABLE_TRANSPARENTGRADIENT = 2,
  ACCENT_ENABLE_BLURBEHIND = 3,
  ACCENT_ENABLE_ACRYLICBLURBEHIND = 4,
  ACCENT_ENABLE_HOSTBACKDROP = 5,
  ACCENT_INVALID_STATE = 6,
}

export enum WindowsBuild {
  Windows10Build1903 = 18362,
  Windows10Build1809 = 17763,
  Windows11 = 22000,
  Windows10 = 10240,
}
