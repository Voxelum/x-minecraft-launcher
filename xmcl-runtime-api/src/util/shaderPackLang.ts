/**
 * 光影包语言文件相关、渲染进程与主进程共用的纯函数。
 *
 * 这里刻意不引入 node 内置模块，保证可以被渲染进程直接打包使用。
 */

/** 单语言代码到 Minecraft 默认地区的映射 */
const MC_LANG_DEFAULTS: Record<string, string> = {
  en: 'en_us',
  zh: 'zh_cn',
  ru: 'ru_ru',
  ja: 'ja_jp',
  ko: 'ko_kr',
  fr: 'fr_fr',
  de: 'de_de',
  es: 'es_es',
  pt: 'pt_br',
  it: 'it_it',
  uk: 'uk_ua',
  pl: 'pl_pl',
  nl: 'nl_nl',
  tr: 'tr_tr',
  cs: 'cs_cz',
  vi: 'vi_vn',
  th: 'th_th',
  gl: 'gl_es',
  kz: 'kk_kz',
  lolcat: 'lol_us',
  ar: 'ar_sa',
  bn: 'bn_bd',
  hi: 'hi_in',
  hu: 'hu_hu',
  id: 'id_id',
  sa: 'sa_in',
  ta: 'ta_in',
}

/**
 * 把启动器语言代码（如 `zh-CN`）规范化为 Minecraft 风格语言代码（如 `zh_cn`）。
 */
export function toShaderPackMcLang(locale: string): string {
  const lower = (locale || 'en').toLowerCase().replace(/-/g, '_')
  if (lower === 'en_in') return 'en_us'
  if (lower === 'ar_eg') return 'ar_sa'
  if (lower.includes('_')) return lower
  return MC_LANG_DEFAULTS[lower] ?? `${lower}_${lower}`
}

/**
 * 计算目标语言文件在 zip 内的路径。
 *
 * 目标文件名的大小写跟随源文件：源为 `en_US.lang` 时生成 `zh_CN.lang`，
 * 源为 `en_us.lang` 时生成 `zh_cn.lang`；若 zip 内已有仅大小写不同的等价路径，
 * 则复用已有路径，避免产生两个只差大小写的语言文件。
 */
export function shaderPackTargetPath(sourcePath: string, targetLocale: string, existingPaths: string[] = []): string {
  const normalizedLocale = toShaderPackMcLang(targetLocale)
  const slash = sourcePath.lastIndexOf('/')
  const dir = slash >= 0 ? sourcePath.slice(0, slash + 1) : ''
  const sourceName = sourcePath.slice(slash + 1)
  const sourceBase = sourceName.replace(/\.lang$/i, '')
  const region = sourceBase.slice(sourceBase.indexOf('_') + 1)
  const [language, regionCode] = normalizedLocale.split('_')
  const targetName = region && region === region.toUpperCase()
    ? `${language}_${(regionCode ?? language).toUpperCase()}.lang`
    : `${normalizedLocale}.lang`
  const candidate = `${dir}${targetName}`
  const existing = existingPaths.find(path => path.toLowerCase() === candidate.toLowerCase())
  return existing ?? candidate
}
