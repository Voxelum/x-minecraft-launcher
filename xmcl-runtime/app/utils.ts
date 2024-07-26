import { createWriteStream } from 'fs'
import { extname } from 'path'
import { Writable } from 'stream'
import { stream } from 'undici'

export interface ResolvedIcon {
  src: string
  purpose: string
  type: string
  sizes: string
  allSizes: number[]
}

export async function downloadIcon(url: string, dest: string) {
  await stream(url, {
    method: 'GET',
    opaque: createWriteStream(dest),
  }, ({ opaque }) => {
    return opaque as Writable
  })
  return dest
}

function resolveType(url: string, type?: string) {
  if (type?.startsWith('image/')) return type.substring(6)
  if (!type) {
    return extname(url).substring(1)
  }
  return ''
}

function resolvePurpose(purpose?: string) {
  return !purpose ? 'any' : purpose
}

// export function resolveIcon(icon: Required<AppManifest>[''][number]): ResolvedIcon {
//   const resolvedPurpose = resolvePurpose(icon.purpose)
//   const resolvedType = resolveType(icon.src, icon.type)
//   const resolvedSizes = icon.sizes ?? ''
//   const allSizes = resolvedSizes.split(' ').map(s => Number.parseInt(s.split('x')[0], 10))

//   return {
//     src: icon.src,
//     purpose: resolvedPurpose,
//     type: resolvedType,
//     sizes: icon.sizes ?? '',
//     allSizes,
//   }
// }
