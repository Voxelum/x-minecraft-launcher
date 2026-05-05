/**
 * The pack meta json format
 */
export interface PackMeta {
  texture?: PackMeta.Texture
  animation?: PackMeta.Animation
  pack?: PackMeta.Pack
  language: PackMeta.Language
}

/**
 * The block model json format
 */
export interface BlockModel {
  /**
   * For Block:
   *
   * Loads a different model from the given path, starting in assets/minecraft/models. If both "parent" and "elements" are set, the "elements" tag overrides the "elements" tag from the previous model.
   * Can be set to "builtin/generated" to use a model that is created out of the specified icon. Note that only the first layer is supported, and rotation can only be achieved using block states files.
   *
   * For Item:
   *
   * Loads a different model from the given path, starting in assets/minecraft/models. If both "parent" and "elements" are set, the "elements" tag overrides the "elements" tag from the previous model.
   * Can be set to "builtin/generated" to use a model that is created out of the specified icon.
   * Can be set to "builtin/entity" to load a model from an entity file. As you can not specify the entity, this does not work for all items (only for chests, ender chests, mob heads, shields and banners).
   * Needs to be set to "builtin/compass" or "builtin/clock" for the compass and the clock.
   */
  parent?: string

  ambientocclusion?: boolean
  /**
   * Holds the different places where item models are displayed.
   */
  display?: BlockModel.Display
  /**
   * Holds the textures of the model. Each texture starts in assets/minecraft/textures or can be another texture variable.
   */
  textures?: {
    /**
     * What texture to load particles from. This texture is used if you are in a nether portal. Note: All breaking particles from non-model blocks are hard-coded.
     */
    particle?: string
    [variant: string]: string | undefined
  }

  /**
   * Contains all the elements of the model. they can only have cubic forms. If both "parent" and "elements" are set, the "elements" tag overrides the "elements" tag from the previous model.
   */
  elements?: BlockModel.Element[]
  /**
   * Determines cases which a different model should be used based on item tags.
   * All cases are evaluated in order from top to bottom and last predicate that mathches will override.
   * However, overrides are ignored if it has been already overriden once, for example this avoids recursion on overriding to the same model.
   */
  overrides?: Array<{
    /**
     * predicate: Holds the cases.
     */
    prediction: { [attribute: string]: number }
    /**
     * The path to the model to use if the case is met, starting in assets/minecraft/models/
     */
    model: string
  }>
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace PackMeta {
  export interface Language {
    /**
     * Language code for a language, corresponding to a .json file with the same name in the folder assets/<namespace>/lang.
     */
    [lang: string]: {
      /**
       * The full name of the language
       */
      name: string
      /**
       * The country or region name
       */
      region: string
      /**
       * If true, the language reads right to left.
       */
      bidirectional: boolean
    }
  }
  /**
   * Holds the resource pack information
   */
  export interface Pack {
    /**
     * Pack version. If this number does not match the current required number, the resource pack will display an error and required additional confirmation to load the pack.
     * Requires 1 for 1.6.1–1.8.9, 2 for 1.9–1.10.2, 3 for 1.11–1.12.2, and 4 for 1.13–1.14.4.
     */
    pack_format: number
    /**
     * Text that will be shown below the pack name in the resource pack menu.
     * The text will be shown on two lines. If the text is too long it will be cut off.
     *
     * Contains a raw JSON text object that will be shown instead as the pack description in the resource pack menu.
     * Same behavior as the string version of the description tag, but they cannot exist together.[
     */
    description: string | object
  }

  export interface Animation {
    /**
     * If true, Minecraft will generate additional frames between frames with a frame time greater than 1 between them. Defaults to false.
     */
    interpolate: boolean
    /**
     * The width of the tile, as a direct ratio rather than in pixels. This is unused in vanilla but can be used by mods to have frames that are not perfect squares.
     */
    width: number
    /**
     * The height of the tile in direct pixels, as a ratio rather than in pixels. This is unused in vanilla but can be used by mods to have frames that are not perfect squares.
     */
    height: number
    /**
     * Sets the default time for each frame in increments of one game tick. Defaults to `1`.
     */
    frametime: number
    frames: Array<{ index: number; time: number }>
  }

  export interface Texture {
    /**
     * Causes the texture to blur when viewed from close up. Defaults to `false`
     */
    blur: boolean
    /**
     * Causes the texture to stretch instead of tiling in cases where it otherwise would, such as on the shadow. Defaults to `false`
     */
    clamp: boolean
    /**
     * Custom mipmap values for the texture
     */
    mipmaps: string[]
  }
}

type Vec3 = [number, number, number]
type Vec4 = [number, number, number, number]

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BlockModel {
  export type Direction = 'up' | 'down' | 'north' | 'south' | 'west' | 'east'

  export interface Display {
    thirdperson_righthand: Transform
    thirdperson_lefthand: Transform
    firstperson_righthand: Transform
    firstperson_lefthand: Transform
    gui: Transform
    head: Transform
    ground: Transform
    fixed: Transform
  }
  export interface Element {
    /**
     * Start point of a cube according to the scheme [x, y, z]. Values must be between -16 and 32.
     */
    from: Vec3
    /**
     * Stop point of a cube according to the scheme [x, y, z]. Values must be between -16 and 32.
     */
    to: Vec3
    /**
     * Defines the rotation of an element.
     */
    rotation?: {
      /**
       * Sets the center of the rotation according to the scheme [x, y, z], defaults to [8, 8, 8].
       */
      origin: Vec3
      /**
       * Specifies the direction of rotation, can be "x", "y" or "z".
       */
      axis: 'x' | 'y' | 'z'
      /**
       * Specifies the angle of rotation. Can be 45 through -45 degrees in 22.5 degree increments. Defaults to 0.
       */
      angle: number
      /**
       * Specifies whether or not to scale the faces across the whole block. Can be true or false. Defaults to false.
       */
      rescale: boolean
    }
    /**
     * Defines if shadows are rendered (true - default), not (false).
     */
    shade?: boolean
    faces?: {
      up?: Face
      down?: Face
      north?: Face
      south?: Face
      east?: Face
      west?: Face
    }
  }
  export interface Face {
    /**
     * Defines the area of the texture to use according to the scheme [x1, y1, x2, y2].
     * If unset, it defaults to values equal to xyz position of the element.
     * The texture behavior will be inconsistent if UV extends below 0 or above 16.
     * If the numbers of x1 and x2 are swapped (e.g. from 0, 0, 16, 16 to 16, 0, 0, 16), the texture will be flipped. UV is optional, and if not supplied it will automatically generate based on the element's position.
     */
    uv?: Vec4

    /**
     * Specifies the texture in form of the texture variable prepended with a #.
     */
    texture: string
    /**
     * Specifies whether a face does not need to be rendered when there is a block touching it in the specified position.
     * The position can be: down, up, north, south, west, or east. It will also determine which side of the block to use the light level from for lighting the face,
     * and if unset, defaults to the side.
     */
    cullface?: Direction

    /**
     * Rotates the texture by the specified number of degrees.
     * Can be 0, 90, 180, or 270. Defaults to 0. Rotation does not affect which part of the texture is used.
     * Instead, it amounts to permutation of the selected texture vertexes (selected implicitly, or explicitly though uv).
     */
    rotation?: 0 | 90 | 180 | 270
    /**
     * Determines whether to tint the texture using a hardcoded tint index. The default is not using the tint, and any number causes it to use tint. Note that only certain blocks have a tint index, all others will be unaffected.
     */
    tintindex?: number
  }
  export interface Transform {
    /**
     * Specifies the rotation of the model according to the scheme [x, y, z].
     */
    rotation: Vec3
    /**
     *  Specifies the position of the model according to the scheme [x, y, z]. If the value is greater than 80, it is displayed as 80. If the value is less then -80, it is displayed as -80.
     */
    translation: Vec3
    /**
     * Specifies the scale of the model according to the scheme [x, y, z]. If the value is greater than 4, it is displayed as 4.
     */
    scale: Vec3
  }
  export type Resolved = Omit<Required<BlockModel>, 'parent' | 'override' | 'elements'> & {
    overrides?: BlockModel['overrides']
    elements: Array<
      Omit<Element, 'faces'> & {
        faces: {
          up?: Face
          down?: Face
          north?: Face
          south?: Face
          east?: Face
          west?: Face
        }
      }
    >
  }
}
