import { FileSystem, resolveFileSystem } from '@xmcl/system'

export interface QuiltModMetadata {
  /**
   * `1` for now
   */
  schema_version: number
  quilt_loader: QuiltLoaderData
  /**
   * e.g. "example_mod.mixins.json"
   */
  mixin?: string | string[]
}

/**
 * A dependency object defines what mods/plugins a given mod depends on or breaks.
 * It can be represented as either an object containing at least the id field, a string mod identifier in the form of either mavenGroup:modId or modId, or an array of dependency objects.
 * If an array of dependency objects is provided, the dependency matches if it matches ANY of the dependency objects for the "depends" and "unless" fields, and ALL for the "breaks" field.
 */
export interface DependencyObject {
  /**
   * A mod identifier in the form of either mavenGroup:modId or modId.
   */
  id: string

  /**
   * Should be a version specifier or array of version specifiers defining what versions this dependency applies to. If an array of versions is provided, the dependency matches if it matches ANY of the listed versions.
   *
   * @default "*"
   */
  versions?: string | string[]
  /**
   * A short, human-readable reason for the dependency object to exist.
   */
  reason?: string
  /**
   * Dependencies marked as optional will only be checked if the mod/plugin specified by the id field is present.
   */
  optional?: boolean
  /**
   * Describes situations where this dependency can be ignored. For example:
   *
   * ```
   * {
   *     "id": "sodium",
   *     "unless": "indium"
   * }
   * ```
   *
   * Game providers and loader plugins can also add their own optional fields to the dependency object for extra context when resolving dependencies. The Minecraft game provider, for instance, might define an "environment" field that can be used like so:
   *
   * ```
   * {
   *     "id": "modmenu",
   *     "environment": "client"
   * }
   * ```
   */
  unless?: DependencyObject
}

export interface QuiltLoaderData {
  /**
   * A unique identifier for the organization behind or developers of the mod. The group string must match the ^[a-zA-Z0-9-_.]+$ regular expression, and must not begin with the reserved namespace loader.plugin. It is recommended, but not required, to follow Maven's [guide to naming conventions](https://maven.apache.org/guides/mini/guide-naming-conventions.html).
   */
  group: string
  /**
   * A unique identifier for the mod or library defined by this file, matching the ^[a-z][a-z0-9-_]{1,63}$ regular expression. Best practice is that mod ID's are in snake_case.
   */
  id: string
  /**
   * An array of ProvidesObjects describing other mods/APIs that this package provides.
   */
  provides?: Array<string>
  /**
   * Must conform to the Semantic Versioning 2.0.0 specification. In a development environment, the value ${version} can be used as a placeholder by quilt-gradle to be replaced on building the resulting JAR.
   */
  version: string
  /**
   * Optional metadata that can be used by mods to display information about the mods installed.
   */
  metadata?: {
    /**
     * A human-readable name for this mod.
     */
    name?: string
    /**
     * A human-readable description of this mod. This description should be plain text, with the exception of line breaks, which can be represented with the newline character \n.
     */
    description?: string
    /**
     * A collection of key: value pairs denoting the persons or organizations that contributed to this project. The key should be the name of the person or organization, while the value can be either a string representing a single role or an array of strings each one representing a single role.
     *
     * A role can be any valid string. The "Owner" role is defined as being the person(s) or organization in charge of the project.
     */
    contributors?: Record<string, string>
    /**
     * A collection of key: value pairs denoting various contact information for the people behind this mod, with all values being strings. The following keys are officially defined, though mods can provide as many additional values as they wish:
     */
    contact?: {
      homepage?: string
      issues?: string
      sources?: string
      /**
       * Valid e-mail address for the organization/developers
       */
      email?: string
    }
    /**
     * The license or array of licenses this project operates under.
     *
     * A license is defined as either an SPDX identifier string or an object in the following form:
     *
     * ```
     * {
     *     "name": "Perfectly Awesome License v1.0",
     *     "id": "PAL-1.0",
     *     "url": "https://theperfectlyawesomelicense.com/",
     *     "description": "This license does things and stuff and says that you can do things and stuff too!"
     * }
     * ```
     */
    license?:
      | string
      | {
          name: string
          id: string
          url: string
          description?: string
        }
      | Array<string>
    /**
     * One or more paths to a square .PNG file. If an object is provided, the keys must be the resolution of the corresponding file. For example:
     *
     * ```
     * "icon": {
     *     "32": "path/to/icon32.png",
     *     "64": "path/to/icon64.png",
     *     "4096": "path/to/icon4096.png"
     * }
     * ```
     *
     * @example `assets/example_mod/icon.png`
     */
    icon?: string | Record<string, string>
  }
  /**
   * A collection of `key: value` pairs, where each key is the type of the entrypoints specified and each values is either a single entrypoint or an array of entrypoints. An entrypoint is an object with the following keys:
   *
   * - adapter — Language adapter to use for this entrypoint. By default this is `default` and tells loader to parse using the JVM entrypoint notation.
   * - value — Points to an implementation of the entrypoint. See below for the default JVM notation.
   *
   * If an entrypoint does not need to specify a language adapter other than the default language adapter, the entrypoint can be represented simply as the value string instead.
   *
   * ### JVM entrypoint notation
   *
   * When referring to a class, the binary name is used. An example of a binary name is `my.mod.MyClass$Inner`.
   *
   * One of the following `value` notations may be used in the JVM notation:
   *
   * - Implementation onto a class
   *   - The value must contain a fully qualified binary name to the class.
   *   - Implementing class must extend or implement the entrypoint interface.
   *   - Class must have a no-argument public constructor.
   *   - Example: example.mod.MainModClass
   * - A field inside of a class.
   *   - The value must contain a fully qualified binary name to the class followed by :: and a field name.
   *   - The field must be static.
   *   - The type of the field must be assignable from the field's class.
   *   - Example: example.mod.MainModClass::THE_INSTANCE
   *   - If there is ambiguity with a method's name, an exception will be thrown.
   * - A method inside of a class.
   *   - The value must contain a fully qualified binary name to the class followed by :: and a method name.
   *   - The method must be capable to implement the entrypoint type as a method reference. Generally this means classes which are functional interfaces.
   *   - Constructor requirement varies based on the method being static or instance level:
   *     - A static method does not require a public no-argument constructor.
   *     - An instance method requires a public no-argument constructor.
   *   - Example: example.mod.MainModClass::init
   *   - If there is ambiguity with a fields's name or other method, an exception will be thrown.

   */
  entrypoints?: Record<string, string>

  /**
   * An array of loader plugins. A plugin is an object with the following keys:
   *
   * - adapter — Language adapter to use for this plugin
   * - value — Points to an implementation of the `LoaderPlugin` interface. Can be in either of the following forms:
   *   - `my.package.MyClass` — A class to be instantiated and used
   *   - `my.package.MyClass::thing` — A static field containing an instance of a `LoaderPlugin`
   *
   * If a plugin does not need to specify a language adapter other than the default language adapter, the plugin can be represented simply as the value string instead.
   */
  plugins?: Array<string>

  /**
   * A list of paths to nested JAR files to load, relative to the root directory inside of the mods JAR.
   */
  jars?: Array<string>

  /**
   * A collection of `key: value` pairs, where each key is the namespace of a language adapter and the value is an implementation of the `LanguageAdapter` interface.
   */
  language_adapters?: Record<string, string>

  /**
   * An array of dependency objects. Defines mods that this mod will not function without.
   */
  depends?: Array<DependencyObject>

  /**
   * An array of dependency objects. Defines mods that this mod either breaks or is broken by.
   */
  breaks?: Array<DependencyObject>

  /**
   * Influences whether or not a mod candidate should be loaded or not. May be any of these values:
   *
   * - "always" (default for mods directly in the mods folder)
   * - "if_possible"
   * - "if_required" (default for jar-in-jar mods)
   *
   * This doesn't affect mods directly placed in the mods folder.
   *
   * ##### Always
   * If any versions of this mod are present, then one of them will be loaded. Due to how mod loading actually works if any of the different versions of this mod are present, and one of them has "load_type" set to "always", then all of them are treated as it being set to "always".
   *
   * ##### If Possible
   * If this mod can be loaded, then it will - otherwise it will silently not be loaded.
   *
   * ##### If Required
   * If this mod is in another mods "depends" field then it will be loaded, otherwise it will silently not be loaded.
   */
  load_type?: string

  /**
   * A list of Maven repository URL strings where dependencies can be looked for in addition to Quilt's central repository.
   */
  repositories?: Array<string>

  /**
   * The intermediate mappings used for this mod. The intermediate mappings string must be a valid maven coordinate and match the ^[a-zA-Z0-9-_.]+:[a-zA-Z0-9-_.]+$ regular expression. This field currently only officially supports org.quiltmc:hashed and net.fabricmc:intermediary.
   *
   * @default "org.quiltmc:hashed"
   */
  intermediate_mappings?: string

  minecraft?: {
    /**
     * Defines the environment(s) that this mod should be loaded on. Valid values are:
     *
     * - `*` — All environments (default)
     * - `client` — The physical client
     * - `dedicated_server` — The dedicated server
     */
    environment?: string
    /**
     * A single or array of paths to access widener files relative to the root of the mod JAR.
     */
    access_widener?: string | string[]
  }
}

/**
 * Read fabric mod metadata json from a jar file or a directory
 * @param file The jar file or directory path. I can also be the binary content of the jar if you have already read the jar.
 */
export async function readQuiltMod(
  file: FileSystem | string | Uint8Array,
): Promise<QuiltModMetadata> {
  const fs = await resolveFileSystem(file)
  try {
    const content = await fs.readFile('quilt.mod.json', 'utf-8')
    return JSON.parse(content.replace(/^\uFEFF/g, '').replace(/\n/g, ''))
  } finally {
    if (fs !== file) fs.close()
  }
}
