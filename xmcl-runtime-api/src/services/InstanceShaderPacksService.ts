import { InstanceResourcesService } from './InstanceResourcesService'
import { ServiceKey } from './Service'

/**
 * 光影包语言文件中的一条键值对。
 * 值已经去掉行首行尾空白，写回时会恢复原有空白。
 */
export interface ShaderPackLangEntry {
  key: string
  value: string
}

/**
 * 光影包 zip 内的一个语言文件信息。
 */
export interface ShaderPackLangFileInfo {
  /** zip 内路径，如 `shaders/lang/en_US.lang` */
  path: string
  /** 文件名推断出的语言代码，如 `en_US` */
  locale: string
  /** 解析出的条目数 */
  entries: number
  /** zip 条目未压缩大小 */
  bytes: number
  /** 目标语言对应的 zip 内路径 */
  targetPath: string
  /** 目标路径是否已存在于 zip 中 */
  targetExists: boolean
}

/**
 * 读取出的语言文件文档。
 */
export interface ShaderPackLangDocument {
  path: string
  locale: string
  entries: ShaderPackLangEntry[]
  /** Keys already present in the target, including intentionally empty values. */
  targetKeys: string[]
  targetPath: string
  targetExists: boolean
}

/**
 * 写回翻译结果的参数。
 */
export interface ShaderPackLangWriteOptions {
  /** 实例根目录，用于确认译制副本写入非共享的实例目录 */
  instancePath: string
  /** 光影包 zip 的绝对路径（来自资源的 `path`） */
  packPath: string
  /** 源语言文件在 zip 内的路径 */
  sourcePath: string
  /** 目标语言代码，如 `zh_cn`、`zh_CN` */
  targetLocale: string
  /** 翻译结果，键必须来自源语言文件 */
  translations: ShaderPackLangEntry[]
}

/**
 * 写回结果。
 */
export interface ShaderPackLangWriteResult {
  /** ZIP copy filename, absent when there were no missing keys. */
  fileName?: string
  /** 实际写回的 zip 内路径 */
  path: string
  /** 补齐的条目数 */
  written: number
  /** 结束阶段写入的字节数 */
  bytes: number
}

export interface InstanceShaderPacksService extends InstanceResourcesService {
  /**
   * Whether the instance's `shaderpacks` folder is linked to the global shared folder.
   */
  isLinked(instancePath: string): Promise<boolean>
  /**
   * Link the instance's `shaderpacks` folder to the global shared folder.
   *
   * Existing packs are merged into the shared folder first.
   */
  linkShared(instancePath: string): Promise<void>
  /**
   * Unlink the instance's `shaderpacks` folder from the global shared folder.
   */
  unlinkShared(instancePath: string): Promise<void>

  /**
   * 列出光影包 zip 内的语言文件。
   *
   * `targetLocale` 用于计算每个源文件会写到的目标路径，以及目标是否已存在。
   */
  listShaderPackLangFiles(packPath: string, targetLocale: string): Promise<ShaderPackLangFileInfo[]>

  /**
   * 读取光影包 zip 内某个语言文件的内容。
   *
   * `targetLocale` 用于同时返回目标路径及已有键，供界面直接展示。
   */
  readShaderPackLangFile(packPath: string, langPath: string, targetLocale: string): Promise<ShaderPackLangDocument>

  /**
   * 只补齐缺失的目标语言键，并创建不覆盖任何现有文件的本地 ZIP 副本。
   *
   * 目标文件已存在时以目标文件为模板，避免丢弃已有的人工翻译与注释。
   */
  writeShaderPackLangFile(options: ShaderPackLangWriteOptions): Promise<ShaderPackLangWriteResult>
}

export const InstanceShaderPacksServiceKey: ServiceKey<InstanceShaderPacksService> = 'InstanceShaderPacksService'
