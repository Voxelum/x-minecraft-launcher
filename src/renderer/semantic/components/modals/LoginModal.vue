<template>
    <div class="ui basic modal" style="padding: 0 20% 0 20%">
        <i class="close icon" v-if="this.$store.state.user.auth !== undefined"></i>
        <div class="ui noselect" style="padding:15px">
            <h3 class="ui inverted header segment center aligned ">
                <div class="content">
                    Minecraft
                </div>
            </h3>
            <form class="ui large form" :class="{error:error!==''}">
                <div class="ui inverted segment">
                    <div class="field">
                        <div ref="authMod" class="ui labeled icon dropdown inverted basic button">
                            <i class="world icon"></i>
                            <span class="text">{{ $t(`${mode}.name`) }}</span>
                            <div class="menu">
                                <option class="item" v-for="item in modes" :key="item" :value="item">{{$t(`${item}.name`)}}</option>
                            </div>
                        </div>
                    </div>
                    <div ref="accountField" class="ui field">
                        <div class="ui left icon inverted input">
                            <i class="user icon"></i>
                            <div ref="accountDropdown" class="ui floating dropdown">
                                <div class="fluid menu">
                                    <div style="width:100%" class="item" v-for="(h, index) of history" :key="h" :class="{ selected: selecting === index }" @click="account = h">{{h}}</div>
                                </div>
                            </div>
                            <input type="text" name="email" :placeholder="$t(`${mode}.account`)" @click="handleAccount" v-on:keydown="preventUpAndDown" v-on:keyup="handleAccount" v-model="account">
                        </div>
                    </div>
                    <div ref="passwordField" class="field">
                        <div class="ui left icon inverted input">
                            <i class="lock icon"></i>
                            <input type="password" name="password" :placeholder="$t(`${mode}.password`)" :disabled="mode==='offline'" v-on:keyup.enter="doLogin" v-model="password">
                        </div>
                    </div>
                    <div class="ui fluid large submit basic button inverted" :class="{loading: logining}" v-on:click="doLogin">{{$t('login')}}</div>
                    <br>
                </div>
                <div class="ui error message">
                    {{$t(error)}}
                </div>
            </form>
            <div class="ui inverted segment center aligned">
                <span class="ui text">
                    {{$t('signup.description')}}
                    <a class="ui" href="#/external/https://minecraft.net/en-us/store/minecraft/#register">{{$t('user.signup')}}</a>
                </span>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data: () => ({
        logining: false,
        error: '',
        account: '',
        password: '',
        selecting: 0,
        animations: ['jiggle', 'shake', 'tada'],
    }),
    computed: {
        history() { return this.$store.getters['user/history'].filter(t => t.startsWith(this.account)) },
        ...$.mapGetters('user', ['mode', 'modes', 'logined']),
    },
    mounted() {
        const self = this;
        $(this.$refs.accountDropdown).dropdown()
        $(this.$refs.authMod).dropdown({
            onChange: (value, text, $selectedItem) => {
                self.selectLoginMode(value)
            },
            showOnFocus: false,
        });
        $(this.$el).modal({
            closable: false,
            onHide($element) {
                return true;
            },
            blurring: true,
        })
        if (!this.logined) this.show()
    },
    methods: {
        ...$.mapActions('user', ['selectLoginMode', 'login']),
        show() {
            $(this.$el).modal('show')
        },
        preventUpAndDown(event) {
            switch (event.key) {
                case 'ArrowDown':
                case 'ArrowUp':
                    event.preventDefault();
            }
        },
        handleAccount(event) {

            const target = $(this.$refs.accountDropdown);
            if (this.history.length === 0) {
                target.dropdown('hide');
                return false;
            }
            const isTargetVisible = target.dropdown('is visible');
            switch (event.key) {
                case 'Escape':
                    target.dropdown('hide')
                    break;
                case 'ArrowDown':
                    if (!isTargetVisible) target.dropdown('show')
                    this.selecting = Math.min(this.history.length - 1, this.selecting + 1);
                    break;
                case 'ArrowUp':
                    if (!isTargetVisible) target.dropdown('show')
                    this.selecting = Math.max(0, this.selecting - 1)
                    break;
                case 'Enter':
                    if (isTargetVisible) this.account = this.history[this.selecting];
                    else this.doLogin()
                    target.dropdown('hide');
                    break;
                case 'Tab':
                    target.dropdown('hide')
                    break;
                default:
                    if (!isTargetVisible) target.dropdown('show')
                    if (this.selecting >= this.history.length) this.selecting = this.history.length - 1;
            }
        },
        shake(ref) {
            if (this.translating) return
            this.translating = true
            const self = this;
            const animation = this.animations[Math.round(Math.random() * 3)]
            $(ref).transition({
                animation,
                onComplete: () => { self.translating = false }
            })
        },
        doLogin() {
            if (this.account.length === 0) this.shake(this.$refs.accountField)
            else if (this.password.length === 0 && this.mode !== 'offline') {
                this.shake(this.$refs.passwordField)
            } else {
                this.logining = true
                this.$store.dispatch('user/login', {
                    account: this.account,
                    password: this.password,
                }).then((result) => {
                    this.logining = false
                    this.$emit('login')
                    this.error = '';
                    this.$nextTick(() => $(this.$el).modal('hide'))
                }, (err) => {
                    this.logining = false
                    this.error = this.$t(err.message);
                });
            }
        },
    }
}
</script>

<style>
.fluid.menu {
  width: 352px;
}
</style>
