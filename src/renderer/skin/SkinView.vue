<template>
  <canvas
    ref="canvas"
    :width="width"
    :height="height"
    @dragover="$emit('dragover', $event)"
    @drop="$emit('drop', $event)"
  />
</template>

<script lang=ts>
import { reactive, onUnmounted, watch, toRefs, ref, onMounted, defineComponent } from '@vue/composition-api';
import Model from './skin-model';

const THREE = require('three');
const OrbitControls = require('three-orbit-controls')(THREE);

export default defineComponent({
  props: {
    width: {
      type: Number,
      default: 210,
    },
    height: {
      type: Number,
      default: 400,
    },
    cape: {
      type: Object,
      required: false,
      default: null,
    },
    rotate: {
      type: Boolean,
      default: true,
    },
    maxDistance: {
      type: Number,
      default: 3,
    },
    minDistance: {
      type: Number,
      default: 1.5,
    },
    slim: {
      type: Boolean,
      default: false,
    },
    href: {
      type: String,
      required: true,
      default: null,
    },
  },
  setup(props) {
    const canvas = ref(null);
    const data = reactive({
      disposed: false,
    });
    onUnmounted(() => {
      data.disposed = true;
    });
    onMounted(() => {
      const renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: true });
      const scene = new THREE.Scene();
      const character = new Model();
      const camera = new THREE.PerspectiveCamera(45, props.width / props.height, 0.5, 5);
      const controls = new OrbitControls(camera, canvas.value);

      camera.position.z = 3;
      camera.lookAt(new THREE.Vector3(0, 0, 0));

      character.root.translateY(-0.5);
      if (props.href) {
        character.updateSkin(props.href, props.slim);
      }

      controls.target = new THREE.Vector3(0, 0, 0);
      controls.enablePan = false;
      controls.enableKeys = false;
      controls.maxDistance = props.maxDistance;
      controls.minDistance = props.minDistance;
      if (props.rotate) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 4;
      } else {
        controls.autoRotate = false;
      }

      scene.add(character.root);
      requestAnimationFrame(function animate(nowMsec) {
        if (data.disposed) return;
        requestAnimationFrame(animate);
        const result = controls.update();
        renderer.render(scene, camera);
        // console.log(result);
        // if (self.rotate || result) {
        // renderer.render(scene, camera);
        // }
      });
      watch([() => props.href, () => props.slim], () => {
        character.updateSkin(props.href, props.slim);
      });
    });

    return {
      canvas,
      ...toRefs(data),
    };
  },
});
</script>
