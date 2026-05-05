import { FileSystem, resolveFileSystem } from '@xmcl/system'

type Person =
  | {
      /**
       * The real name, or username, of the person. Mandatory.
       */
      name: string
      /**
       *  Person's contact information. The same as upper level contact. See above. Optional.
       */
      contact?: string
    }
  | string

type Environment = 'client' | 'server' | '*'

/**
 * The `ModMetadata` is extract from `fabric.mod.json`.
 *
 * The `fabric.mod.json` file is a mod metadata file used by Fabric Loader to load mods.
 * In order to be loaded, a mod must have this file with the exact name placed in the root directory of the mod JAR.
 */
export interface FabricModMetadata {
  /* Required */
  provides?: string[]
  /**
   * Needed for internal mechanisms. Must always be 1.
   */
  schemaVersion: number
  /**
   * Defines the mod's identifier - a string of Latin letters, digits, underscores with length from 1 to 63.
   */
  id: string
  /**
   * Defines the mod's version - a string value, optionally matching the Semantic Versioning 2.0.0 specification.
   */
  version: string

  /* Mod loading */

  /**
   * Defines where mod runs: only on the client side (client mod), only on the server side (plugin) or on both sides (regular mod). Contains the environment identifier:
   * - `*` Runs everywhere. Default.
   * - `client` Runs on the client side.
   * - `server` Runs on the server side.
   */
  environment?: Environment

  /**
   * Defines main classes of your mod, that will be loaded.
   * - There are 3 default entry points for your mod:
   *  - main Will be run first. For classes implementing ModInitializer.
   *  - client Will be run second and only on the client side. For classes implementing ClientModInitializer.
   *  - server Will be run second and only on the server side. For classes implementing DedicatedServerModInitializer.
   * - Each entry point can contain any number of classes to load. Classes (or methods or static fields) could be defined in two ways:
   *  - If you're using Java, then just list the classes (or else) full names. For example:
   * ```json
   * "main": [
   *      "net.fabricmc.example.ExampleMod",
   *      "net.fabricmc.example.ExampleMod::handle"
   *  ]
   * ```
   *  - If you're using any other language, consult the language adapter's documentation. The Kotlin one is located [here](https://github.com/FabricMC/fabric-language-kotlin/blob/master/README.md).
   */
  entrypoints?: string[]

  /**
   * A list of nested JARs inside your mod's JAR to load. Before using the field, check out [the guidelines on the usage of the nested JARs](https://fabricmc.net/wiki/tutorial:loader04x#nested_jars). Each entry is an object containing file key. That should be a path inside your mod's JAR to the nested JAR. For example:
   * ```json
   * "jars": [
   *     {
   *         "file": "nested/vendor/dependency.jar"
   *     }
   * ]
   * ```
   */
  jars?: { file: string }[]
  /**
   * A dictionary of adapters for used languages to their adapter classes full names. For example:
   * ```json
   * "languageAdapters": {
   *    "kotlin": "net.fabricmc.language.kotlin.KotlinAdapter"
   * }
   * ```
   */
  languageAdapters?: string[]
  /**
   *  A list of mixin configuration files.Each entry is the path to the mixin configuration file inside your mod's JAR or an object containing following fields:
   *  - `config` The path to the mixin configuration file inside your mod's JAR.
   *  - `environment` The same as upper level `environment` field.See above. For example:
   *  ```json
   *  "mixins": [
   *       "modid.mixins.json",
   *       {
   *           "config": "modid.client-mixins.json",
   *           "environment": "client"
   *       }
   *   ]
   *  ```
   */
  mixins?: (string | { config: string; environment: Environment })[]

  /* Dependency resolution */
  /*
   * The key of each entry of the objects below is a Mod ID of the dependency.
   * The value of each key is a string or array of strings declaring supported version ranges. In the case of an array, an “OR” relationship is assumed - that is, only one range has to match for the collective range to be satisfied.
   * In the case of all versions, * is a special string declaring that any version is matched by the range. In addition, exact string matches must be possible regardless of the version type.
   */

  /**
   * For dependencies required to run. Without them a game will crash.
   */
  depends?: Record<string, string | string[]>
  /**
   * For dependencies not required to run. Without them a game will log a warning.
   */
  recommends?: Record<string, string | string[]>
  /**
   * For dependencies not required to run. Use this as a kind of metadata.
   */
  suggests?: Record<string, string | string[]>
  /**
   * For mods whose together with yours might cause a game crash. With them a game will crash.
   */
  breaks?: Record<string, string | string[]>
  /**
   * For mods whose together with yours cause some kind of bugs, etc. With them a game will log a warning.
   */
  conflicts?: Record<string, string | string[]>

  /* Metadata */

  /**
   * Defines the user-friendly mod's name. If not present, assume it matches id.
   */
  name?: string
  /**
   * Defines the mod's description. If not present, assume empty string.
   */
  description?: string
  /**
   * Defines the contact information for the project. It is an object of the following fields:
   */
  contact?: {
    /**
     * Contact e-mail pertaining to the mod. Must be a valid e-mail address.
     */
    email?: string
    /**
     * IRC channel pertaining to the mod. Must be of a valid URL format - for example: irc://irc.esper.net:6667/charset for #charset at EsperNet - the port is optional, and assumed to be 6667 if not present.
     */
    irc?: string
    /**
     * Project or user homepage. Must be a valid HTTP/HTTPS address.
     */
    homepage?: string
    /**
     * Project issue tracker. Must be a valid HTTP/HTTPS address.
     */
    issues?: string
    /**
     * Project source code repository. Must be a valid URL - it can, however, be a specialized URL for a given VCS (such as Git or Mercurial).
     * The list is not exhaustive - mods may provide additional, non-standard keys (such as discord, slack, twitter, etc) - if possible, they should be valid URLs.
     */
    sources?: string[]
  }
  /**
   * A list of authors of the mod. Each entry is a single name or an object containing following fields:
   */
  authors?: Person[]
  /**
   * A list of contributors to the mod. Each entry is the same as in author field. See above.
   */
  contributors?: Person[]
  /**
   * Defines the licensing information.Can either be a single license string or a list of them.
   * - This should provide the complete set of preferred licenses conveying the entire mod package.In other words, compliance with all listed licenses should be sufficient for usage, redistribution, etc.of the mod package as a whole.
   * - For cases where a part of code is dual - licensed, choose the preferred license.The list is not exhaustive, serves primarily as a kind of hint, and does not prevent you from granting additional rights / licenses on a case -by -case basis.
   * - To aid automated tools, it is recommended to use SPDX License Identifiers for open - source licenses.
   */
  license?: string | string[]
  /**
   * Defines the mod's icon. Icons are square PNG files. (Minecraft resource packs use 128×128, but that is not a hard requirement - a power of two is, however, recommended.) Can be provided in one of two forms:
   * - A path to a single PNG file.
   * - A dictionary of images widths to their files' paths.
   */
  icon?: string
}

/**
 * Read fabric mod metadata json from a jar file or a directory
 * @param file The jar file or directory path. I can also be the binary content of the jar if you have already read the jar.
 */
export async function readFabricMod(
  file: FileSystem | string | Uint8Array,
): Promise<FabricModMetadata> {
  const fs = await resolveFileSystem(file)
  try {
    const content = await fs.readFile('fabric.mod.json', 'utf-8')
    return JSON.parse(content.replace(/^\uFEFF/g, '').replace(/\n/g, ''))
  } finally {
    if (file !== fs) fs.close()
  }
}
