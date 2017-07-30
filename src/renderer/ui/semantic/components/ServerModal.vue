<template>
    <div id="createServerModal" class="ui basic modal" :class="{error: hasError}" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="server icon"></i>
            Create A New Server
        </div>
        <form class="ui inverted form">
            <div class="field">
                <label>Name</label>
                <input class="ui basic inverted input" type="text" placeholder="Name Of server" v-model="name">
            </div>
            <div class="field">
                <label>Host</label>
                <input class="ui basic inverted input" type="text" placeholder="IP address" v-model="ip">
            </div>
            <div class="field">
                <label>Port</label>
                <input class="ui basic inverted input" type="text" placeholder="25565" v-model="port">
            </div>
            <div class="ui error message">
                <div class="header">Action Forbidden</div>
                <p>IP address is required! Please enter it!</p>
            </div>
        </form>
        <div class="actions">
            <div class="ui basic cancel inverted button">
                <i class="close icon"></i>No</div>
            <div class="ui green basic inverted ok button">
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
        $('#createServerModal')
            .modal({
                blurring: true,
                onShow() {
                    self.hasError = true
                    self.ip = ''
                    self.port = 25565
                },
                onApprove($element) {
                    if (!self.ip || self.ip === '') {
                        self.hasError = true
                        return false;
                    }
                    if (!self.port || self.port === '') self.port = '25565'
                    self.$emit('accept', { name: self.name, host: self.ip, port: self.port })
                    return true;
                },
            })
    },
    methods: {
        show() {
            this.$nextTick(() => {
                $('#createServerModal').modal('show')
            })
        },
    }
}
</script>

<style>

</style>
