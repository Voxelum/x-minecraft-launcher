/**
 * Microsoft OAuth mock — placeholder for the next PR.
 *
 * Goal: intercept the URLs MSAL hits so a Playwright test can drive the full
 * Microsoft login flow without a real Microsoft tenant.
 *
 * Strategy outline (NOT implemented in this PR):
 *
 * 1. Set XMCL_E2E_FAKE_MSA env so MicrosoftAccountSystem swaps its fetch
 *    implementation for one routed to a local in-process server.
 * 2. The local server replies with deterministic fixtures for:
 *      POST https://login.microsoftonline.com/consumers/oauth2/v2.0/token
 *      POST https://user.auth.xboxlive.com/user/authenticate
 *      POST https://xsts.auth.xboxlive.com/xsts/authorize
 *      POST https://api.minecraftservices.com/authentication/login_with_xbox
 *      GET  https://api.minecraftservices.com/minecraft/profile
 * 3. Snapshot bodies live next to this file as JSON fixtures so they are
 *    reviewable in code review.
 *
 * Until then, journey 02 uses the offline path which exercises real launcher
 * code without any external dependency.
 */
export const PLACEHOLDER = true
