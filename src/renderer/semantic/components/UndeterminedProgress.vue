<template>
    <div class="ui" :class="{active:active, error:error, progress:true}">
        <div class="bar" style="transition-duration: 300ms; width:100%">
            <div class="progress" >
                <!-- <p style="margin:0;position:absolute;left:50px;top:50px;"> -->
                    {{status}}
                <!-- </p> -->
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        status: {
            type: String,
            default: '',
        },
        error: {
            type: Boolean,
            default: false,
        },
        active: {
            type: Boolean,
            default: true,
        }
    }
}
</script>

<style>

</style>
