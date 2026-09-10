import { createServer } from "node:http";
import { createApp } from "./app.js";
import { resolveRuntime } from "./lib/runtimeContext.js";
import { startUsageWorker } from "./lib/usageRuntime.js";
const runtime = resolveRuntime();
const server = createServer(createApp());
server.on("close", startUsageWorker());
server.listen(runtime.port, runtime.bindHost, () => {
  console.log(`Server running on ${runtime.mode === "local" ? runtime.localOrigin : `port ${runtime.port}`} (${runtime.mode})`);
});
