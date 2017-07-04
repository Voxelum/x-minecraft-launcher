<template>
    <div style='margin: 0px; overflow: hidden;'>
        <canvas id="scene"></canvas>
    </div>
</template>

<script>

import THREEx from 'static/threex.minecraft'
var THREE = require('three')
const OrbitControls = require('three-orbit-controls')(THREE)
export default {
    mounted(e) {
        let s = document.getElementById('scene')
        var renderer = new THREE.WebGLRenderer({ canvas: s });
        renderer.setSize(300, 400);
        // renderer.setClearColor('#444', 1)

        var onRenderFcts = [];
        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(45, 300 / 400, 0.01, 50);
        camera.position.z = 3;
        //////////////////////////////////////////////////////////////////////////////////
        //		load Character							//
        //////////////////////////////////////////////////////////////////////////////////

        var character = new THREEx.MinecraftChar()
        character.root.translateY(-0.5)
        character.root.translateX(-0.05)
        scene.add(character.root)
        let vec = character.root.position
        // vec.x += 0.5
        // vec.y += 0.5
        // camera.lookAt(vec)



        //////////////////////////////////////////////////////////////////////////////////
        //		controls							//
        //////////////////////////////////////////////////////////////////////////////////

        let controls = new OrbitControls(camera)
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
