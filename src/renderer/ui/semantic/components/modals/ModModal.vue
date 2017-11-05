<template>
    <div class="ui modal">
        <i class="close icon"></i>
        <div class="header">
            Profile Picture
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
import ModDetail from '../ModDetail'
export default {
    components: {
        ModDetail
    },

    methods: {
        show() {
            $(this.$el).modal("show");
        }
    },
    mounted() {
        $(this.$refs.a).accordion({});
    },
    data: () => ({
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
