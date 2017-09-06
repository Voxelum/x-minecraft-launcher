<template>
    <canvas :width="width" :height="height">
    </canvas>
</template>

<script>

import Model from './threex.minecraft'
// const Model = require('threex.minecraft')
// import Model from 'threex.minecraft'
const THREE = require('three')
const OrbitControls = require('three-orbit-controls')(THREE)
export default {
    props: ['width', 'height'],
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
        // renderer.setClearColor('#FFF', 0)
        // gl.clear(gl.COLOR_BUFFER_BIT);
        let scene = new THREE.Scene();
        let camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.5, 5);
        camera.position.z = 3;
        //////////////////////////////////////////////////////////////////////////////////
        //		load Character							//
        //////////////////////////////////////////////////////////////////////////////////

        // const miku = 'data:image/png;base64, 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'
        let character = new Model()
            // character.updateSkin(miku, true)
        character.root.translateY(-0.5)
        scene.add(character.root)
        camera.lookAt(new THREE.Vector3(0, 0, 0))

        //////////////////////////////////////////////////////////////////////////////////
        //		controls							//
        //////////////////////////////////////////////////////////////////////////////////

        let controls = new OrbitControls(camera, this.$el)
        controls.target = new THREE.Vector3(0, 0, 0)
        controls.enablePan = false
        controls.enableKeys = false
        controls.maxDistance = 3
        controls.minDistance = 1.5
        controls.autoRotate = true
        controls.autoRotateSpeed = 4

        //////////////////////////////////////////////////////////////////////////////////
        //		loop runner							//
        //////////////////////////////////////////////////////////////////////////////////

        requestAnimationFrame(function animate(nowMsec) {
            // keep looping
            requestAnimationFrame(animate);
            // measure time
            controls.update()
            renderer.render(scene, camera);
            // character.root.rotation.y += 0.01;
        })
    }
}
</script>
