<template>
    <div v-if="categories" class="ui divided items" style="max-height:200px; overflow:auto; width:100%">
        <li class="item" v-for="cate in Object.keys(categories)" :key="cate">
            <div class="content">
                <div ref='a' class="ui accordion">
                    <div class="title header">
                        <i class="dropdown icon"></i>
                        {{cate}}
                    </div>
                    <div class="content">
                        <div class="ui list">
                            <div class="item" v-for="item in Object.values(categories[cate].properties)" :key="cate + item.name">
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
    <div v-else class="ui center aligned middle aligned basic segment" style="margin: auto; height: 100%;">
        <h2 class="ui icon header">
            <i class="cube icon"></i>
            <div class="sub header">{{$t('forge.config.hint')}}</div>
        </h2>
    </div>
</template>
<script>
export default {
    mounted() {
        $(this.$refs.a).accordion({});
    },
    data: () => ({
        categories: undefined,/* {
            cateA: {
                comment: "lll",
                properties: [
                    {
                        name: "hp",
                        type: "I",
                        comment: "...",
                        value: 1
                    },
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
                ]
            }
        } */
    })
};
</script>

<style>

</style>
