import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { UserTelemetryEvent } from "../src/app/data/userTelemetry.js";

export class UserTelemetryLedger {
  private readonly file: string;
  private writeChain: Promise<void> = Promise.resolve();
  constructor(rootDir: string) { this.file = path.join(rootDir, "user-telemetry.jsonl"); }
  async record(event: UserTelemetryEvent): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      if ((await this.records()).some((item) => item.id === event.id)) return;
      await mkdir(path.dirname(this.file), { recursive: true });
      await appendFile(this.file, `${JSON.stringify(event)}\n`, "utf8");
    });
    await this.writeChain;
  }
  async records(): Promise<UserTelemetryEvent[]> {
    try {
      const rows = (await readFile(this.file, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line) as UserTelemetryEvent);
      const unique = new Map<string, UserTelemetryEvent>();
      for (const event of rows) if (!unique.has(event.id)) unique.set(event.id, event);
      return [...unique.values()];
    }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }
}
