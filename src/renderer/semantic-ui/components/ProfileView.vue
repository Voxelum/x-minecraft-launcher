<template>
    <div class="ui grid">
        <div class="five wide column">
            <h1 class="ui header">
                <div class="ui transparent input">
                    <input type="text" name="Name" :placeholder="id" :value="source.name" @input="modify">
                </div>
                <!-- <img class="ui circular image" src="/images/avatar2/large/patrick.png"> -->
            </h1>
            <h1 class="ui sub header">
                <div class="ui transparent input">
                    <input type="text" name="Author" placeholder="Unknown author..." :value="source.author" @input="modify">
                </div>
            </h1>
            <button class="ui large button">Launch</button>
        </div>
        <div class="eleven wide column">
            <div class="ui secondary pointing menu">
                <a class="item active" data-tab="summery">
                    Summery
                </a>
                <a class="item" data-tab="resourcepacks">
                    Resourcepacks
                </a>
                <a class="item" data-tab="mods">
                    Mods
                </a>
            </div>
            <div class="ui active tab segment" data-tab="summery">
                <p class="ui text">
                    <div class="ui transparent input">
                        <input type="text" name="Description" placeholder="No description yet..." :value="source.description" @input="modify">
                    </div>
                </p>
            </div>
             <div class="ui tab segment" data-tab="resourcepacks">
                <p class="ui text">
                    AAA
                </p>
            </div>
             <div class="ui tab segment" data-tab="mods">
                <p class="ui text">
                    BBB
                </p>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: ['source', 'id'],
    methods: {
        modify(event) {
            this.$store.commit('profiles/' + this.id + '/set' + event.target.name, event.target.value)
        }
    },
    mounted() {
        $('.menu .item').tab()
    }
}
</script>

<style>

</style>
