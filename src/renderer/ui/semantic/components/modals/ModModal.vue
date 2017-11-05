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
                            <div class="item">comment: </div>
                            {{categories[cate].comment}}
                            <div ref='a' class="ui accordion">
                                <div class="title">
                                    <i class="dropdown icon"></i>
                                    properties

                                </div>
                                <div class="content">
                                    <li v-for="item in Object.values(categories[cate].properties)" :key="item">
                                        {{item.name}}
                                    </li>

                                    <!-- <p class="transition hidden"> name: "hp", type: "I", comment: "hp", value: 7 </p>
                                                            <p class="transition hidden"> name: "hp", type: "I", comment: "hp", value: 6 </p> -->
                                </div>
                            </div>
                        </div>

                </li>
            </div>

            <!-- <div class="item">comment</div> -->

            <!-- <div ref='a' class="ui accordion">
                                                    <div class="title">
                                                        <i class="dropdown icon"></i>
                                                        properties

                                                    </div>
                                                    <div class="content">
                                                        <!-- <li v-for="cate in Object.keys(categories)" :key="cate">
                                                                {{ categories[cate].properties[0].comment }}
                                                            </li> -->
            <!-- <p class="transition hidden"> name: "hp", type: "I", comment: "hp", value: 7 </p>
                                                                <p class="transition hidden"> name: "hp", type: "I", comment: "hp", value: 6 </p> -->
            <!-- </div>
                                                </div> -->

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
            cateB: {
                comment: "lll",
                properties: [
                    {
                        name: "hp",
                        type: "I",
                        comment: "hp",
                        value: 1
                    },
                    {
                        name: "hp",
                        type: "I",
                        comment: "hp",
                        value: 2
                    }
                ]
            },
            cateA: {
                comment: "lll",
                properties: [
                    {
                        name: "hp",
                        type: "I",
                        comment: "hp",
                        value: 7
                    },
                    {
                        name: "hp",
                        type: "I",
                        comment: "hp",
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
