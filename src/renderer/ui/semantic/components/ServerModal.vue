<template>
    <div id="createServerModal" class="ui basic modal" :class="{error: hasError}" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="server icon"></i>
            Create A New Server
        </div>
        <form class="ui inverted form">
            <div class="field">
                <label>Name</label>
                <input class="ui basic inverted input" type="text" placeholder="Name Of server" v-model="name" @keypress="enter">
            </div>
            <div class="field">
                <label>Host</label>
                <input class="ui basic inverted input" type="text" placeholder="IP address" v-model="ip" @keypress="enter">
            </div>
            <div class="field">
                <label>Port</label>
                <input class="ui basic inverted input" type="text" placeholder="25565" v-model="port" @keypress="enter">
            </div>
            <div class="ui error message">
                <div class="header">Action Forbidden</div>
                <p>IP address is required! Please enter it!</p>
            </div>
        </form>
        <div class="actions">
            <div class="ui basic cancel inverted button">
                <i class="close icon"></i>No</div>
            <div class="ui green basic inverted  button" @click="accept">
                <i class="check icon"></i>Create</div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            name: '',
            ip: '',
            port: 25565,
            hasError: false,
        }
    },
    mounted() {
        const self = this
        $('#createServerModal').modal({
            blurring: true,
            onShow() {
                self.hasError = true
                self.ip = ''
                self.name = ''
                self.port = 25565
            },
        })
    },
    methods: {
        show() {
            this.$nextTick(() => {
                $('#createServerModal').modal('show')
            })
        },
        accept() {
            if (!this.ip || this.ip === '') {
                this.hasError = true
                return;
            }
            if (!this.port || this.port === '') this.port = '25565'
            this.$nextTick(() => {
                $('#createServerModal').modal('hide')
            })
            this.$emit('accept', { name: this.name, host: this.ip, port: this.port })
        },
        enter(event) {
            if (event.keyCode != 13) return
            this.accept()
        }
    }
}
</script>

<style>

</style>
