// @ts-nocheck
/* eslint-disable */

import { Camera, Mesh, PlaneGeometry, ShaderMaterial, TextureLoader, Vector2, Vector3 } from 'three'
import { UserOptions, VantaBase } from './vantaBase'
import { extend } from './vantaHelpers'

export interface Shaders {
  vertexShader?: string
  fragmentShader?: string
}

export class ShaderBase extends VantaBase {
  private fragmentShader: string
  private vertexShader: string

  constructor(userOptions: UserOptions, shaders: Shaders) {
    super(userOptions)
    this.updateUniforms = this.updateUniforms.bind(this)
    this.fragmentShader = shaders.fragmentShader || ''
    this.vertexShader = shaders.vertexShader ?? 'uniform float uTime;\nuniform vec2 uResolution;\nvoid main() {\n  gl_Position = vec4( position, 1.0 );\n}'
    const material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
    })

    const texPath = this.options.texturePath
    if (texPath) {
      this.uniforms.iTex = {
        type: 't',
        value: new TextureLoader().load(texPath),
      }
    }
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    this.scene.add(mesh)
    this.camera = new Camera()
    this.camera.position.z = 1
  }

  init() {
    this.uniforms = {
      iTime: {
        type: 'f',
        value: 1.0,
      },
      iResolution: {
        type: 'v2',
        value: new Vector2(1, 1),
      },
      iDpr: {
        type: 'f',
        value: window.devicePixelRatio || 1,
      },
      iMouse: {
        type: 'v2',
        value: new Vector2(this.mouseX || 0, this.mouseY || 0),
      },
    }
    super.init()
    this.initBasicShader()
  }

  setOptions(userOptions) {
    super.setOptions(userOptions)
    this.updateUniforms()
  }

  initBasicShader() {
    this.updateUniforms()
    if (typeof this.valuesChanger === 'function') {
      this.valuesChanger() // Some effects define this themselves
    }
  }

  updateUniforms() {
    const newUniforms = {}
    let k, v
    for (k in this.options) {
      v = this.options[k]
      if (k.toLowerCase().indexOf('color') !== -1) {
        newUniforms[k] = {
          type: 'v3',
          value: new Color(v).toVector(),
        }
      } else if (typeof v === 'number') {
        newUniforms[k] = {
          type: 'f',
          value: v,
        }
      }
    }
    return extend(this.uniforms, newUniforms)
  }

  resize() {
    super.resize()

    this.uniforms.iResolution.value.x = this.width / this.scale
    this.uniforms.iResolution.value.y = this.height / this.scale
  }
}
