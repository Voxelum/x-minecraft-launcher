<template>
    <div class="ui link cards" style="overflow-x:hidden;height:100%">
        <router-link to="market/curseforge" class="ui card">
            <div class="ui image">
                <img :src="curseforgeSrc">
            </div>
            <div class="content">
                <div class="header">
                    Curseforge
                </div>
                <div class="meta">
                    <span class="date">One of the best community for modder.</span>
                </div>
                <div class="description">
                    CurseForge is now the largest repository for modded Minecraft featuring thousands of mods, texture packs and worlds.
                </div>
            </div>
        </router-link>
        <router-link to="market/mcmodcn" class="ui card">
            <div class="image">
                <img :src="mcmodcnSrc">
            </div>
            <div class="content">
                <div class="header">
                    mcmod.cn
                </div>
                <div class="meta">
                    <span class="date">中国Minecraft模组百科</span>
                </div>
                <div class="description">
                    最大的Minecraft中文模组百科
                </div>
            </div>
        </router-link>
    </div>
</template>

<script>
const curseforgeSrc = require('static/curseforge-icon.jpg')
const mcmodcnSrc = require('static/mcmodcn-icon.png')

export default {
    data() {
        return {
            curseforgeSrc,
            mcmodcnSrc,
        }
    },
    mounted() {
    },
    methods: {
    },
}
</script>

<style>

</style>
