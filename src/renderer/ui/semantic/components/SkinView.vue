<template>
    <canvas :width="width" :height="height">
    </canvas>
</template>

<script>

import THREEx from 'static/threex.minecraft'
var THREE = require('three')
const OrbitControls = require('three-orbit-controls')(THREE)
export default {
    props: ['width', 'height'],
    mounted(e) {
        var renderer = new THREE.WebGLRenderer( { canvas: this.$el, antialias: true } );
        renderer.setClearColor('#FFF', 1)

        var onRenderFcts = [];
        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.5, 5);
        camera.position.z = 3;
        //////////////////////////////////////////////////////////////////////////////////
        //		load Character							//
        //////////////////////////////////////////////////////////////////////////////////

        var character = new THREEx.MinecraftChar()
        character.root.translateY(-0.5)
        scene.add(character.root)
        let vec = character.root.position
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
