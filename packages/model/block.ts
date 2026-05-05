import { BlockModel, PackMeta } from '@xmcl/resourcepack'
import { Material } from 'three/src/materials/Material'
import { LinearFilter, NearestFilter } from 'three/src/constants'
import { Object3D } from 'three/src/core/Object3D'
import { TextureLoader } from 'three/src/loaders/TextureLoader'
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial'
import { MeshLambertMaterial } from 'three/src/materials/MeshLambertMaterial'
import { Mesh } from 'three/src/objects/Mesh'
import { Group } from 'three/src/objects/Group'
import { BoxGeometry } from 'three/src/geometries/BoxGeometry'
import { Vector3 } from 'three/src/math/Vector3'
import { Vector2 } from 'three/src/math/Vector2'
import { BufferAttribute } from 'three/src/core/BufferAttribute'
import type { Texture } from 'three/src/textures/Texture'

interface TextureData {
  url: string
  animation?: PackMeta.Animation
}

export interface TextureManager {
  hasTexture(path: string): boolean
  loadTexture(path: string): Texture
}

export class BasicTextureManager implements TextureManager {
  constructor(
    private textures: Record<string, TextureData> = {},
    private loader = new TextureLoader(),
  ) {}

  hasTexture(path: string): boolean {
    return !!this.textures[path]
  }

  loadTexture(path: string): Texture {
    const texture = this.loader.load(this.textures[path].url)

    // sharp pixels and smooth edges
    texture.magFilter = NearestFilter
    texture.minFilter = LinearFilter

    return texture
  }
}

export const DEFAULT_TRANSFORM: BlockModel.Transform = {
  rotation: [0, 0, 0],
  translation: [0, 0, 0],
  scale: [1, 1, 1],
}
export const DEFAULT_DISPLAY: BlockModel.Display = {
  ground: DEFAULT_TRANSFORM,
  gui: DEFAULT_TRANSFORM,
  thirdperson_lefthand: DEFAULT_TRANSFORM,
  thirdperson_righthand: DEFAULT_TRANSFORM,
  firstperson_lefthand: DEFAULT_TRANSFORM,
  firstperson_righthand: DEFAULT_TRANSFORM,
  fixed: DEFAULT_TRANSFORM,
  head: DEFAULT_TRANSFORM,
}
export const BUILTIN_GENERATED: BlockModel.Resolved = {
  display: DEFAULT_DISPLAY,
  ambientocclusion: false,
  textures: {},
  elements: [
    {
      from: [0, 0, 0],
      to: [16, 16, 16],
      faces: {
        down: { uv: [0, 0, 16, 16], texture: '' },
      },
    },
  ],
  overrides: [],
}

function findRealTexturePath(model: BlockModel.Resolved, variantKey: string) {
  let texturePath = model.textures[variantKey] as string
  while (texturePath.startsWith('#')) {
    const next = model.textures[texturePath.substring(1, texturePath.length)]
    if (!next) {
      return undefined
    }
    texturePath = next
  }
  return texturePath
}

export class BlockModelObject extends Object3D {
  animationLoop = false
  displayOption: BlockModel.Display = DEFAULT_DISPLAY

  applyDisplay(option: string) {
    const group = this.children[0]

    if (option === 'block') {
      // reset transformations
      group.rotation.set(0, 0, 0)
      group.position.set(0, 0, 0)
      group.scale.set(1, 1, 1)
    } else {
      if (!(option in this.displayOption)) {
        throw new Error('Display option is invalid.')
      }

      const options = (this.displayOption as any)[option]

      const rot = options.rotation
      const pos = options.translation
      const scale = options.scale

      // apply transformations
      group.rotation.set(
        (rot[0] * Math.PI) / 180,
        (rot[1] * Math.PI) / 180,
        (rot[2] * Math.PI) / 180,
      )
      group.position.set(pos[0], pos[1], pos[2])
      group.scale.set(
        scale[0] === 0 ? 0.00001 : scale[0],
        scale[1] === 0 ? 0.00001 : scale[1],
        scale[2] === 0 ? 0.00001 : scale[2],
      )
    }
  }

  getCenter() {
    const group = this.children[0]

    // compute absolute bounding box
    const box = {
      minx: 0,
      miny: 0,
      minz: 0,
      maxx: 0,
      maxy: 0,
      maxz: 0,
    }

    for (let i = 0; i < group.children.length; i++) {
      const pivot = group.children[i]
      const mesh = pivot.children[0] as Mesh
      const geo = mesh.geometry as BoxGeometry

      // for (let j = 0; j < geo.vertices.length; j++) {
      //     // convert vertex coordinates to world coordinates
      //     const vertex = geo.vertices[j].clone();
      //     const abs = mesh.localToWorld(vertex);

      //     // update bounding box

      //     if (abs.x < box.minx) { box.minx = abs.x; }
      //     if (abs.y < box.miny) { box.miny = abs.y; }
      //     if (abs.z < box.minz) { box.minz = abs.z; }

      //     if (abs.x > box.maxx) { box.maxx = abs.x; }
      //     if (abs.y > box.maxy) { box.maxy = abs.y; }
      //     if (abs.z > box.maxz) { box.maxz = abs.z; }
      // }
    }

    // return the center of the bounding box

    return new Vector3(
      (box.minx + box.maxx) / 2,
      (box.miny + box.maxy) / 2,
      (box.minz + box.maxz) / 2,
    )
  }
}

export class BlockModelFactory {
  static TRANSPARENT_MATERIAL = new MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    alphaTest: 0.5,
  })

  private cachedMaterial: Record<string, Material> = {}

  constructor(
    readonly textureManager: TextureManager,
    readonly option: { clipUVs?: boolean; modelOnly?: boolean } = {},
  ) {}

  /**
   * Get threejs `Object3D` for that block model.
   */
  getObject(
    model: BlockModel.Resolved,
    options: { uvlock?: boolean; y?: number; x?: number } = {},
    fix = 0.001,
  ) {
    const xRotation = options.x || 0
    const yRotation = options.y || 0
    const uvlock = options.uvlock || false

    const option = this.option
    const textureManager = this.textureManager

    const clipUVs = option.clipUVs || false
    const modelOnly = option.modelOnly || false

    const obj = new BlockModelObject()
    const group = new Group()
    group.name = 'wrapper'

    const materials: Material[] = [BlockModelFactory.TRANSPARENT_MATERIAL]
    const materialIndexes: { [variant: string]: number } = {}

    const materialPathIndexes: { [texPath: string]: number } = {}
    for (const variant of Object.keys(model.textures)) {
      const texPath = findRealTexturePath(model, variant)
      let materialIndex = 0

      if (!texPath) {
        console.error(`Cannot find texture @${texPath}`)
      } else {
        let materialPathIndex = materialPathIndexes[texPath]
        if (materialPathIndex) {
          // noop
        } else if (texPath in this.cachedMaterial) {
          materialPathIndex = materials.length
          materials.push(this.cachedMaterial[texPath])
        } else if (textureManager.hasTexture(texPath)) {
          // build new material
          const texture = textureManager.loadTexture(texPath)

          // map texture to material, keep transparency and fix transparent z-fighting
          const mat = new MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.5 })

          materialPathIndex = materials.length
          this.cachedMaterial[texPath] = mat

          mat.name = texPath

          materials.push(mat)
        }
        materialPathIndexes[texPath] = materialPathIndex
        materialIndex = materialPathIndex
      }

      materialIndexes[variant] = materialIndex
    }

    for (const element of model.elements) {
      // get dimensions and origin
      const width = element.to[0] - element.from[0]
      const height = element.to[1] - element.from[1]
      const length = element.to[2] - element.from[2]

      const origin = {
        x: (element.to[0] + element.from[0]) / 2 - 8,
        y: (element.to[1] + element.from[1]) / 2 - 8,
        z: (element.to[2] + element.from[2]) / 2 - 8,
      }

      const blockGeometry = new BoxGeometry(width + fix, height + fix, length + fix)
      const blockMesh = new Mesh(blockGeometry, materials)
      blockMesh.name = 'block-element'
      blockGeometry.clearGroups()

      blockMesh.position.x = origin.x
      blockMesh.position.y = origin.y
      blockMesh.position.z = origin.z

      const uvAttr: number[] = []

      const faces = ['east', 'west', 'up', 'down', 'south', 'north'] as const

      const getDefaultUv = (i: number) =>
        [
          [
            // east
            element.from[2],
            element.from[1],
            element.to[2],
            element.to[1],
          ],
          [
            // west
            element.from[2],
            element.from[1],
            element.to[2],
            element.to[1],
          ],
          [
            // up
            element.from[0],
            element.from[2],
            element.to[0],
            element.to[2],
          ],
          [
            // down
            element.from[0],
            element.from[2],
            element.to[0],
            element.to[2],
          ],
          [
            // south
            element.from[0],
            element.from[1],
            element.to[0],
            element.to[1],
          ],
          [
            // north
            element.from[0],
            element.from[1],
            element.to[0],
            element.to[1],
          ],
        ][i]

      for (let i = 0; i < 6; i++) {
        const faceName = faces[i]
        const face = element.faces[faceName]
        let materialIndex = 0
        let uv: number[]
        if (face) {
          // get material index
          materialIndex = materialIndexes[face.texture.substring(1, face.texture.length)] // references.indexOf(ref[0] == '#' ? ref.substring(1) : ref)

          uv = face.uv || getDefaultUv(i)

          if (clipUVs) {
            uv = uv.map((e) => {
              if (e + 0.00001 < 0) {
                return 0
              } else if (e - 0.00001 > 16) {
                return 16
              } else {
                return e
              }
            })
          }

          uv = uv.map((e) => e / 16)
        } else {
          uv = [0, 0, 1, 1]
          // transparent material
        }
        const [x1, y1, x2, y2] = uv
        let map = [
          new Vector2(x1, y2),
          new Vector2(x2, y2),
          new Vector2(x1, y1),
          new Vector2(x2, y1),
        ]

        if (face && face.rotation) {
          let amount = Number(face.rotation)
          // check property
          if (!([0, 90, 180, 270].indexOf(amount) >= 0)) {
            console.error(
              'The "rotation" property for "' + face + '" face is invalid (got "' + amount + '").',
            )
          }

          amount = (360 - amount) % 360

          // rotate map
          for (let j = 0; j < amount / 90; j++) {
            map = [map[1], map[3], map[0], map[2]]
          }
        }

        if (uvlock) {
          let rotation = 0
          if (xRotation >= 180) {
            if (faceName === 'up') {
              rotation = yRotation
            } else if (faceName === 'down') {
              rotation = (360 - yRotation) % 360
            } else {
              rotation = xRotation
            }
          } else {
            if (faceName === 'down') {
              rotation = yRotation
            } else if (faceName === 'up') {
              rotation = (360 - yRotation) % 360
            } else {
              rotation = xRotation
            }
          }

          for (let j = 0; j < rotation / 90; j++) {
            for (let m = 0; m < map.length; m++) {
              const vector = map[m]
              const x = vector.x
              const y = vector.y

              vector.x = 1 - y
              vector.y = x
            }
          }
        }

        uvAttr.push(map[0].x, map[0].y, map[1].x, map[1].y, map[2].x, map[2].y, map[3].x, map[3].y)
        blockGeometry.addGroup(i * 6, 6, materialIndex)
        // blockGeometry.uvsNeedUpdate = true;
      }
      blockGeometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvAttr), 2))

      /**
       * bake rotation start
       */
      if (element.rotation) {
        // get origin, axis and angle
        const rotationOrigin = {
          x: element.rotation.origin[0] - 8,
          y: element.rotation.origin[1] - 8,
          z: element.rotation.origin[2] - 8,
        }

        const axis = element.rotation.axis
        const angle = element.rotation.angle

        // create pivot
        const pivot = new Group()
        pivot.name = 'pivot'
        pivot.position.x = rotationOrigin.x
        pivot.position.y = rotationOrigin.y
        pivot.position.z = rotationOrigin.z

        pivot.add(blockMesh)

        // adjust mesh coordinates
        blockMesh.position.x -= rotationOrigin.x
        blockMesh.position.y -= rotationOrigin.y
        blockMesh.position.z -= rotationOrigin.z

        // rotate pivot
        if (axis === 'x') {
          pivot.rotateX((angle * Math.PI) / 180)
        } else if (axis === 'y') {
          pivot.rotateY((angle * Math.PI) / 180)
        } else if (axis === 'z') {
          pivot.rotateZ((angle * Math.PI) / 180)
        }

        const rescale = element.rotation.rescale || false
        if (rescale) {
          if (angle % 90 === 45) {
            if (axis === 'x') {
              pivot.scale.y *= Math.sqrt(2)
              pivot.scale.z *= Math.sqrt(2)
            }
            if (axis === 'y') {
              pivot.scale.x *= Math.sqrt(2)
              pivot.scale.z *= Math.sqrt(2)
            }
            if (axis === 'z') {
              pivot.scale.x *= Math.sqrt(2)
              pivot.scale.y *= Math.sqrt(2)
            }
          }
        }

        group.add(pivot)
      } else {
        const pivot = new Group()
        pivot.name = 'pivot'
        pivot.add(blockMesh)
        group.add(pivot)
      }
    }

    obj.rotateY((-yRotation * Math.PI) / 180)
    obj.rotateX((-xRotation * Math.PI) / 180)

    obj.add(group)

    return obj
  }
}
