import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const baseUrl = String(option("base-url", "http://localhost:3000")).replace(/\/$/, "");
const users = Math.max(1, Math.min(500, Number(option("users", "100"))));
const durationSeconds = Math.max(5, Math.min(900, Number(option("duration", "60"))));
const sessionFile = option("sessions", "");
const includeAi = process.argv.includes("--include-ai");
const sessions = sessionFile ? JSON.parse(await readFile(sessionFile, "utf8")) : [];
if (!Array.isArray(sessions)) throw new Error("The sessions file must be a JSON array of Cookie header values.");
if (includeAi && sessions.length === 0) throw new Error("AI load testing requires authenticated test-session cookies. It is disabled by default to prevent provider charges.");

const results = [];
let stop = false;
const deadline = performance.now() + durationSeconds * 1000;

async function hit(path, init = {}) {
  const started = performance.now();
  let status = 0;
  try {
    const response = await fetch(`${baseUrl}${path}`, init);
    status = response.status;
    await response.arrayBuffer();
  } catch {
    status = -1;
  }
  results.push({ latency: performance.now() - started, status });
}

async function virtualUser(index) {
  const cookie = sessions.length ? String(sessions[index % sessions.length]) : "";
  const headers = cookie ? { Cookie: cookie } : {};
  while (!stop && performance.now() < deadline) {
    if (cookie) {
      await hit("/api/account", { headers });
      await hit("/api/canvas", { headers });
      await hit("/api/learning-center", { headers });
      if (includeAi) {
        const key = crypto.randomUUID();
        await hit("/api/assistant", { method: "POST", headers: { ...headers, "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ prompt: "Load-test health check. Reply with OK only.", page: "Load test", idempotencyKey: key }) });
      }
    } else {
      await hit("/api/auth/config");
      await hit("/");
    }
  }
}

await Promise.all(Array.from({ length: users }, (_, index) => virtualUser(index)));
stop = true;
const elapsedSeconds = durationSeconds;
const latencies = results.map((item) => item.latency).sort((a, b) => a - b);
const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] || 0;
const statuses = Object.fromEntries([...new Set(results.map((item) => item.status))].sort((a, b) => a - b).map((status) => [status, results.filter((item) => item.status === status).length]));
const failed = results.filter((item) => item.status < 200 || item.status >= 400).length;

console.log(JSON.stringify({
  baseUrl, users, durationSeconds, authenticatedSessions: sessions.length, includeAi,
  requests: results.length, requestsPerSecond: Number((results.length / elapsedSeconds).toFixed(2)),
  failureRate: Number((failed / Math.max(1, results.length)).toFixed(4)),
  latencyMs: { p50: Number(percentile(0.5).toFixed(1)), p95: Number(percentile(0.95).toFixed(1)), p99: Number(percentile(0.99).toFixed(1)), max: Number((latencies.at(-1) || 0).toFixed(1)) },
  statuses,
}, null, 2));

if (failed / Math.max(1, results.length) > 0.01 || percentile(0.95) > 1500) process.exitCode = 1;
