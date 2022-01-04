// @ts-nocheck
/* eslint-disable */

import { Camera, Color, IUniform, PerspectiveCamera, Scene, Texture, Vector2, Vector3, WebGLRenderer } from 'three'
import { extend, mobileCheck as isMobile, q, color2Hex } from './vantaHelpers'
// const DEBUGMODE = window.location.toString().indexOf('VANTADEBUG') !== -1

// const win = typeof window == 'object'
// let THREE = (win && window.THREE) || {}
// if (win && !window.VANTA) window.VANTA = {}
// const VANTA = (win && window.VANTA) || {}
// VANTA.register = (name, Effect) => {
//   return VANTA[name] = (opts) => new Effect(opts)
// }
// VANTA.version = '0.5.21'

// export { VANTA }

// const ORBITCONTROLS = {
//   enableZoom: false,
//   userPanSpeed: 3,
//   userRotateSpeed: 2.0,
//   maxPolarAngle: Math.PI * 0.8, // (pi/2 is pure horizontal)
//   mouseButtons: {
//     ORBIT: THREE.MOUSE.LEFT,
//     ZOOM: null,
//     PAN: null
//   }
// }
// if (DEBUGMODE) {
//   extend(ORBITCONTROLS, {
//     enableZoom: true,
//     zoomSpeed: 4,
//     minDistance: 100,
//     maxDistance: 4500
//   })
// }

// Namespace for errors

export interface UserOptions {
  mouseControls?: boolean
  touchControls?: boolean
  gyroControls?: boolean
  mouseEase?: boolean
  minHeight?: number
  minWidth?: number
  scale?: number
  scaleMobile?: number
  backgroundAlpha?: number
  speed?: number
  backgroundColor?: string | number | Color
  forceAnimate?: boolean
}

export abstract class VantaBase {
  camera: Camera
  renderer: WebGLRenderer
  scene: Scene
  mouseX: number
  mouseY: number
  height: number
  width: number
  scale = 1
  mouseEaseX: number
  mouseEaseY: number
  el: HTMLElement

  options: Required<UserOptions>
  uniforms: Record<string, IUniform> = {}
  t = 0
  t2 = 0
  req = 0

  constructor(userOptions: UserOptions) {
    const defaultOptions = this.getDefaultOptions()
    this.options = {
      mouseControls: userOptions.mouseControls ?? defaultOptions.mouseControls,
      touchControls: userOptions.touchControls ?? defaultOptions.touchControls,
      gyroControls: userOptions.gyroControls ?? defaultOptions.gyroControls,
      minHeight: userOptions.minHeight ?? defaultOptions.minHeight,
      minWidth: userOptions.minWidth ?? defaultOptions.minWidth,
      scale: userOptions.scale ?? defaultOptions.scale,
      scaleMobile: userOptions.scaleMobile ?? defaultOptions.scaleMobile,
      mouseEase: userOptions.mouseEase ?? defaultOptions.mouseEase,
      backgroundAlpha: userOptions.backgroundAlpha ?? defaultOptions.backgroundAlpha,
      speed: userOptions.speed ?? defaultOptions.speed,
    }
  }

  mount(el: HTMLElement) {
    this.el = el

    this.prepareEl()

    this.renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
    })

    this.scene = new Scene()

    const canvas = this.renderer.domElement
    this.el.appendChild(canvas)
    extend(canvas.style, {
      position: 'absolute',
      zIndex: 0,
      top: 0,
      left: 0,
      background: '',
    })
    canvas.classList.add('vanta-canvas')

    this.calculateSize() // Init needs size

    try {
      this.init()
    } catch (e) {
      // FALLBACK - just use color
      // error('Init error', e)
      if (this.renderer && this.renderer.domElement) {
        this.el.removeChild(this.renderer.domElement)
      }
      if (this.options.backgroundColor) {
        console.log('[VANTA] Falling back to backgroundColor')
        this.el.style.background = color2Hex(this.options.backgroundColor)
      }
      return
    }

    // After init

    // Init mouseX and mouseY
    if ((!this.mouseX && !this.mouseY) ||
      (this.mouseX === this.options.minWidth / 2 && this.mouseY === this.options.minHeight / 2)) {
      this.mouseX = this.width / 2
      this.mouseY = this.height / 2
      this.triggerMouseMove(this.mouseX, this.mouseY)
    }
    this.resize()
    this.render()

    // Event listeners
    window.addEventListener('resize', this.resize.bind(this))
    window.requestAnimationFrame(this.resize) // Force a resize after the first frame

    // Add event listeners on window, because this element may be below other elements, which would block the element's own mousemove event
    if (this.options.mouseControls) {
      window.addEventListener('scroll', this.windowMouseMoveWrapper)
      window.addEventListener('mousemove', this.windowMouseMoveWrapper)
    }
    if (this.options.touchControls) {
      window.addEventListener('touchstart', this.windowTouchWrapper)
      window.addEventListener('touchmove', this.windowTouchWrapper)
    }
    if (this.options.gyroControls) {
      window.addEventListener('deviceorientation', this.windowGyroWrapper)
    }
  }

  setOptions(userOptions = {}) {
    extend(this.options, userOptions)
    this.triggerMouseMove()
  }

  protected getDefaultOptions(): Required<UserOptions> {
    return {
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minWidth: 200,
      minHeight: 200,
      scaleMobile: 1,
      scale: 1,
      mouseEase: false,
      backgroundAlpha: 1,
      speed: 1,
    }
  }

  prepareEl() {
    let i, child
    // wrapInner for text nodes, so text nodes can be put into foreground
    if (typeof Node !== 'undefined' && Node.TEXT_NODE) {
      for (i = 0; i < this.el.childNodes.length; i++) {
        const n = this.el.childNodes[i]
        if (n.nodeType === Node.TEXT_NODE) {
          const s = document.createElement('span')
          s.textContent = n.textContent
          n.parentElement?.insertBefore(s, n)
          n.remove()
        }
      }
    }
    // Set foreground elements
    for (i = 0; i < this.el.children.length; i++) {
      child = this.el.children[i]
      if (!(child instanceof HTMLElement)) {
        continue
      }
      if (getComputedStyle(child).position === 'static') {
        child.style.position = 'relative'
      }
      if (getComputedStyle(child).zIndex === 'auto') {
        child.style.zIndex = '1'
      }
    }
    // Set canvas and container style
    if (getComputedStyle(this.el).position === 'static') {
      this.el.style.position = 'relative'
    }
  }

  applyCanvasStyles(canvasEl, opts = {}) {
    extend(canvasEl.style, {
      position: 'absolute',
      zIndex: 0,
      top: 0,
      left: 0,
      background: '',
    })
    extend(canvasEl.style, opts)
    canvasEl.classList.add('vanta-canvas')
  }

  getCanvasElement() {
    if (this.renderer) {
      return this.renderer.domElement // three.js
    }
  }

  getCanvasRect() {
    const canvas = this.getCanvasElement()
    if (!canvas) return undefined
    return canvas.getBoundingClientRect()
  }

  private windowMouseMoveWrapper = (e: MouseEvent) => {
    const rect = this.getCanvasRect()
    if (!rect) return false
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      this.mouseX = x
      this.mouseY = y
      if (!this.options.mouseEase) this.triggerMouseMove(x, y)
    }
  }

  private windowTouchWrapper = (e: TouchEvent) => {
    const rect = this.getCanvasRect()
    if (!rect) return false
    if (e.touches.length === 1) {
      const x = e.touches[0].clientX - rect.left
      const y = e.touches[0].clientY - rect.top
      if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
        this.mouseX = x
        this.mouseY = y
        if (!this.options.mouseEase) this.triggerMouseMove(x, y)
      }
    }
  }

  private windowGyroWrapper = (e: DeviceOrientationEvent) => {
    const rect = this.getCanvasRect()
    if (!rect) return false
    const x = Math.round(e.alpha ?? 0 * 2) - rect.left
    const y = Math.round(e.beta ?? 0 * 2) - rect.top
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      this.mouseX = x
      this.mouseY = y
      if (!this.options.mouseEase) this.triggerMouseMove(x, y)
    }
  }

  private triggerMouseMove(x?: number, y?: number) {
    if (x === undefined || y === undefined) { // trigger at current position
      if (this.options.mouseEase) {
        x = this.mouseEaseX
        y = this.mouseEaseY
      } else {
        x = this.mouseX
        y = this.mouseY
      }
    }
    if (this.uniforms) {
      this.uniforms.iMouse.value.x = x / this.scale // pixel values
      this.uniforms.iMouse.value.y = y / this.scale // pixel values
    }
    const xNorm = x / this.width // 0 to 1
    const yNorm = y / this.height // 0 to 1
    this.onMouseMove(xNorm, yNorm)
  }

  protected abstract onMouseMove(x: number, y: number): void

  calculateSize() {
    if (isMobile() && this.options.scaleMobile) {
      this.scale = this.options.scaleMobile
    } else if (this.options.scale) {
      this.scale = this.options.scale
    }
    this.width = Math.max(this.el.offsetWidth, this.options.minWidth)
    this.height = Math.max(this.el.offsetHeight, this.options.minHeight)
  }

  resize() {
    this.calculateSize()
    if (this.camera) {
      if (this.camera instanceof PerspectiveCamera) {
        this.camera.aspect = this.width / this.height
        this.camera.updateProjectionMatrix()
      }
    }
    if (this.renderer) {
      this.renderer.setSize(this.width, this.height)
      this.renderer.setPixelRatio(window.devicePixelRatio / this.scale)
    }
  }

  isOnScreen() {
    const elHeight = this.el.offsetHeight
    const elRect = this.el.getBoundingClientRect()
    const scrollTop = (window.pageYOffset ||
      (document.documentElement || document.body.parentNode || document.body).scrollTop
    )
    const offsetTop = elRect.top + scrollTop
    const minScrollTop = offsetTop - window.innerHeight
    const maxScrollTop = offsetTop + elHeight
    return minScrollTop <= scrollTop && scrollTop <= maxScrollTop
  }

  render = () => {
    // Step time
    this.t += 1
    // Uniform time
    this.t2 += this.options.speed
    if (this.uniforms) {
      this.uniforms.iTime.value = this.t2 * 0.016667 // iTime is in seconds
    }

    if (this.options.mouseEase) {
      this.mouseEaseX = this.mouseEaseX || this.mouseX || 0
      this.mouseEaseY = this.mouseEaseY || this.mouseY || 0
      if (Math.abs(this.mouseEaseX - this.mouseX) + Math.abs(this.mouseEaseY - this.mouseY) > 0.1) {
        this.mouseEaseX += (this.mouseX - this.mouseEaseX) * 0.05
        this.mouseEaseY += (this.mouseY - this.mouseEaseY) * 0.05
        this.triggerMouseMove(this.mouseEaseX, this.mouseEaseY)
      }
    }

    // Only animate if element is within view
    if (this.isOnScreen() || this.options.forceAnimate) {
      this.onUpdate()
      if (this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera)
        this.renderer.setClearColor(this.options.backgroundColor, this.options.backgroundAlpha)
      }
      // if (this.fps && this.fps.update) this.fps.update()
    }
    return this.req = window.requestAnimationFrame(this.render)
  }

  protected abstract onUpdate(): void

  // setupControls() {
  //   if (DEBUGMODE && THREE.OrbitControls) {
  //     this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement)
  //     extend(this.controls, ORBITCONTROLS)
  //     return this.scene.add(new THREE.AxisHelper(100))
  //   }
  // }

  restart() {
    // Restart the effect without destroying the renderer
    if (this.scene) {
      while (this.scene.children.length) {
        this.scene.remove(this.scene.children[0])
      }
    }
    // if (typeof this.onRestart === "function") {
    //   this.onRestart()
    // }
    this.init()
  }

  init() {
    // if (typeof this.onInit === "function") {
    //   this.onInit()
    // }
    // this.setupControls()
  }

  dispose() {
    // if (typeof this.onDestroy === "function") {
    //   this.onDestroy()
    // }
    window.removeEventListener('touchstart', this.windowTouchWrapper)
    window.removeEventListener('touchmove', this.windowTouchWrapper)
    window.removeEventListener('scroll', this.windowMouseMoveWrapper)
    window.removeEventListener('mousemove', this.windowMouseMoveWrapper)
    window.removeEventListener('deviceorientation', this.windowGyroWrapper)
    window.removeEventListener('resize', this.resize)
    window.cancelAnimationFrame(this.req)

    if (this.renderer) {
      if (this.renderer.domElement) {
        this.el.removeChild(this.renderer.domElement)
      }
      this.renderer.dispose()
      this.scene.clear()
    }
  }
}
