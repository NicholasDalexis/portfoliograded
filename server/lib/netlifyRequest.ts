import { AsyncLocalStorage } from "node:async_hooks";
export const netlifyRequest = new AsyncLocalStorage<{ origin: string; workerOrigin: string; ip: string }>();
