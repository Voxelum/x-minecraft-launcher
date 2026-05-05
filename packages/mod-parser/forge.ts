import { resolveFileSystem, FileSystem } from '@xmcl/system'
import { TomlDate, parse as parseToml } from 'smol-toml'
import { AnnotationVisitor, ClassReader, ClassVisitor, MethodVisitor, Opcodes } from '@xmcl/asm'

/**
 * The @Mod data from class file
 */
export interface ForgeModAnnotationData {
  [key: string]: any
  value: string
  modid: string
  name: string
  version: string
  /**
   * A dependency string for this mod, which specifies which mod(s) it depends on in order to run.
   *
   * A dependency string must start with a combination of these prefixes, separated by "-":
   *     [before, after], [required], [client, server]
   *     At least one "before", "after", or "required" must be specified.
   * Then ":" and the mod id.
   * Then a version range should be specified for the mod by adding "@" and the version range.
   *     The version range format is described in the javadoc here:
   *     {@link VersionRange#createFromVersionSpec(java.lang.String)}
   * Then a ";".
   *
   * If a "required" mod is missing, or a mod exists with a version outside the specified range,
   * the game will not start and an error screen will tell the player which versions are required.
   *
   * Example:
   *     Our example mod:
   *      * depends on Forge and uses new features that were introduced in Forge version 14.21.1.2395
   *         "required:forge@[14.21.1.2395,);"
   *
   *          1.12.2 Note: for compatibility with Forge older than 14.23.0.2501 the syntax must follow this older format:
   *          "required-after:forge@[14.21.1.2395,);"
   *          For more explanation see https://github.com/MinecraftForge/MinecraftForge/issues/4918
   *
   *      * is a dedicated addon to mod1 and has to have its event handlers run after mod1's are run,
   *         "required-after:mod1;"
   *      * has optional integration with mod2 which depends on features introduced in mod2 version 4.7.0,
   *         "after:mod2@[4.7.0,);"
   *      * depends on a client-side-only rendering library called rendermod
   *         "required-client:rendermod;"
   *
   *     The full dependencies string is all of those combined:
   *         "required:forge@[14.21.1.2395,);required-after:mod1;after:mod2@[4.7.0,);required-client:rendermod;"
   *
   *     This will stop the game and display an error message if any of these is true:
   *         The installed forge is too old,
   *         mod1 is missing,
   *         an old version of mod2 is present,
   *         rendermod is missing on the client.
   */
  dependencies: string
  useMetadata: boolean
  acceptedMinecraftVersions: string
  acceptableRemoteVersions: string
  acceptableSaveVersions: string
  modLanguage: string
  modLanguageAdapter: string
  clientSideOnly: boolean
  serverSideOnly: boolean
}

/**
 * Represent the forge `mcmod.info` format.
 */
export interface ForgeModMcmodInfo {
  /**
   * The modid this description is linked to. If the mod is not loaded, the description is ignored.
   */
  modid: string
  /**
   * The user-friendly name of this mod.
   */
  name: string
  /**
   * A description of this mod in 1-2 paragraphs.
   */
  description: string
  /**
   * The version of the mod.
   */
  version: string
  /**
   * The Minecraft version.
   */
  mcversion: string
  /**
   * A link to the mod’s homepage.
   */
  url: string
  /**
   * Defined but unused. Superseded by updateJSON.
   */
  updateUrl: string
  /**
   * The URL to a version JSON.
   */
  updateJSON: string
  /**
   * A list of authors to this mod.
   */
  authorList: string[]
  /**
   * A string that contains any acknowledgements you want to mention.
   */
  credits: string
  /**
   * The path to the mod’s logo. It is resolved on top of the classpath, so you should put it in a location where the name will not conflict, maybe under your own assets folder.
   */
  logoFile: string
  /**
   * A list of images to be shown on the info page. Currently unimplemented.
   */
  screenshots: string[]
  /**
   * The modid of a parent mod, if applicable. Using this allows modules of another mod to be listed under it in the info page, like BuildCraft.
   */
  parent: string
  /**
   * If true and `Mod.useMetadata`, the below 3 lists of dependencies will be used. If not, they do nothing.
   */
  useDependencyInformation: boolean
  /**
   * A list of modids. If one is missing, the game will crash. This does not affect the ordering of mod loading! To specify ordering as well as requirement, have a coupled entry in dependencies.
   */
  requiredMods: string[]
  /**
   * A list of modids. All of the listed mods will load before this one. If one is not present, nothing happens.
   */
  dependencies: string[]
  /**
   * A list of modids. All of the listed mods will load after this one. If one is not present, nothing happens.
   */
  dependants: string[]
}

/**
 * This file defines the metadata of your mod. Its information may be viewed by users from the main screen of the game through the Mods button. A single info file can describe several mods.
 *
 * The mods.toml file is formatted as TOML, the example mods.toml file in the MDK provides comments explaining the contents of the file. It should be stored as src/main/resources/META-INF/mods.toml. A basic mods.toml, describing one mod, may look like this:
 */
export interface ForgeModTOMLData {
  /**
   * The modid this file is linked to
   */
  modid: string
  /**
   * The version of the mod.It should be just numbers seperated by dots, ideally conforming to Semantic Versioning
   */
  version: string
  /**
   * The user - friendly name of this mod
   */
  displayName: string
  /**
   * The URL to a version JSON
   */
  updateJSONURL: string
  /**
   * A link to the mod’s homepage
   */
  displayURL: string
  /**
   * The filename of the mod’s logo.It must be placed in the root resource folder, not in a subfolder
   */
  logoFile: string
  /**
   * A string that contains any acknowledgements you want to mention
   */
  credits: string
  /**
   * The authors to this mod
   */
  authors: string
  /**
   * A description of this mod
   */
  description: string
  /**
   * A list of dependencies of this mod
   */
  dependencies: {
    modId: string
    mandatory: boolean
    versionRange: string
    ordering: 'NONE' | 'BEFORE' | 'AFTER'
    side: 'BOTH' | 'CLIENT' | 'SERVER'
  }[]

  provides: string[]
  /**
   * The name of the mod loader type to load - for regular FML @Mod mods it should be javafml
   */
  modLoader: string
  /**
   * A version range to match for said mod loader - for regular FML @Mod it will be the forge version
   */
  loaderVersion: string
  /**
   * A URL to refer people to when problems occur with this mod
   */
  issueTrackerURL: string
  /**
     * If true, the mod is client side only
     */
  clientSideOnly: boolean
}

export interface ForgeModASMData {
  /**
   * Does class files contain cpw package
   */
  usedLegacyFMLPackage: boolean
  /**
   * Does class files contain forge package
   */
  usedForgePackage: boolean
  /**
   * Does class files contain minecraft package
   */
  usedMinecraftPackage: boolean
  /**
   * Does class files contain minecraft.client package
   */
  usedMinecraftClientPackage: boolean

  fmlPluginClassName?: string
  fmlPluginMcVersion?: string

  modAnnotations: ForgeModAnnotationData[]
}

/**
 * The metadata inferred from manifest
 */
export interface ManifestMetadata {
  modid: string
  name: string
  authors: string[]
  version: string
  description: string
  url: string
}

class ModAnnotationVisitor extends AnnotationVisitor {
  constructor(readonly map: ForgeModAnnotationData) {
    super(Opcodes.ASM5)
  }
  public visit(s: string, o: any) {
    if (s === 'value') {
      this.map.modid = o
    } else {
      this.map[s] = o
    }
  }
}
class McVersionAnnotationVisitor extends AnnotationVisitor {
  constructor(readonly map: (v: string) => void) {
    super(Opcodes.ASM5)
  }
  public visit(s: string, o: any) {
    if (s === 'value') {
      this.map(o)
    }
  }
}

class DummyModConstructorVisitor extends MethodVisitor {
  private stack: any[] = []
  constructor(
    private parent: ModClassVisitor,
    api: number,
  ) {
    super(api)
  }

  visitLdcInsn(value: any) {
    this.stack.push(value)
  }

  visitFieldInsn(opcode: number, owner: string, name: string, desc: string) {
    if (opcode === Opcodes.PUTFIELD) {
      const last = this.stack.pop()
      if (last) {
        if (name === 'modId') {
          this.parent.guess.modid = last
        } else if (name === 'version') {
          this.parent.guess.version = last
        } else if (name === 'name') {
          this.parent.guess.name = last
        } else if (name === 'url') {
          this.parent.guess.url = last
        } else if (name === 'parent') {
          this.parent.guess.parent = last
        } else if (name === 'mcversion') {
          this.parent.guess.mcversion = last
        }
      }
    }
  }
}

class ModClassVisitor extends ClassVisitor {
  public fields: Record<string, any> = {}
  public className = ''
  public isDummyModContainer = false
  public isPluginClass = false
  public mcVersionInPlugin = ''
  public pluginName = ''

  public constructor(
    readonly result: ForgeModASMData,
    public guess: Partial<ForgeModAnnotationData>,
    readonly corePlugin?: string,
  ) {
    super(Opcodes.ASM5)
  }

  private validateType(desc: string) {
    if (desc.indexOf('net/minecraftforge') !== -1) {
      this.result.usedForgePackage = true
    }
    if (desc.indexOf('net/minecraft') !== -1) {
      this.result.usedMinecraftPackage = true
    }
    if (desc.indexOf('cpw/mods/fml') !== -1) {
      this.result.usedLegacyFMLPackage = true
    }
    if (desc.indexOf('net/minecraft/client') !== -1) {
      this.result.usedMinecraftClientPackage = true
    }
  }

  visit(
    version: number,
    access: number,
    name: string,
    signature: string,
    superName: string,
    interfaces: string[],
  ): void {
    this.className = name
    this.isPluginClass = name === this.corePlugin
    if (superName === 'net/minecraftforge/fml/common/DummyModContainer') {
      this.isDummyModContainer = true
    }
    this.validateType(superName)
    for (const intef of interfaces) {
      this.validateType(intef)
      if (intef.indexOf('net/minecraftforge/fml/relauncher/IFMLLoadingPlugin') !== -1) {
        this.result.fmlPluginClassName = name
      }
    }
  }

  public visitMethod(
    access: number,
    name: string,
    desc: string,
    signature: string,
    exceptions: string[],
  ) {
    if (this.isDummyModContainer && name === '<init>') {
      return new DummyModConstructorVisitor(this, Opcodes.ASM5)
    }
    this.validateType(desc)
    return null
  }

  public visitField(access: number, name: string, desc: string, signature: string, value: any) {
    this.fields[name] = value
    return null
  }

  public visitAnnotation(desc: string, visible: boolean): AnnotationVisitor | null {
    if (desc === 'Lnet/minecraftforge/fml/common/Mod;' || desc === 'Lcpw/mods/fml/common/Mod;') {
      const annotationData: ForgeModAnnotationData = {
        modid: '',
        name: '',
        version: '',
        dependencies: '',
        useMetadata: true,
        clientSideOnly: false,
        serverSideOnly: false,
        acceptedMinecraftVersions: '',
        acceptableRemoteVersions: '',
        acceptableSaveVersions: '',
        modLanguage: 'java',
        modLanguageAdapter: '',
        value: '',
      }
      this.result.modAnnotations.push(annotationData)
      return new ModAnnotationVisitor(annotationData)
    } else if (desc === 'Lnet/minecraftforge/fml/relauncher/IFMLLoadingPlugin$MCVersion;') {
      return new McVersionAnnotationVisitor((v) => {
        this.result.fmlPluginMcVersion = v
      })
    }
    return null
  }

  visitEnd() {
    if (
      (this.className === 'Config' ||
        this.className === 'net/optifine/Config' ||
        this.className === 'notch/net/optifine/Config') &&
      this.fields &&
      this.fields.OF_NAME
    ) {
      this.result.modAnnotations.push({
        modid: this.fields.OF_NAME,
        name: this.fields.OF_NAME,
        mcversion: this.fields.MC_VERSION,
        version: `${this.fields.OF_EDITION}_${this.fields.OF_RELEASE}`,
        description:
          'OptiFine is a Minecraft optimization mod. It allows Minecraft to run faster and look better with full support for HD textures and many configuration options.',
        authorList: ['sp614x'],
        url: 'https://optifine.net',
        clientSideOnly: true,
        serverSideOnly: false,
        value: '',
        dependencies: '',
        useMetadata: false,
        acceptableRemoteVersions: '',
        acceptableSaveVersions: '',
        acceptedMinecraftVersions: `[${this.fields.MC_VERSION}]`,
        modLanguage: 'java',
        modLanguageAdapter: '',
      })
    }
    for (const [k, v] of Object.entries(this.fields)) {
      switch (k.toUpperCase()) {
        case 'MODID':
        case 'MOD_ID':
          this.guess.modid = this.guess.modid || v
          break
        case 'MODNAME':
        case 'MOD_NAME':
          this.guess.name = this.guess.name || v
          break
        case 'VERSION':
        case 'MOD_VERSION':
          this.guess.version = this.guess.version || v
          break
        case 'MCVERSION':
          this.guess.mcversion = this.guess.mcversion || v
          break
      }
    }
  }
}

/**
 * Read the mod info from `META-INF/MANIFEST.MF`
 * @returns The manifest directionary
 */
export async function readForgeModManifest(
  mod: ForgeModInput,
  manifestStore: Record<string, any> = {},
): Promise<ManifestMetadata | undefined> {
  const fs = await resolveFileSystem(mod)
  if (!(await fs.existsFile('META-INF/MANIFEST.MF'))) {
    return undefined
  }
  const data = await fs.readFile('META-INF/MANIFEST.MF')
  const manifest: Record<string, string> = data
    .toString()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.split(':').map((s) => s.trim()))
    .reduce((a, b) => ({ ...a, [b[0]]: b[1] }), {}) as any
  Object.assign(manifestStore, manifest)
  const metadata: ManifestMetadata = {
    modid: '',
    name: '',
    authors: [],
    version: '',
    description: '',
    url: '',
  }
  if (typeof manifest.TweakName === 'string') {
    metadata.modid = manifest.TweakName
    metadata.name = manifest.TweakName
  }
  if (typeof manifest.TweakAuthor === 'string') {
    metadata.authors = [manifest.TweakAuthor]
  }
  if (typeof manifest.TweakVersion === 'string') {
    metadata.version = manifest.TweakVersion
  }
  if (manifest.TweakMetaFile) {
    const file = manifest.TweakMetaFile
    if (await fs.existsFile(`META-INF/${file}`)) {
      const metadataContent = await fs
        .readFile(`META-INF/${file}`, 'utf-8')
        .then((s) => s.replace(/^\uFEFF/, ''))
        .then(JSON.parse)
      if (metadataContent.id) {
        metadata.modid = metadataContent.id
      }
      if (metadataContent.name) {
        metadata.name = metadataContent.name
      }
      if (metadataContent.version) {
        metadata.version = metadataContent.version
      }
      if (metadataContent.authors) {
        metadata.authors = metadataContent.authors
      }
      if (metadataContent.description) {
        metadata.description = metadataContent.description
      }
      if (metadataContent.url) {
        metadata.url = metadataContent.url
      }
    }
  }
  return metadata
}

/**
 * Read mod metadata from new toml metadata file.
 */
export async function readForgeModToml(
  mod: ForgeModInput,
  manifest?: Record<string, string>,
  fileName = 'mods.toml',
) {
  const fs = await resolveFileSystem(mod)
  const existed = await fs.existsFile('META-INF/' + fileName)
  const all: ForgeModTOMLData[] = []
  if (existed) {
    const str = await fs.readFile('META-INF/' + fileName, 'utf-8')
    const root = parseToml(str)
    if (root.mods instanceof Array) {
      for (const mod of root.mods) {
        const tomlMod = mod
        if (
          typeof tomlMod === 'object' &&
          !(tomlMod instanceof TomlDate) &&
          !(tomlMod instanceof Array)
        ) {
          const modObject: ForgeModTOMLData = {
            modid: (tomlMod.modId as string) ?? '',
            authors: (tomlMod.authors as string) ?? (root.authors as string) ?? '',
            // eslint-disable-next-line no-template-curly-in-string
            version:
              tomlMod.version === '${file.jarVersion}' &&
              typeof manifest?.['Implementation-Version'] === 'string'
                ? manifest?.['Implementation-Version']
                : (tomlMod.version as string),
            displayName: (tomlMod.displayName as string) ?? '',
            description: (tomlMod.description as string) ?? '',
            displayURL: (tomlMod.displayURL as string) ?? (root.displayURL as string) ?? '',
            updateJSONURL: (tomlMod.updateJSONURL as string) ?? root.updateJSONURL ?? '',
            provides: (tomlMod.provides as string[]) ?? [],
            dependencies: [],
            logoFile: tomlMod.logoFile as string ?? '',
            credits: tomlMod.credits as string ?? '',
            loaderVersion: root.loaderVersion as string ?? '',
            modLoader: root.modLoader as string ?? '',
            issueTrackerURL: root.issueTrackerURL as string ?? '',
            clientSideOnly: (root.clientSideOnly as boolean) ?? (tomlMod.clientSideOnly as boolean) ?? false,
          }
          all.push(modObject)
        }
      }
    }
    if (typeof root.dependencies === 'object') {
      for (const mod of all) {
        const dep = (root.dependencies as Record<string, any>)[mod.modid]
        if (dep) {
          mod.dependencies = dep
        }
      }
    }
  }
  return all
}

/**
 * Use asm to scan all the class files of the mod. This might take long time to read.
 */
export async function readForgeModAsm(
  mod: ForgeModInput,
  manifest: Record<string, string> = {},
): Promise<ForgeModASMData> {
  const fs = await resolveFileSystem(mod)
  let corePluginClass: string | undefined
  if (manifest) {
    if (typeof manifest.FMLCorePlugin === 'string') {
      const clazz = manifest.FMLCorePlugin.replace(/\./g, '/')
      if (
        (await fs.existsFile(clazz)) ||
        (await fs.existsFile(`/${clazz}`)) ||
        (await fs.existsFile(`/${clazz}.class`)) ||
        (await fs.existsFile(clazz + '.class'))
      ) {
        corePluginClass = clazz
      }
    }
  }
  const result: ForgeModASMData = {
    usedForgePackage: false,
    usedLegacyFMLPackage: false,
    usedMinecraftClientPackage: false,
    usedMinecraftPackage: false,
    modAnnotations: [],
  }
  const guessing: Partial<ForgeModAnnotationData> = {}
  await fs.walkFiles('/', async (f) => {
    if (!f.endsWith('.class')) {
      return
    }
    const data = await fs.readFile(f)
    const visitor = new ModClassVisitor(result, guessing, corePluginClass)

    new ClassReader(data).accept(visitor)
  })
  if (
    result.modAnnotations.length === 0 &&
    guessing.modid &&
    (result.usedForgePackage || result.usedLegacyFMLPackage)
  ) {
    result.modAnnotations.push({
      modid: guessing.modid ?? '',
      name: guessing.name ?? '',
      version: guessing.version ?? '',
      dependencies: guessing.dependencies ?? '',
      useMetadata: guessing.useMetadata ?? false,
      clientSideOnly: guessing.clientSideOnly ?? false,
      serverSideOnly: guessing.serverSideOnly ?? false,
      acceptedMinecraftVersions: guessing.acceptedMinecraftVersions ?? '',
      acceptableRemoteVersions: guessing.acceptableRemoteVersions ?? '',
      acceptableSaveVersions: guessing.acceptableSaveVersions ?? '',
      modLanguage: guessing.modLanguage ?? 'java',
      modLanguageAdapter: guessing.modLanguageAdapter ?? '',
      value: guessing.value ?? '',
    })
  }
  return result
}
/**
 * Read `mcmod.info`, `cccmod.info`, and `neimod.info` json file
 * @param mod The mod path or buffer or opened file system.
 */
export async function readForgeModJson(mod: ForgeModInput): Promise<ForgeModMcmodInfo[]> {
  const fs = await resolveFileSystem(mod)
  const all = [] as ForgeModMcmodInfo[]
  function normalize(json: Partial<ForgeModMcmodInfo>) {
    const metadata: ForgeModMcmodInfo = {
      modid: '',
      name: '',
      description: '',
      version: '',
      mcversion: '',
      url: '',
      updateUrl: '',
      updateJSON: '',
      authorList: [],
      credits: '',
      logoFile: '',
      screenshots: [],
      parent: '',
      useDependencyInformation: false,
      requiredMods: [],
      dependencies: [],
      dependants: [],
    }
    metadata.modid = json.modid ?? metadata.modid
    metadata.name = json.name ?? metadata.name
    metadata.description = json.description ?? metadata.description
    metadata.version = json.version ?? metadata.version
    metadata.mcversion = json.mcversion ?? metadata.mcversion
    metadata.url = json.url ?? metadata.url
    metadata.updateUrl = json.updateUrl ?? metadata.updateUrl
    metadata.updateJSON = json.updateJSON ?? metadata.updateJSON
    metadata.authorList = json.authorList ?? metadata.authorList
    metadata.credits = json.credits ?? metadata.credits
    metadata.logoFile = json.logoFile ?? metadata.logoFile
    metadata.screenshots = json.screenshots ?? metadata.screenshots
    metadata.parent = json.parent ?? metadata.parent
    metadata.useDependencyInformation =
      json.useDependencyInformation ?? metadata.useDependencyInformation
    metadata.requiredMods = json.requiredMods ?? metadata.requiredMods
    metadata.dependencies = json.dependencies ?? metadata.dependencies
    metadata.dependants = json.dependants ?? metadata.dependants
    return metadata
  }
  function readJsonMetadata(json: any) {
    const modList: Array<Partial<ForgeModMcmodInfo>> = []
    if (json instanceof Array) {
      modList.push(...json)
    } else if (json.modList instanceof Array) {
      modList.push(...json.modList)
    } else if (json.modid) {
      modList.push(json)
    }
    all.push(...modList.map(normalize))
  }
  if (await fs.existsFile('mcmod.info')) {
    try {
      const json = JSON.parse((await fs.readFile('mcmod.info', 'utf-8')).replace(/^\uFEFF/, ''))
      readJsonMetadata(json)
    } catch (e) {}
  } else if (await fs.existsFile('cccmod.info')) {
    try {
      const text = (await fs.readFile('cccmod.info', 'utf-8'))
        .replace(/^\uFEFF/, '')
        .replace(/\n\n/g, '\\n')
        .replace(/\n/g, '')
      const json = JSON.parse(text)
      readJsonMetadata(json)
    } catch (e) {}
  } else if (await fs.existsFile('neimod.info')) {
    try {
      const text = (await fs.readFile('neimod.info', 'utf-8'))
        .replace(/^\uFEFF/, '')
        .replace(/\n\n/g, '\\n')
        .replace(/\n/g, '')
      const json = JSON.parse(text)
      readJsonMetadata(json)
    } catch (e) {}
  } else {
    const files = await fs.listFiles('./')
    const infoFile = files.find((f) => f.endsWith('.info'))
    if (infoFile) {
      try {
        const text = (await fs.readFile(infoFile, 'utf-8'))
          .replace(/^\uFEFF/, '')
          .replace(/\n\n/g, '\\n')
          .replace(/\n/g, '')
        const json = JSON.parse(text)
        readJsonMetadata(json)
      } catch (e) {}
    }
  }
  return all
}

type ForgeModInput = Uint8Array | string | FileSystem

/**
 * Represnet a full scan of a mod file data.
 */
export interface ForgeModMetadata extends ForgeModASMData {
  /**
   * The mcmod.info file metadata. If no mcmod.info file, it will be an empty array
   */
  mcmodInfo: ForgeModMcmodInfo[]
  /**
   * The java manifest file data. If no metadata, it will be an empty object
   */
  manifest: Record<string, any>
  /**
   * The mod info extract from manfiest. If no manifest, it will be undefined!
   */
  manifestMetadata?: ManifestMetadata
  /**
   * The toml mod metadata
   */
  modsToml: ForgeModTOMLData[]
}

/**
 * Read metadata of the input mod.
 *
 * This will scan the mcmod.info file, all class file for `@Mod` & coremod `DummyModContainer` class.
 * This will also scan the manifest file on `META-INF/MANIFEST.MF` for tweak mod.
 *
 * If the input is totally not a mod. It will throw {@link NonForgeModFileError}.
 *
 * @throws {@link NonForgeModFileError}
 * @param mod The mod path or data
 * @returns The mod metadata
 */
export async function readForgeMod(mod: ForgeModInput): Promise<ForgeModMetadata> {
  const fs = await resolveFileSystem(mod)
  try {
    const jsons = await readForgeModJson(fs)
    const manifest: Record<string, any> = {}
    const manifestMetadata = await readForgeModManifest(fs, manifest)
    const tomls = await readForgeModToml(fs, manifest)
    const base = await readForgeModAsm(fs, manifest).catch(() => ({
      usedLegacyFMLPackage: false,
      usedForgePackage: false,
      usedMinecraftPackage: false,
      usedMinecraftClientPackage: false,
      modAnnotations: [],
    }))

    if (
      jsons.length === 0 &&
      (!manifestMetadata || !manifestMetadata.modid) &&
      tomls.length === 0 &&
      base.modAnnotations.length === 0
    ) {
      throw new ForgeModParseFailedError(mod, base, manifest)
    }

    const result: ForgeModMetadata = {
      mcmodInfo: jsons,
      manifest,
      manifestMetadata: manifestMetadata?.modid ? manifestMetadata : undefined,
      modsToml: tomls,
      ...base,
    }
    return result
  } finally {
    if (mod !== fs) fs.close()
  }
}

export class ForgeModParseFailedError extends Error {
  constructor(
    readonly mod: ForgeModInput,
    readonly asm: ForgeModASMData,
    readonly manifest: Record<string, any>,
  ) {
    super('Cannot find the mod metadata in the mod!')
    this.name = 'ForgeModParseFailedError'
  }
}
