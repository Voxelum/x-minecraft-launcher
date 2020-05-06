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
import { reactive, onUnmounted, watch, toRefs, ref, onMounted, defineComponent, Ref, computed } from '@vue/composition-api';
import { PlayerModel } from '@xmcl/model';
import defaultSkin from '@/assets/steve_skin.png';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';
import { Scene } from 'three/src/scenes/Scene';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera';
import { Vector3 } from 'three/src/math/Vector3';
import { Object3D } from 'three/src/core/Object3D';
import { OrbitControls } from './OrbitControls';

function useSkinModel(url: Ref<string>, slim: Ref<boolean>) {
  const model = PlayerModel.create();
  const steve = defaultSkin;
  model.setSkin(steve, false);
  onMounted(() => {
    (model.playerObject3d as unknown as Object3D).translateY(-0.5);
  });
  watch([url, slim], () => {
    model.setSkin(url.value, slim.value);
  });

  return { model };
}

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
    const data = {
      disposed: false,
    };
    const { model } = useSkinModel(computed(() => props.href), computed(() => props.slim));
    onUnmounted(() => {
      data.disposed = true;
    });
    onMounted(() => {
      const renderer = new WebGLRenderer({ canvas: canvas.value!, antialias: true, alpha: true });
      const scene = new Scene();
      const camera = new PerspectiveCamera(45, props.width / props.height, 0.5, 5);
      const controls = new OrbitControls(camera, canvas.value!);

      camera.position.z = 3;
      camera.lookAt(new Vector3(0, 0, 0));

      controls.target = new Vector3(0, 0, 0);
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

      scene.add(model.playerObject3d as unknown as Object3D);

      requestAnimationFrame(function animate(nowMsec) {
        if (data.disposed) return;
        requestAnimationFrame(animate);
        const result = controls.update();
        renderer.render(scene, camera);
      });
    });

    return {
      canvas,
    };
  },
});
</script>
