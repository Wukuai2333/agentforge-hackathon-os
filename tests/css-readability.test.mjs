import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("CSS never declares fixed font sizes below the 12px readability floor", async () => {
  const appDirectory = path.resolve("app");
  const cssFiles = (await readdir(appDirectory)).filter((file) => file.endsWith(".css"));
  const violations = [];

  for (const file of cssFiles) {
    const source = await readFile(path.join(appDirectory, file), "utf8");
    for (const match of source.matchAll(/font-size:\s*([0-9]+(?:\.[0-9]+)?)px/g)) {
      const size = Number(match[1]);
      if (size < 12) violations.push(`${file}: ${match[0]}`);
    }
  }

  assert.deepEqual(violations, [], `Unreadably small fixed font sizes found:\n${violations.join("\n")}`);
});
