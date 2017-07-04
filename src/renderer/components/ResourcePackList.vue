<template>
    <div>
        <div class="ui middle aligned animated list">
            <div v-for="item in modes" :key="item" :value="item">
                <img class="ui avatar image" src="../assets/lena.jpg">
                <div class="content">
                    <div class="header">ResourcePackName</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {

}
</script>

<style>

</style>
