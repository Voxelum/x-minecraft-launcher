<template>
    <div class="ui segment" style='margin: 0px; overflow: hidden;'>
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
        let s = document.getElementById('scene')
        var renderer = new THREE.WebGLRenderer({ canvas: s });
        // renderer.setSize(this.width, this.height);
        renderer.setClearColor('#FFF', 1)

        var onRenderFcts = [];
        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(45, 300 / 400, 0.01, 50);
        camera.position.z = 3;
        //////////////////////////////////////////////////////////////////////////////////
        //		load Character							//
        //////////////////////////////////////////////////////////////////////////////////

        var character = new THREEx.MinecraftChar()
        character.root.translateY(-0.5)
        character.root.translateX(-0.0625)
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
        // controls.target = vec
        // var geo = new THREE.BoxGeometry(1, 1, 1)
        // var mat = new THREE.MeshBasicMaterial({ wireframe: false })
        // var box = new THREE.Mesh(geo, mat)
        // scene.add(box)
        // var controls = new THREEx.MinecraftControls(character)
        // THREEx.MinecraftControls.setKeyboardInput(controls)
        // onRenderFcts.push(function (delta, now) {
        //     controls.update(delta, now)
        // })

        //////////////////////////////////////////////////////////////////////////////////
        //		Camera Controls							//
        //////////////////////////////////////////////////////////////////////////////////
        // var mouse = { x: 0, y: 0 }
        // document.addEventListener('mousemove', function (event) {
        //     mouse.x = (event.clientX / window.innerWidth) - 0.5
        //     mouse.y = (event.clientY / window.innerHeight) - 0.5
        // }, false)
        // onRenderFcts.push(function (delta, now) {
        //     camera.position.x += (mouse.x * 5 - camera.position.x) * (delta * 3)
        //     camera.position.y += (mouse.y * 5 - camera.position.y) * (delta * 3)
        //     camera.lookAt(scene.position)
        // })


        //////////////////////////////////////////////////////////////////////////////////
        //		render the scene						//
        //////////////////////////////////////////////////////////////////////////////////
        onRenderFcts.push(function () {
            renderer.render(scene, camera);
        })
        onRenderFcts.push(() => {
            character.root.rotateY(0.01)
        })

        //////////////////////////////////////////////////////////////////////////////////
        //		loop runner							//
        //////////////////////////////////////////////////////////////////////////////////
        var lastTimeMsec = null
        requestAnimationFrame(function animate(nowMsec) {
            // keep looping
            requestAnimationFrame(animate);
            // measure time
            lastTimeMsec = lastTimeMsec || nowMsec - 1000 / 60
            var deltaMsec = Math.min(200, nowMsec - lastTimeMsec)
            lastTimeMsec = nowMsec
            // call each update function
            onRenderFcts.forEach(function (onRenderFct) {
                onRenderFct(deltaMsec / 1000, nowMsec / 1000)
            })
        })
    }
}
</script>
