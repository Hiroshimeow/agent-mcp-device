const fs = require('node:fs');
const path = require('node:path');

const out = process.env.MCP_BENCH_RESOURCE_FILE;
if (out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const write = () => {
    const cpu = process.cpuUsage();
    const row = {
      epoch_ms: Date.now(),
      cpu_user_us: cpu.user,
      cpu_system_us: cpu.system,
      rss_bytes: process.memoryUsage().rss,
      heap_used_bytes: process.memoryUsage().heapUsed,
    };
    fs.appendFileSync(out, JSON.stringify(row) + '\n');
  };
  write();
  const timer = setInterval(write, Number(process.env.MCP_BENCH_RESOURCE_INTERVAL_MS || 100));
  timer.unref();
  process.on('exit', write);
}
