import v119 from '@/assets/banners/1.19.webp'
import v118 from '@/assets/banners/1.18.webp'
import v117 from '@/assets/banners/1.17.webp'
import v116 from '@/assets/banners/1.16.webp'
import v115 from '@/assets/banners/1.15.webp'
import v114 from '@/assets/banners/1.14.webp'
import v113 from '@/assets/banners/1.13.webp'
import v112 from '@/assets/banners/1.12.webp'
import v111 from '@/assets/banners/1.11.webp'
import v110 from '@/assets/banners/1.10.webp'
import v19 from '@/assets/banners/1.9.webp'
import v18 from '@/assets/banners/1.8.webp'
import v17 from '@/assets/banners/1.7.webp'
import v16 from '@/assets/banners/1.6.webp'

const dic = Object.freeze({
  v119,
  v118,
  v117,
  v116,
  v115,
  v114,
  v113,
  v112,
  v111,
  v110,
  v19,
  v18,
  v17,
  v16,
})

export function getBanner(version: string) {
  const [major, minor] = version.split('.')
  return (dic as any)[`v${major}${minor}`]
}
