<template>
    <canvas :width="width" :height="height">
    </canvas>
</template>

<script>

import Model from './threex.minecraft'
let THREE = require('three')
const OrbitControls = require('three-orbit-controls')(THREE)
export default {
    props: ['width', 'height', 'skin', 'cape'],
    watch: {
        skin(nskin) {
            if (!nskin) {
                this.$setSkin(undefined)
                return;
            }
            let slim = nskin.metadata ? nskin.metadata.model === 'slim' : false
            if (nskin.data) {
                this.$setSkin('data:image/png;base64, ' + nskin.data.toString('base64'), slim)
            }
        }
    },
    mounted(e) {
        console.log("===========START===========")

        let canvas = this.$el;
        let gl = canvas.getContext("webgl");

        console.log(gl.getParameter(gl.RENDERER));
        console.log(gl.getParameter(gl.VENDOR));
        console.log(getUnmaskedInfo(gl).vendor);
        console.log(getUnmaskedInfo(gl).renderer);

        function getUnmaskedInfo(gl) {
            let unMaskedInfo = {
                renderer: '',
                vendor: ''
            };
            let dbgRenderInfo = gl.getExtension("WEBGL_debug_renderer_info");
            if (dbgRenderInfo != null) {
                unMaskedInfo.renderer = gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL);
                unMaskedInfo.vendor = gl.getParameter(dbgRenderInfo.UNMASKED_VENDOR_WEBGL);
            }
            return unMaskedInfo;
        }
        console.log("===========END===========")
        let renderer = new THREE.WebGLRenderer({ canvas: this.$el, antialias: true, alpha: true });
        let scene = new THREE.Scene();
        let camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.5, 5);
        camera.position.z = 3;

        let character = new Model()
        character.root.translateY(-0.5)
        this.$setSkin = (skin, slim) => {
            character.updateSkin(skin, slim);
        }
        this.$setCape = (cape) => {
            character.updateCape(cape);
        }
        scene.add(character.root)
        if (this.skin) 
            this.$setSkin('data:image/png;base64, ' + this.skin.data.toString('base64'), this.skin.slim)
        camera.lookAt(new THREE.Vector3(0, 0, 0))


        let controls = new OrbitControls(camera, this.$el)
        controls.target = new THREE.Vector3(0, 0, 0)
        controls.enablePan = false
        controls.enableKeys = false
        controls.maxDistance = 3
        controls.minDistance = 1.5
        controls.autoRotate = true
        controls.autoRotateSpeed = 4

        requestAnimationFrame(function animate(nowMsec) {
            requestAnimationFrame(animate);
            controls.update()
            renderer.render(scene, camera);
        })
    }
}
</script>
