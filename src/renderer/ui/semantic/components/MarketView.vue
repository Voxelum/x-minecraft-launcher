<template>
    <div class="ui link cards" style="overflow-x:hidden;height:100%">
        <router-link to="curseforge" class="ui card">
            <div class="ui  image">
                <img src="https://pbs.twimg.com/profile_images/725406699369058304/0mVMpCrb.jpg">
            </div>
            <div class="content">
                <div class="header">
                    curseforge
                </div>
                <div class="meta">
                    <span class="date">One of the best community for modder.</span>
                </div>
                <div class="description">
                    CurseForge is now the largest repository for modded Minecraft featuring thousands of mods, texture packs and worlds.
                </div>
            </div>
        </router-link>
        <router-link to="mcmodcn" class="ui card">
            <div class="image">
                <img  src="http://www.mcmod.cn/images/logo.gif">
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
export default {
    // data() {
    //     return {
    //         mods: [],
    //         page: 0,
    //         total: 1,
    //     }
    // },
    mounted() {
    },
    methods: {
    },
}
</script>

<style>

</style>
