import { spawn } from "child_process";

async function waitForRenderer(url: string, timeout = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await Bun.sleep(500);
  }
  throw new Error(`Renderer not ready after ${timeout}ms`);
}

async function main() {
  const renderer = spawn("bun", ["run", "dev:renderer"], { stdio: "inherit", shell: true });

  console.log("⏳ Waiting for Vite renderer...");
  await waitForRenderer("http://localhost:3000");
  console.log("✅ Renderer ready, starting Electron...");

  const electron = spawn("bun", ["run", "dev:main"], { stdio: "inherit", shell: true });

  const cleanup = () => {
    renderer.kill();
    electron.kill();
    process.exit(0);
  };

  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((e) => {
  console.error("Dev failed:", e);
  process.exit(1);
});
