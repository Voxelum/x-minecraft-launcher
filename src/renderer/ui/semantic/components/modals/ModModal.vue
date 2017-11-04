<template>
    <div class="ui modal">
    <i class="close icon"></i>
    <div class="header">
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
            $(this.$el).modal('show')
        }
    },
    mounted() {
        $(this.$refs.a).accordion({})
    }
}
</script>

<style>

</style>
