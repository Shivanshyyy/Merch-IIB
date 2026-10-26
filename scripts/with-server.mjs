// Starts ONE production server on a fixed port, runs a command against it, then always stops the server.
//   node scripts/with-server.mjs [--port=3000] [--build] -- <command> [args...]
// Refuses to start if the port is taken (so a second server is never spawned) and kills the whole process group on exit.
import { spawn, spawnSync } from "node:child_process";
import { createConnection } from "node:net";

const argv = process.argv.slice(2);
const split = argv.indexOf("--");
const flags = split === -1 ? argv : argv.slice(0, split);
const command = split === -1 ? [] : argv.slice(split + 1);
const PORT = Number(flags.find((a) => a.startsWith("--port="))?.split("=")[1] ?? 3000);
if (!command.length) {
  console.error("usage: with-server.mjs [--port=3000] [--build] -- <command> [args...]");
  process.exit(2);
}

const portInUse = () =>
  new Promise((resolve) => {
    const s = createConnection({ port: PORT, host: "127.0.0.1" });
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
  });

if (await portInUse()) {
  console.error(`Port ${PORT} is already in use; not starting a second server. Stop it first.`);
  process.exit(3);
}

if (flags.includes("--build")) {
  const b = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
  if (b.status !== 0) process.exit(b.status ?? 1);
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { detached: true, stdio: ["ignore", "pipe", "pipe"], env: process.env });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
let stopped = false;

const stop = () => {
  if (stopped) return;
  stopped = true;
  try {
    process.kill(-server.pid, "SIGTERM"); // negative pid = the whole group
  } catch {
    /* already gone */
  }
  setTimeout(() => {
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {
      /* gone */
    }
  }, 3000).unref();
};
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => (stop(), process.exit(130)));
process.on("exit", stop);

let ready = false;
for (let i = 0; i < 90 && !ready; i++) {
  if (server.exitCode !== null) break;
  try {
    ready = (await fetch(`http://127.0.0.1:${PORT}/`)).status < 500;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!ready) {
  console.error("Server did not become ready.\n" + serverLog);
  stop();
  process.exit(1);
}

const child = spawn(command[0], command.slice(1), { stdio: "inherit", env: { ...process.env, BASE_URL: `http://127.0.0.1:${PORT}` } });
const code = await new Promise((resolve) => child.on("exit", (c) => resolve(c ?? 1)));
stop();
await new Promise((r) => setTimeout(r, 400));
process.exit(code);
