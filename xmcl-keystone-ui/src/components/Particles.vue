<template>
  <div
    id="particles-js"
    :color="color"
    :particleOpacity="particleOpacity"
    :linesColor="linesColor"
    :particlesNumber="particlesNumber"
    :shapeType="shapeType"
    :particleSize="particleSize"
    :linesWidth="linesWidth"
    :lineLinked="lineLinked"
    :lineOpacity="lineOpacity"
    :linesDistance="linesDistance"
    :moveSpeed="moveSpeed"
    :hoverEffect="hoverEffect"
    :hoverMode="hoverMode"
    :clickEffect="clickEffect"
    :clickMode="clickMode"
  />
</template>
<script lang=ts setup>
import './particle'

const props = withDefaults(defineProps<{
  color?: string
  moveEnabled?: boolean
  particleOpacity?: number
  particlesNumber?: number
  shapeType?: string
  particleSize?: number
  linesColor?: string
  linesWidth?: number
  lineLinked?: boolean
  lineOpacity?: number
  linesDistance?: number
  moveSpeed?: number
  hoverEffect?: boolean
  hoverMode?: string
  opacityRandom?: boolean
  clickEffect?: boolean
  clickMode?: string
  moveDirection?: string
  moveRandom?: boolean
}>(), {
  color: '#dedede',
  moveEnabled: true,
  particleOpacity: 0.7,
  particlesNumber: 80,
  shapeType: 'circle',
  particleSize: 4,
  linesColor: '#dedede',
  linesWidth: 1,
  lineLinked: true,
  lineOpacity: 0.4,
  linesDistance: 150,
  opacityRandom: false,
  moveSpeed: 3,
  hoverEffect: true,
  hoverMode: 'grab',
  clickEffect: true,
  clickMode: 'push',
  moveDirection: 'none',
  moveRandom: false,
})

const current = () => (window as any).pJSDom[0]

watch(computed(() => props.moveEnabled), (e) => {
  const cur = current()
  if (!cur) {
    return
  }
  const pJS = cur.pJS
  pJS.particles.move.enable = e
  console.log(`enabled: ${e}`)
  if (e) {
    console.log(current())
    pJS.fn.vendors.start()
  }
})

watch(() => props.moveDirection, () => {
  const cur = current()
  if (cur) {
    const pJS = cur.pJS

    let delta: { x: number; y: number }
    switch (props.moveDirection) {
      case 'top':
        delta = { x: 0, y: -1 }
        break
      case 'top-right':
        delta = { x: 0.5, y: -0.5 }
        break
      case 'right':
        delta = { x: 1, y: -0 }
        break
      case 'bottom-right':
        delta = { x: 0.5, y: 0.5 }
        break
      case 'bottom':
        delta = { x: 0, y: 1 }
        break
      case 'bottom-left':
        delta = { x: -0.5, y: 1 }
        break
      case 'left':
        delta = { x: -1, y: 0 }
        break
      case 'top-left':
        delta = { x: -0.5, y: -0.5 }
        break
      default:
        delta = { x: 0, y: 0 }
        break
    }

    for (const p of pJS.particles.array) {
      if (pJS.particles.move.straight) {
        p.vx = delta.x
        p.vy = delta.y
        if (pJS.particles.move.random) {
          p.vx = pJS.vx * (Math.random())
          p.vy = pJS.vy * (Math.random())
        }
      } else {
        p.vx = delta.x + Math.random() - 0.5
        p.vy = delta.y + Math.random() - 0.5
      }
    }
  }
})

function initParticleJS() {
  // eslint-disable-next-line no-undef
  // @ts-ignore
  window.particlesJS('particles-js', {
    particles: {
      number: {
        value: props.particlesNumber,
        density: {
          enable: true,
          value_area: 800,
        },
      },
      color: {
        value: props.color,
      },
      shape: {
        // circle, edge, triangle, polygon, star, image
        type: props.shapeType,
        stroke: {
          width: 0,
          color: '#192231',
        },
        polygon: {
          nb_sides: 5,
        },
      },
      opacity: {
        value: props.particleOpacity,
        random: false,
        anim: {
          enable: false,
          speed: 1,
          opacity_min: 0.1,
          sync: false,
        },
      },
      size: {
        value: props.particleSize,
        random: true,
        anim: {
          enable: false,
          speed: 40,
          size_min: 0.1,
          sync: false,
        },
      },
      line_linked: {
        enable: props.lineLinked,
        distance: props.linesDistance,
        color: props.linesColor,
        opacity: props.lineOpacity,
        width: props.linesWidth,
      },
      move: {
        enable: props.moveEnabled,
        speed: props.moveSpeed,
        direction: props.moveDirection,
        random: props.moveRandom,
        straight: false,
        out_mode: 'out',
        bounce: false,
        attract: {
          enable: false,
          rotateX: 600,
          rotateY: 1200,
        },
      },
    },
    interactivity: {
      detect_on: 'canvas',
      events: {
        onhover: {
          enable: props.hoverEffect,
          mode: props.hoverMode,
        },
        onclick: {
          enable: props.clickEffect,
          mode: props.clickMode,
        },
        onresize: {
          enable: true,
          density_auto: true,
          density_area: 400,
        },
      },
      modes: {
        grab: {
          distance: 140,
          line_linked: {
            opacity: 1,
          },
        },
        bubble: {
          distance: 400,
          size: 40,
          duration: 2,
          opacity: 8,
          speed: 3,
        },
        repulse: {
          distance: 200,
          duration: 0.4,
        },
        push: {
          particles_nb: 4,
        },
        remove: {
          particles_nb: 2,
        },
      },
    },
    retina_detect: true,
  })
}

onMounted(() => {
  nextTick().then(() => {
    initParticleJS()
  })
})
</script>
