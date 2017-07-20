<template>
    <div class="ui ten wide grid">
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
    
            <p class="ui text">
                <div class="ui transparent input">
                    <input type="text" name="Description" placeholder="No description yet..." :value="source.description" @input="modify">
                </div>
            </p>
        </div>
        <div class="five wide column">
            <h1 class="ui dropdown button">
                {{source.version}}
            </h1>
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
}
</script>

<style>

</style>
