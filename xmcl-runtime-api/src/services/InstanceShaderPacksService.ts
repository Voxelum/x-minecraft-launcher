import { InstanceResourcesService } from './InstanceResourcesService'
import { ServiceKey } from './Service'

/**
 * 光影包语言文件中的一条键值对。
 */
export interface ShaderPackLangEntry {
  key: string
  value: string
}

/**
 * 光影包 zip 内某个语言文件的元信息。
 */
export interface ShaderPackLangFileInfo {
  /** zip 内的相对路径，例如 shaders/lang/en_US.lang */
  path: string
  /** 文件名中的语言代码，例如 en_US */
  locale: string
  /** 解析出的键值对数量 */
  entries: number
  /** zip 条目未压缩大小（字节） */
  bytes: number
  /** 推荐的简体中文目标路径 */
  targetPath: string
  /** zip 内是否已存在目标语言文件 */
  targetExists: boolean
}

/**
 * 读取出的光影包语言文件内容。
 */
export interface ShaderPackLangDocument {
  path: string
  locale: string
  entries: ShaderPackLangEntry[]
  targetPath: string
  targetExists: boolean
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
   * 列出已安装光影包 zip 内的语言文件。
   *
   * @param targetLocale 目标语言（启动器语言代码或 Minecraft 语言代码），用于计算 targetPath，默认 `zh_cn`
   */
  listLangFiles(instancePath: string, fileName: string, targetLocale?: string): Promise<ShaderPackLangFileInfo[]>
  /**
   * 读取光影包 zip 内的某个语言文件，解析为键值对。
   *
   * @param targetLocale 目标语言，用于计算 targetPath，默认 `zh_cn`
   */
  readLangFile(instancePath: string, fileName: string, langPath: string, targetLocale?: string): Promise<ShaderPackLangDocument>
  /**
   * 把翻译结果合并进目标语言文件并以原子方式写回 zip，返回实际写回路径。
   */
  writeTranslatedLangFile(
    instancePath: string,
    fileName: string,
    sourceLangPath: string,
    targetLocale: string,
    translations: Record<string, string>,
  ): Promise<string>
}

export const InstanceShaderPacksServiceKey: ServiceKey<InstanceShaderPacksService> = 'InstanceShaderPacksService'
