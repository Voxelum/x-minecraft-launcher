<template>
    <div class="ui modal" style="max-height: 400px; min-height: 400px; ">
        <div class="header">
            <div class="ui items">
                <div class="item" style="height: 100%">
                    <div class="image">
                        <img v-if="image !== undefined" :src="image">
                        <i v-else class="cube huge icon"></i>
                    </div>
                    <div class="content" style="height: 100%">
                        <a class="header">
                            {{name}}
                        </a>
                        <span v-if="authors.length!==0">
                            by {{authors[0]}}
                        </span>
                        <div class="meta">
                            <span>{{version}}</span>
                            <span v-if="mod.mcversion"> {{$t('recommendedMinecraftVersion')}} {{mod.mcversion}}</span>
                            <span v-if="acceptingMc">{{$t('acceptingMinecraftVersion')}}: {{acceptingMc}}</span>
                        </div>
                        <div class="description" v-if="mod.description">
                            {{mod.description}}
                        </div>

                        <div class="extra">
                            <div class="ui secondary menu">
                                <a class="item" :class="{ active: selected === 'Config' }" @click="selectConfig">
                                    Config
                                </a>
                                <a class="item" :class="{ active: selected === 'OnCurseforge' }" @click="selectCurseforge">
                                    On Curseforge
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="content" style="overflow: auto; min-height: 250px; max-height: 250px;">
            <component :is="selected" :mod="mod"></component>
        </div>
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
        image() {
            return this.mod.signiture && this.mod.signiture.source === 'curseforge' ? this.mod.signiture.meta.image : undefined;
        },
        name() { return this.mod.name || this.mod.modid || 'Unknown' },
        authors() { return this.mod.authorList || [] },
        version() { return this.mod.version || '0.0.0' },
        acceptingMc() { return this.mod.acceptedMinecraftVersions || '' },
    },
    methods: {
        show(mod) {
            this.mod = mod;
            $(this.$el).modal("show");
            console.log(this.mod)
        },
        selectConfig() {
            this.selected = 'Config'
            $(this.$el).modal("refresh");
        },
        selectCurseforge() {
            this.selected = 'OnCurseforge'
            $(this.$el).modal("refresh");
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
