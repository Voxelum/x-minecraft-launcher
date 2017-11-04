<template>
    <div class="ui modal">
        <i class="close icon"></i>
        <div class="header">
            Profile Picture
        </div>
        <div class="image content">

            <div class="ui list">
                <div class="item">comment</div>

                <div ref='a' class="ui accordion">
                    <div class="title">
                        <i class="dropdown icon"></i>
                        properties
                    </div>
                    <div class="content">
                        <p class="transition hidden"> name: "hp", type: "I", comment: "hp", value: 7 </p>
                        <p class="transition hidden"> name: "hp", type: "I", comment: "hp", value: 6 </p>
                    </div>
                </div>
            </div>

            <!-- <li v-for="cate in Object.keys(categories)" :key="cate">
                    {{ categories[cate] }}
                </li> -->

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
export default {
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
