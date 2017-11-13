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
                            <font size='2'>{{mod.description}}</font>
                        </div>
                        <div class="extra">
                            <span>{{version}}</span>
                            <span v-if="mod.mcversion"> MC{{mod.mcversion}}</span>

                        </div>
                        <div class="extra">
                            <div class="ui secondary menu">
                                <a class="item active">
                                    Config
                                </a>
                                <a class="item">
                                    On Curseforge
                                </a>
                                <a class="item">
                                    On Wiki
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="image content">

            <header>Configs</header>
            <div class="ui divided items" style="max-height:200px; overflow:auto; width:100%">
                <li class="item" v-for="cate in Object.keys(categories)" :key="cate">
                    <div class="content">
                        <div ref='a' class="ui accordion">
                            <div class="title header">
                                <i class="dropdown icon"></i>
                                {{cate}}
                            </div>
                            <div class="content">
                                <div class="ui list">
                                    <div class="item" v-for="item in Object.values(categories[cate].properties)" :key="item.name">
                                        <div class="content">
                                            <div class="description" style="padding-top:10px;padding-bottom:10px" :data-tooltip="item.comment" data-position="top left">
                                                <div class="ui right labeled input">
                                                    <div class="ui label">
                                                        {{item.name}}
                                                    </div>
                                                    <input type="text" :value="item.value">
                                                    <div class="ui right green label">
                                                        {{item.type}}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </li>
            </div>
        </div>
        <div class="actions">
            <div class="ui black deny button">
                {{$t('cancel')}}
            </div>
            <div class="ui positive right labeled icon button">
                {{$t('save')}}
                <i class="checkmark icon"></i>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    computed: {
        name() { return this.mod.name || this.mod.modid || 'Unknown' },
        authors() { return this.mod.authorList || [] },
        version() { return this.mod.version || '0.0.0' },
    },
    methods: {
        show(mod) {
            $(this.$el).modal("show");
            this.mod = mod;
            console.log(mod)
        }
    },
    mounted() {
        $(this.$refs.a).accordion({});
    },
    data: () => ({
        mod: {},
        categories: {
            cateA: {
                comment: "lll",
                properties: [
                    {
                        name: "hp",
                        type: "I",
                        comment: "...",
                        value: 1
                    },
                    {
                        name: "hp",
                        type: "I",
                        comment: "...",
                        value: 2
                    }
                ]
            },
            cateB: {
                comment: "lll",
                properties: [
                    {
                        name: "hp",
                        type: "I",
                        comment: "...",
                        value: 7
                    },
                    {
                        name: "hp",
                        type: "I",
                        comment: "...",
                        value: 6
                    }
                ]
            }
        }
    })
};
</script>

<style>

</style>
