<template>
    <div class="ui modal">
    <i class="close icon"></i>
    <div class="header">
        <mod-detail></mod-detail>
        Profile Picture
    </div>
    <div class="image content">
        <!-- <div class="ui medium image">
        <img src="/images/avatar/large/chris.jpg">
        </div> -->
        <!-- <i class="circle icon"></i> -->
        <!-- <div class="description">
        <div class="ui header">We've auto-chosen a profile image for you.</div>
        <p>We've grabbed the following image from the <a href="https://www.gravatar.com" target="_blank">gravatar</a> image associated with your registered e-mail address.</p>
        <p>Is it okay to use this photo?</p>
        </div> -->
        <div ref = 'a' class="ui accordion">
            <div class="title">
            <i class="dropdown icon"></i>
            Luca is genius?
            </div>
            <div class="content">
            <p class="transition hidden"> yes! </p>
            </div>  
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
import ModDetail from '../ModDetail'
export default {
    components:{
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
