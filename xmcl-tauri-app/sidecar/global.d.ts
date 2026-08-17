// Declarations for the virtual modules the reused esbuild plugins resolve, and
// which `xmcl-electron-app/main/global.d.ts` declares for the Electron target.
// Only the ones missing from `@xmcl/runtime/global.module` are repeated here.

declare module 'virtual:elevate.exe' {
  const content: string
  export default content
}

declare module '*.ico' {
  /** The path of the emitted static file. */
  const path: string
  export default path
}
