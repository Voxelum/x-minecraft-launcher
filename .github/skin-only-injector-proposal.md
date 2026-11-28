# Skin-only injector support (proposal)

Tracking issue: [#1857](https://github.com/Voxelum/x-minecraft-launcher/issues/1857).

## Proposed behavior

Add an opt-in, per-instance skin and cape provider for Java Edition Microsoft accounts. Keep the existing third-party account injector unchanged. By default, launch behavior stays the same; when enabled, the launcher selects at most one injector. The setting should clearly identify the third-party provider and explain what data it receives.

## Routing requirements

Use an explicit allowlist of skin and cape lookup endpoints rather than redirecting entire hosts. Keep Microsoft sign-in, Minecraft token and entitlement requests, and session `join` and `hasJoined` requests on official endpoints. Never forward Microsoft or Minecraft credentials to the skin provider. If the skin provider is unavailable, the game should still be able to launch and join an online-mode server with official authentication.

The requested `skin-authlib-injector` v1.2.8 is not an approved dependency in this proposal: its tagged routing code leaves session join and verification on official endpoints but maps `api.minecraftservices.com` without filtering by path. Evaluate a release with narrower routing or another implementation before integrating an agent.

## Acceptance checks

- Verify skin and cape lookups against a test provider and assert that it receives only allowed requests, without credentials.
- Verify Microsoft sign-in and joining an online-mode server on a supported Java Edition version, including when the skin provider is unreachable.
- Verify that disabling the option restores the unmodified launch path and that existing third-party account launches are unaffected.
