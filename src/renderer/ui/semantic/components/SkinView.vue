<template>
    <div class="ui segment">
        <canvas id="scene" :width="width" :height="height"></canvas>
    </div>
</template>

<script>

import THREEx from 'static/threex.minecraft'
var THREE = require('three')
const OrbitControls = require('three-orbit-controls')(THREE)
export default {
    props: ['width', 'height'],
    mounted(e) {
        const s = document.getElementById('scene')
        var renderer = new THREE.WebGLRenderer({ canvas: s, antialias: true });
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

        let controls = new OrbitControls(camera)
        controls.target = new THREE.Vector3(0, 0, 0)
        controls.enablePan = false
        controls.enableKeys = false
        controls.maxDistance = 3
        controls.minDistance = 1.5

        //////////////////////////////////////////////////////////////////////////////////
        //		loop runner							//
        //////////////////////////////////////////////////////////////////////////////////
        var lastTimeMsec = null

        console.log(requestAnimationFrame)
        requestAnimationFrame(function animate(nowMsec) {
            // keep looping
            requestAnimationFrame(animate);
            // measure time
            renderer.render(scene, camera);
            character.root.rotation.y += 0.01;
        })
    }
}
</script>
