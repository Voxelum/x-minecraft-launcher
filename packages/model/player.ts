import { BufferAttribute, Texture, Vector2 } from 'three'
import { DoubleSide, NearestFilter } from 'three/src/constants'
import { Object3D } from 'three/src/core/Object3D'
import { BoxGeometry } from 'three/src/geometries/BoxGeometry'
import { BoxHelper } from 'three/src/helpers/BoxHelper'
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial'
import { Color } from 'three/src/math/Color'
import { Mesh } from 'three/src/objects/Mesh'
import { CanvasTexture } from 'three/src/textures/CanvasTexture'
import format, { CubeUVMapping, ModelTemplate } from './player-model'

function convertLegacySkin(context: CanvasRenderingContext2D, width: number) {
  const scale = width / 64.0

  function copySkin(
    ctx: CanvasRenderingContext2D,
    sX: number,
    sY: number,
    w: number,
    h: number,
    dX: number,
    dY: number,
    flipHorizontal: boolean,
  ) {
    sX *= scale
    sY *= scale
    w *= scale
    h *= scale
    dX *= scale
    dY *= scale

    const imgData = ctx.getImageData(sX, sY, w, h)
    if (flipHorizontal) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w / 2; x++) {
          const index = (x + y * w) * 4
          const index2 = (w - x - 1 + y * w) * 4
          const pA1 = imgData.data[index]
          const pA2 = imgData.data[index + 1]
          const pA3 = imgData.data[index + 2]
          const pA4 = imgData.data[index + 3]

          const pB1 = imgData.data[index2]
          const pB2 = imgData.data[index2 + 1]
          const pB3 = imgData.data[index2 + 2]
          const pB4 = imgData.data[index2 + 3]

          imgData.data[index] = pB1
          imgData.data[index + 1] = pB2
          imgData.data[index + 2] = pB3
          imgData.data[index + 3] = pB4

          imgData.data[index2] = pA1
          imgData.data[index2 + 1] = pA2
          imgData.data[index2 + 2] = pA3
          imgData.data[index2 + 3] = pA4
        }
      }
    }
    ctx.putImageData(imgData, dX, dY)
  }

  copySkin(context, 4, 16, 4, 4, 20, 48, true) // Top Leg
  copySkin(context, 8, 16, 4, 4, 24, 48, true) // Bottom Leg
  copySkin(context, 0, 20, 4, 12, 24, 52, true) // Outer Leg
  copySkin(context, 4, 20, 4, 12, 20, 52, true) // Front Leg
  copySkin(context, 8, 20, 4, 12, 16, 52, true) // Inner Leg
  copySkin(context, 12, 20, 4, 12, 28, 52, true) // Back Leg
  copySkin(context, 44, 16, 4, 4, 36, 48, true) // Top Arm
  copySkin(context, 48, 16, 4, 4, 40, 48, true) // Bottom Arm
  copySkin(context, 40, 20, 4, 12, 40, 52, true) // Outer Arm
  copySkin(context, 44, 20, 4, 12, 36, 52, true) // Front Arm
  copySkin(context, 48, 20, 4, 12, 32, 52, true) // Inner Arm
  copySkin(context, 52, 20, 4, 12, 44, 52, true) // Back Arm
}

type TextureSource = string | HTMLImageElement | URL

function mapCubeUV(mesh: Mesh, src: CubeUVMapping) {
  const material = mesh.material as MeshBasicMaterial
  const texture = material.map!
  const tileUvW = 1 / texture.image.width
  const tileUvH = 1 / texture.image.height
  const uvs: Vector2[] = []
  /**
   * Set the box mesh UV to the Minecraft skin texture
   */
  function mapUV(x1: number, y1: number, x2: number, y2: number) {
    x1 *= tileUvW
    x2 *= tileUvW
    y1 = 1 - y1 * tileUvH
    y2 = 1 - y2 * tileUvH

    uvs.push(new Vector2(x1, y1), new Vector2(x2, y1), new Vector2(x1, y2), new Vector2(x2, y2))
  }

  const faces = ['left', 'right', 'top', 'bottom', 'front', 'back'] as const
  for (let i = 0; i < faces.length; i++) {
    const uvs = src[faces[i]]
    mapUV(uvs[0], uvs[1], uvs[2], uvs[3])
  }

  const fArr = new Float32Array(uvs.length * 2)
  for (let i = 0; i < uvs.length; i++) {
    fArr[i * 2] = uvs[i].x
    fArr[i * 2 + 1] = uvs[i].y
  }
  const attr = new BufferAttribute(fArr, 2)
  mesh.geometry.setAttribute('uv', attr)
}

export class PlayerObject3D extends Object3D {
  private _slim = false

  constructor(
    skin: MeshBasicMaterial,
    cape: MeshBasicMaterial,
    transparent: MeshBasicMaterial,
    slim: boolean,
  ) {
    super()
    this._slim = slim
    buildPlayerModel(this, skin, cape, transparent, slim)
  }

  get slim() {
    return this._slim
  }

  set slim(slim: boolean) {
    if (slim !== this._slim) {
      const template = slim ? format.alex : format.steve
      const leftArm = this.getObjectByName('leftArm')! as Mesh
      const rightArm = this.getObjectByName('rightArm')! as Mesh

      leftArm.geometry = new BoxGeometry(template.leftArm.w, template.leftArm.h, template.leftArm.d)
      mapCubeUV(leftArm, template.leftArm)
      rightArm.geometry = new BoxGeometry(
        template.rightArm.w,
        template.rightArm.h,
        template.rightArm.d,
      )
      mapCubeUV(rightArm, template.rightArm)

      const leftArmLayer = this.getObjectByName('leftArmLayer')! as Mesh
      const rightArmLayer = this.getObjectByName('rightArmLayer')! as Mesh
      if (leftArmLayer) {
        leftArmLayer.geometry = new BoxGeometry(
          template.leftArm.layer.w,
          template.leftArm.layer.h,
          template.leftArm.layer.d,
        )
        mapCubeUV(leftArmLayer, template.leftArm.layer)
      }
      if (rightArmLayer) {
        rightArmLayer.geometry = new BoxGeometry(
          template.rightArm.layer.w,
          template.rightArm.layer.h,
          template.rightArm.layer.d,
        )
        mapCubeUV(rightArmLayer, template.rightArm.layer)
      }
    }
    this._slim = slim
  }
}

function buildPlayerModel(
  root: Object3D,
  skin: MeshBasicMaterial,
  cape: MeshBasicMaterial,
  transparent: MeshBasicMaterial,
  slim: boolean,
): Object3D {
  const template = slim ? format.alex : format.steve
  const partsNames: Array<keyof ModelTemplate> = Object.keys(template) as any

  for (const partName of partsNames) {
    const model = template[partName]

    const mesh = new Mesh(
      new BoxGeometry(model.w, model.h, model.d),
      partName === 'cape' ? cape : skin,
    )

    mesh.name = partName
    if (model.y) {
      mesh.position.y = model.y
    }
    if (model.x) {
      mesh.position.x = model.x
    }
    if (model.z) {
      mesh.position.z = model.z
    }
    if (partName === 'cape') {
      mesh.rotation.x = 25 * (Math.PI / 180)
    }
    mapCubeUV(mesh, model)

    const box = new BoxHelper(mesh, new Color(0xffffff))
    box.name = `${partName}Box`
    box.visible = false
    mesh.add(box)

    if ('layer' in model) {
      const layer = model.layer
      const layerMesh = new Mesh(new BoxGeometry(layer.w, layer.h, layer.d), transparent)
      layerMesh.name = `${partName}Layer`
      if (layer.y) {
        layerMesh.position.y = layer.y
      }
      if (layer.x) {
        layerMesh.position.x = layer.x
      }
      if (layer.z) {
        layerMesh.position.z = layer.z
      }

      mapCubeUV(layerMesh, layer)

      mesh.add(layerMesh)
    }

    root.add(mesh)
  }

  return root
}

function ensureImage(textureSource: TextureSource) {
  if (textureSource instanceof Image) {
    return textureSource
  }
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      resolve(img)
    }
    img.onerror = (e, source, lineno, colno, error) => {
      reject(error)
    }
    if (textureSource instanceof URL) {
      img.src = textureSource.toString()
    } else {
      img.src = textureSource
    }
  })
}

export class PlayerModel {
  static create() {
    return new PlayerModel()
  }

  readonly playerObject3d: PlayerObject3D
  readonly materialPlayer: MeshBasicMaterial
  readonly materialTransparent: MeshBasicMaterial
  readonly materialCape: MeshBasicMaterial
  readonly textureCape: CanvasTexture
  readonly texturePlayer: CanvasTexture

  constructor() {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const texture = new CanvasTexture(canvas)
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
    this.texturePlayer = texture
    texture.name = 'skinTexture'

    this.materialPlayer = new MeshBasicMaterial({ map: texture })

    this.materialTransparent = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    })

    const textureCape = new CanvasTexture(document.createElement('canvas'))
    textureCape.magFilter = NearestFilter
    textureCape.minFilter = NearestFilter
    textureCape.name = 'capeTexture'
    this.textureCape = textureCape

    const materialCape = new MeshBasicMaterial({
      map: this.textureCape,
    })
    materialCape.name = 'capeMaterial'
    materialCape.visible = false
    this.materialCape = materialCape

    this.playerObject3d = new PlayerObject3D(
      this.materialPlayer,
      this.materialCape,
      this.materialTransparent,
      false,
    )
  }

  /**
   * @param skin The skin texture source. Should be url string, URL object, or a Image HTML element
   * @param isSlim Is this skin slim
   */
  async setSkin(skin: TextureSource, isSlim = false) {
    this.playerObject3d.slim = isSlim
    const texture = this.texturePlayer
    const i = await ensureImage(skin)
    const legacy = i.width !== i.height
    const canvas = texture.image
    const context = canvas.getContext('2d')
    canvas.width = i.width
    canvas.height = i.width
    context.clearRect(0, 0, i.width, i.width)
    if (legacy) {
      context.drawImage(i, 0, 0, i.width, i.width / 2.0)
      convertLegacySkin(context, i.width)
    } else {
      context.drawImage(i, 0, 0, i.width, i.width)
    }
    texture.needsUpdate = true
  }

  async setCape(cape: TextureSource | undefined) {
    if (cape === undefined) {
      this.materialCape.visible = false
      return
    }
    this.materialCape.visible = true
    const img = await ensureImage(cape)
    const texture = this.textureCape
    texture.image = img
    texture.needsUpdate = true
  }

  // name(name) {
  //     if (name === undefined || name === "" || name === null) {
  //         if (this.nameTagObject === null) { return this; }
  //         this.root.remove(this.nameTagObject);
  //         this.nameTagObject = null;
  //     }
  //     if (this.nameTagObject) { this.clear(); }
  //     // build the texture
  //     const canvas = buildNameTag(name);
  //     const texture = new Texture(canvas);
  //     texture.needsUpdate = true;
  //     // build the sprite itself
  //     const material = new SpriteMaterial({
  //         map: texture,
  //         // useScreenCoordinates: false
  //     });
  //     const sprite = new Sprite(material);
  //     this.nameTagObject = sprite;
  //     sprite.position.y = 1.15;
  //     // add sprite to the character
  //     this.root.add(this.nameTagObject);
  //     return this;
  // }

  // load(option) {
  //     if (!option) { return this; }
  //     if (option.skin) { this.loadSkin(option.skin); }
  //     if (option.cape) { this.loadCape(option.skin); }
  //     return this;
  // }

  // say(text, expire = 4) {
  //     expire *= 1000;
  //     if (this.speakExpire) {
  //         clearTimeout(this.speakExpire);
  //         this.root.remove(this.speakBox);
  //         this.speakBox = null;
  //         this.speakExpire = null;
  //     }
  //     this.speakExpire = setTimeout(() => {
  //         this.root.remove(this.speakBox);
  //         this.speakBox = null;
  //         this.speakExpire = null;
  //     }, expire);

  //     // build the texture
  //     const canvas = buildChatBox(text);
  //     const texture = new Texture(canvas);
  //     texture.needsUpdate = true;
  //     // build the sprite itself
  //     const material = new SpriteMaterial({
  //         map: texture,
  //         // useScreenCoordinates: false
  //     });
  //     const sprite = new Sprite(material);
  //     this.speakBox = sprite;
  //     sprite.scale.multiplyScalar(4);
  //     sprite.position.y = 1.5;
  //     // add sprite to the character
  //     this.root.add(this.speakBox);
  //     return this;
  // }
}

export default PlayerModel
