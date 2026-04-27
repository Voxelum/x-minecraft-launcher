import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(".");

async function getElectronVersion(): Promise<string> {
  const pkgPath = join(ROOT, "xmcl-electron-app", "package.json");
  const pkg = JSON.parse(await Bun.file(pkgPath).text());
  const version = pkg.devDependencies?.electron ?? pkg.dependencies?.electron;
  if (!version) throw new Error("Cannot find electron version in xmcl-electron-app/package.json");
  return version.replace(/^[\^~>=<]/, "");
}

function findNodeDatachannel(): string | null {
  const nodeDcPath = join(ROOT, "node_modules", "node-datachannel");
  if (existsSync(nodeDcPath)) return nodeDcPath;

  const bunPath = join(ROOT, "node_modules", ".bun");
  if (!existsSync(bunPath)) return null;
  const entry = readdirSync(bunPath).find((e) => e.startsWith("node-datachannel@"));
  if (!entry) return null;
  return join(bunPath, entry, "node_modules", "node-datachannel");
}

function findVueDemi(): string | null {
  const vueDemiPath = join(ROOT, "node_modules", "vue-demi");
  if (existsSync(vueDemiPath)) return vueDemiPath;

  const bunPath = join(ROOT, "node_modules", ".bun");
  if (!existsSync(bunPath)) return null;
  const entry = readdirSync(bunPath).find((e) => e.startsWith("vue-demi@"));
  if (!entry) return null;
  return join(bunPath, entry, "node_modules", "vue-demi");
}

function run(cmd: string, cwd?: string) {
  console.log(`$ ${cmd}`);
  const [bin, ...args] = cmd.split(" ");
  const result = Bun.spawnSync([bin, ...args], { cwd, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${cmd}`);
  }
}

async function setupNodeDatachannel(electronVersion: string) {
  const nodeDcPath = findNodeDatachannel();
  if (!nodeDcPath) {
    console.warn("[WARN] node-datachannel not found, skipping");
    return;
  }

  const binaryPath = join(nodeDcPath, "build", "Release", "node_datachannel.node");
  if (existsSync(binaryPath)) {
    console.log("[INFO] node_datachannel.node already exists, skipping");
    return;
  }

  console.log("[INFO] Installing prebuilt node-datachannel...");
  try {
    run(`bunx prebuild-install -r napi`, nodeDcPath);
  } catch (e) {
    console.log("[WARN] Failed to download prebuilt binary, attempting to build from source...");
    run(`bunx cmake-js rebuild --runtime electron --runtime-version ${electronVersion}`, nodeDcPath);
  }

  if (existsSync(binaryPath)) {
    console.log("[INFO] node_datachannel.node installed");
  } else {
    console.error("[ERROR] Failed to install node_datachannel.node");
    process.exit(1);
  }
}

async function setupVueDemi() {
  const vueDemiPath = findVueDemi();
  if (!vueDemiPath) {
    console.warn("[WARN] vue-demi not found, skipping");
    return;
  }

  const postinstallScript = join(vueDemiPath, "scripts", "postinstall.js");
  if (!existsSync(postinstallScript)) {
    console.warn("[WARN] vue-demi postinstall script not found, skipping");
    return;
  }

  console.log(`[INFO] Running vue-demi postinstall at ${vueDemiPath} (Vue 2 mode)...`);
  const result = Bun.spawnSync(["node", postinstallScript], {
    cwd: vueDemiPath,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (result.exitCode === 0) {
    console.log("[INFO] vue-demi switched to Vue 2 mode");
  } else {
    console.warn("[WARN] vue-demi postinstall failed (non-fatal)");
  }
}

function patchSubmodule() {
  const files = [
    join(ROOT, "xmcl/packages/curseforge/index.ts"),
    join(ROOT, "xmcl/packages/modrinth/index.ts")
  ];

  for (const file of files) {
    if (existsSync(file)) {
      console.log(`[INFO] Patching ${file}...`);
      let content = readFileSync(file, "utf8");
      content = content.replace(/fetch\?: typeof fetch/g, "fetch?: any");
      content = content.replace(/private fetch: typeof fetch/g, "private fetch: any");
      content = content.replace(/\(\.\.\.args\) => fetch\(\.\.\.args\)/g, "(...args: any[]) => (fetch as any)(...args)");
      writeFileSync(file, content);
    }
  }
}

async function setup() {
  const electronVersion = await getElectronVersion();
  console.log(`\n[INFO] Electron ${electronVersion}\n`);

  await setupNodeDatachannel(electronVersion);
  await setupVueDemi();
  patchSubmodule();

  console.log("\n[INFO] Setup complete!\n");
}

setup().catch((e) => {
  console.error("Setup failed:", e);
  process.exit(1);
});
