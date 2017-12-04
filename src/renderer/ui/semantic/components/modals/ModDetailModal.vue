<template>
    <div class="ui modal">
        <div class="header">
            <div class="ui items">
                <div class="item">
                    <div class="image">
                        <i class="cube huge icon"></i>
                    </div>
                    <div class="content" style="padding: 10px 0 0 0">
                        <a class="header">
                            <font size='10'>{{name}}</font>
                        </a>
                        <span v-if="authors.length!==0">by {{authors[0]}}</span>
                        <div class="meta" v-if="mod.description">
                            <font size='3'>{{mod.description}}</font>
                        </div>
                        <div class="extra">
                            <span>{{version}}</span>
                            <span v-if="mod.mcversion"> {{$t('recommendedMinecraftVersion')}} {{mod.mcversion}}</span>
                            <span v-if="acceptingMc">{{$t('acceptingMinecraftVersion')}}: {{acceptingMc}}</span>
                        </div>
                        <!-- <div class="extra">
                            <div class="ui secondary menu">
                                <a class="item" :class="{ active: selected === 'Config' }" @click="selected = 'Config'">
                                    Config
                                </a>
                                <a class="item" :class="{ active: selected === 'OnCurseforge' }" @click="selected = 'OnCurseforge'">
                                    On Curseforge
                                </a>
                                <a class="item" :class="{ active: selected === 'OnWiki' }" @click="selected = 'OnWiki'"> 
                                    On Wiki
                                </a>
                            </div>
                        </div> -->
                    </div>
                </div>
            </div>
        </div>
        <!-- <div class="content">
            <component :is="selected"></component>
        </div> -->
        <div class="actions">
            <div class="ui black deny button">
                {{$t('cancel')}}
            </div>
            <div class="ui positive right labeled icon button">
                {{$t('ok')}}
                <i class="checkmark icon"></i>
            </div>
        </div>
    </div>
</template>

<script>
import Config from './ModDetailModal/Config'
import OnCurseforge from './ModDetailModal/OnCurseforge'
import OnWiki from './ModDetailModal/OnWiki'

export default {
    components: { Config, OnCurseforge, OnWiki },
    computed: {
        name() { return this.mod.name || this.mod.modid || 'Unknown' },
        authors() { return this.mod.authorList || [] },
        version() { return this.mod.version || '0.0.0' },
        acceptingMc() { return this.mod.acceptedMinecraftVersions || '' },
    },
    methods: {
        show(mod) {
            $(this.$el).modal("show");
            this.mod = mod;
        }
    },
    mounted() {
    },
    data: () => ({
        mod: {},
        selected: 'Config',
    })
};
</script>

<style>

</style>
