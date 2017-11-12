<template>
    <div class="ui modal">
        <i class="close icon"></i>
        <div class="header">
            <div class="ui items">
                <div class="item">
                    <div class="image">
                        <img src="/images/wireframe/image.png">
                    </div>
                    <div class="content">
                        <a class="header">
                            <font size='15'>Header</font>
                        </a>
                        <span>arthor name</span>
                        <div class="meta">
                            <span>
                                <font size='2'>Real-time mapping in-game or your browser as you explore.</font>
                            </span>
                        </div>
                        <div class="extra">
                            Additional Details
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="image content">

            <div class="ui divided items">
                <li class="item" v-for="cate in Object.keys(categories)" :key="cate">
                    <div class="content">
                        <h3 class="header">{{cate}}</h3>
                        <div class="item">comment: {{categories[cate].comment}}</div>

                        <div ref='a' class="ui accordion">
                            <div class="title">
                                <i class="dropdown icon"></i>
                                properties

                            </div>
                            <div class="content">
                                <div class="ui list">
                                    <div class="item" v-for="item in Object.values(categories[cate].properties)" :key="item.name">
                                        <!-- <i class="map marker icon"></i> -->
                                        <div class="content">
                                            <span class="header">
                                                <span class="ui label">{{item.comment}}</span>
                                            </span>
                                            <div class="description" style="padding-top:10px;padding-bottom:10px">
                                                <div class="ui labeled input">
                                                    <div class="ui green label">
                                                        {{item.type}}
                                                    </div>
                                                    <div class="ui label">
                                                        {{item.name}}
                                                    </div>
                                                    <input type="text" :value="item.value">
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
                Cancel
            </div>
            <div class="ui positive right labeled icon button">
                Save
                <i class="checkmark icon"></i>
            </div>
        </div>
    </div>
</template>

<script>
// import ModDetail from '../ModDetail'
export default {
    // components: {
    //     ModDetail
    // },

    methods: {
        show() {
            $(this.$el).modal("show");
        }
    },
    mounted() {
        $(this.$refs.a).accordion({});
    },
    data: () => ({
        mod: {
            modid: 'lucaisgenius',
            name: 'luca',
            authors: [
                "a", "b"
            ]
            ,
            description: "hahahah is sooooo fun",
            version: "0.00.0.0.0.0",
            mcversion: "0.0.0..00",
        },
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
