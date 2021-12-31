import { Frame, GameSetting } from '@xmcl/gamesetting'

export type EditGameSettingOptions = Frame

// export function edit (options: EditGameSettingOptions, currentSetting: GameSetting & { resourcePacks: Array<string> }) {
//   const result: Frame = {}
//   for (const key of Object.keys(options)) {
//     if (key === 'resourcePacks') continue
//     if (key in currentSetting && (currentSetting as any)[key] !== (options as any)[key]) {
//       (result as any)[key] = (options as any)[key]
//     }
//   }
//   if (options.resourcePacks) {
//     const mcversion = this.getters.instance.runtime.minecraft
//     let resourcePacks: string[]
//     if ((isReleaseVersion(mcversion) && compareRelease(mcversion, '1.13.0') >= 0) ||
//             (isSnapshotPreview(mcversion) && compareSnapshot(mcversion, '17w43a') >= 0)) {
//       resourcePacks = options.resourcePacks
//         .map(r => (r !== 'vanilla' && !r.startsWith('file/') ? `file/${r}` : r))
//       if (resourcePacks.every((p) => p !== 'vanilla')) {
//         resourcePacks.unshift('vanilla')
//       }
//     } else {
//       resourcePacks = options.resourcePacks.filter(r => r !== 'vanilla')
//         .map(r => (r.startsWith('file/') ? r.substring(5) : r))
//     }
//     if (result.resourcePacks?.length !== resourcePacks.length || result.resourcePacks?.some((p, i) => p !== resourcePacks[i])) {
//       result.resourcePacks = resourcePacks
//     }
//   }
// }
