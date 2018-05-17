<template>
    <div style="margin: 0 10px; background: white; user-select: none;">
        <v-flex text-xs-center pt-4>
            <v-avatar elevation-10 :tile="false" :size="150" style="box-shadow: 0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12);">
                <img src="https://avatars2.githubusercontent.com/u/8425057?s=460&v=4" alt="avatar">
            </v-avatar>
        </v-flex>
        <v-card-text style="padding-left: 40px; padding-right: 40px; padding-bottom: 0px;">
            <v-form v-model="valid">
                <v-select prepend-icon="router" :items="loginModes" v-model="selectedMode" label="Login Mode" flat></v-select>
                <v-text-field prepend-icon="person" label="Username" :rule="emailRules" required></v-text-field>
                <v-text-field prepend-icon="lock" label="Password" type="password" required></v-text-field>
                <v-checkbox v-model="rememberMe" label="Remember me" style="padding-top: 5px;">
                </v-checkbox>
            </v-form>
        </v-card-text>
        <v-card-actions style="padding-left: 40px; padding-right: 40px; padding-top: 0px">
            <v-flex text-xs-center>
                <v-btn block :loading="logining" color="green" round large style="color: white" @click="login">
                    Login
                </v-btn>
                <div style="margin-top: 25px; margin-bottom: 25px;">
                    <a style="padding-right: 10px;">Forget Password?</a>
                    <a style="">Dont't have an account?</a>
                </div>
            </v-flex>
        </v-card-actions>
    </div>
</template>

<script>

export default {
    data: () => ({
        logining: false,
        rememberMe: false,
        username: '',
        valid: false,
        emailRules: [
            v => !!v || 'E-mail is required',
            v => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) || 'E-mail must be valid'
        ],
        loginModes: ['offline', 'mojang'],
        selectedMode: 'mojang',
    }),
    props: {
    },
    mounted() {
    },
    methods: {
        login() {
            this.logining = true;
            setTimeout(() => {
                this.logining = false;
            }, 3000);
        }
    },
}
</script>

<style>
.moveable {
  -webkit-app-region: drag;
  user-select: none;
}

.non-moveable {
  -webkit-app-region: no-drag;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
.input-group {
  padding-top: 5px;
}
.password {
  padding-top: 5px;
}
.input-group--text-field label {
  top: 5px;
}
</style>
