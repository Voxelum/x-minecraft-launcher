# Fixing Microsoft sign-in problems in Vardrynn

Vardrynn signs in to Minecraft through your Microsoft account and Xbox. When sign-in fails, the error message in the launcher names the step that failed. Find it below.

## The account isn't set up for Xbox yet

- **No Xbox profile.** Sign in once at [xbox.com](https://www.xbox.com) with the same Microsoft account and finish creating a profile (gamertag). Then try again in Vardrynn.
- **Child account.** An account under 18 must belong to a Microsoft Family before it can use Xbox. A parent or guardian adds it at [family.microsoft.com](https://family.microsoft.com) and allows Xbox and Minecraft.
- **Adult verification.** Some regions require age verification before Xbox sign-in. The launcher's error includes the link to finish it.
- **Age or region.** Check your birth date and country or region at [account.microsoft.com](https://account.microsoft.com). Xbox is not available in every region.
- **Suspended account.** Only Microsoft or Xbox support can lift a suspension.

## The account doesn't own Minecraft, or has never played

- "Fail to exchange Minecraft token" or "check ownership" usually means this Microsoft account doesn't own Minecraft: Java Edition. Check which account holds your purchase at [minecraft.net](https://www.minecraft.net) (sign in and open your profile).
- "No game profile found" means the account owns the game but has never set a player name. Sign in once at minecraft.net or in the official launcher to create one.
- Game Pass: the subscription must be active, and you need to have opened Minecraft through the Xbox app at least once.

## Temporary problems

- **Rate limited (HTTP 429)** or **server error (HTTP 5xx)**: Microsoft's service is busy. Wait the time the message suggests and retry.
- **Network errors or connection reset**: check your connection, VPN or proxy. Vardrynn's proxy settings are under Settings > Network Settings.
- **Sign-in canceled or timed out**: the browser window was closed before the sign-in finished. Start again and complete it in the browser.
- **XErr code**: the number comes from Xbox. Search it on [Microsoft's Xbox support site](https://support.xbox.com) together with "XErr".

## Still stuck

[Open an issue](https://github.com/MichaelOlave/x-minecraft-launcher/issues/new). Include the exact error message and your operating system, but never your password, tokens or a full log that contains them.
