# User Module

[![npm version](https://img.shields.io/npm/v/@xmcl/user.svg)](https://www.npmjs.com/package/@xmcl/user)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/user.svg)](https://npmjs.com/@xmcl/user)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/user)](https://packagephobia.now.sh/result?p=@xmcl/user)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/user.svg)](https://npmjs.com/@xmcl/user)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/user)](https://packagephobia.now.sh/result?p=@xmcl/user)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Provide Yggdrasil auth and profile service for Minecraft protocol.

## Usage

### Microsoft API

Due to the complexity of the Microsoft authentication.
The library only provide parts of microsoft login process.
You need to implement the rest of the process by yourself.

Overall, according to the [wiki.vg](https://wiki.vg/Microsoft_Authentication_Scheme), the MS login process can break into following steps:

1. Aquire Microsoft access token by oauth `(user -> ms token)`
2. Acquire XBox token by Microsoft access token `(ms token -> xbox token)`
3. Acquire Minecraft access token by XBox token `(xbox token -> minecraft token)`

The library does not cover the first step.

- For nodejs, you can use [msal-node](https://www.npmjs.com/package/@azure/msal-node) to implement 1st step.
- For browser, you can use [msal-browser](https://www.npmjs.com/package/@azure/msal-browser) to implement 1st step.

If you want a reference, [this](https://github.com/voxelum/x-minecraft-launcher/blob/master/xmcl-runtime/lib/clients/MicrosoftOAuthClient.ts) is the live example for nodejs/electron using msal-node.

Here we only demo the case you already got the Microsoft access token.

```ts
import { MicrosoftAuthenticator } from '@xmcl/user'

const authenticator = new MicrosoftAuthenticator();

const msAccessToken: string; // the access token you got from msal

const { liveXstsResponse, minecraftXstsResponse } = await authenticator.acquireXBoxToken(msAccessToken);

// You can use liveXstsResponse to get the xbox user avatar and name.
const const xboxGameProfile = await authenticator.getXboxGameProfile(xstsResponse.DisplayClaims.xui[0].xid, xstsResponse.DisplayClaims.xui[0].uhs, liveXstsResponse.Token);

// you can use the xstsResponse to get the minecraft access token
const mcResponse = await authenticator.loginMinecraftWithXBox(minecraftXstsResponse.DisplayClaims.xui[0].uhs, minecraftXstsResponse.Token);

// the accessToken is the common minecraft token we want!
const accessToken: string = mcResponse.access_token;
const username = mcResponse.username;
const expire = mcResponse.expires_in; // in seconds
```

### Yggdrasil API

Most of third-party authentication service is based on Yggdrasil API.
See [authlib-injector](https://github.com/yushijinhun/authlib-injector) for more information.

The legacy mojang auth server, `https://authserver.mojang.com` is also a yggdrasil api server,
but it is not recommended to use it.

```ts
import { YggdrasilClient, YggrasilAuthentication } from "@xmcl/user";

const client = new YggdrasilClient('http://random.authserver');
const username: string;
const password: string;
const clientToken: string; // you can use uuid to generate a client token
// login
const auth: YggrasilAuthentication = await client.login({ username, password, clientToken });

// validate access token, you can use this when you restart the program
const valid: boolean = await client.validate(auth.accessToken, clientToken);

// refresh access token, if token is invalid, you can use this to get a new one
const newAuth: YggrasilAuthentication = await client.refresh({ accessToken: auth.accessToken, clientToken });
```

### Third-party Yggdrasil API

The [authlib-injector]() also implements several API for user skin operation.

We also support these API:

```ts
import { YggdrasilThirdPartyClient } from "@xmcl/user";

const client = new YggdrasilThirdPartyClient('http://random.authserver');

const uuid: string; // user uuid

// lookup user profile with texture
const profile = await client.lookup(uuid);
const infos: GameProfile.TexturesInfo | undefined = getTextures(gameProfile);
const skin: GameProfile.Texture = infos!.textures.SKIN!;
const skinUrl: string = skin.url; // use url to display skin
const isSlim: boolean = GameProfile.Texture.isSlim(skin); // determine if model is slim or not

// set user skin
const accessToken: string;
const skinUrl: string;
await client.setTexture({ accessToken, uuid, type: "skin", texture: { url: skinUrl } });

// set user skin via binary
const skinData: Uint8Array;
await client.setTexture({ accessToken, uuid, type: "skin", texture: { data: skinData } });

```

### Offline

```ts
import { offline } from "@xmcl/user";

// create a offline user
const offlineUser = offline("username");

// create an offline user with uuid
const offlineUser1 = offline("username", "uuid");
```
