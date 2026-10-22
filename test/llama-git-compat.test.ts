import { test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("node-llama-cpp's patched simple-git can clone a bundle and apply an authored patch", async () => {
  // Resolve from the consumer, including installations without hoisted packages.
  const require = createRequire(import.meta.url);
  const llamaRequire = createRequire(require.resolve("node-llama-cpp"));
  const { simpleGit } = llamaRequire("simple-git");
  const directory = mkdtempSync(join(tmpdir(), "qmd-git-compat-"));
  const source = join(directory, "source");
  const clone = join(directory, "clone");
  const bundle = join(directory, "source.bundle");
  const patch = join(directory, "update.diff");
  const git = (args: string[], cwd = directory) => execFileSync("git", [
    "-c", "core.hooksPath=/dev/null",
    "-c", "commit.gpgsign=false",
    "-c", "user.name=QMD fixture",
    "-c", "user.email=qmd-fixture@example.invalid",
    ...args,
  ], { cwd, stdio: "pipe" });

  try {
    git(["init", "--quiet", "--initial-branch=fixture", source]);
    writeFileSync(join(source, "README"), "before\n");
    git(["add", "README"], source);
    git(["commit", "--quiet", "-m", "fixture"], source);
    git(["bundle", "create", bundle, "HEAD"], source);

    // These are the native-source bundle clone and patch APIs used by the
    // installed node-llama-cpp helpers. Nothing touches the real llama checkout.
    await simpleGit({}).clone(bundle, clone, { "--quiet": null });
    await simpleGit(clone).removeRemote("origin");
    writeFileSync(patch, "diff --git a/README b/README\n--- a/README\n+++ b/README\n@@ -1 +1 @@\n-before\n+after\n");
    await simpleGit({ baseDir: clone }).applyPatch(patch, { "--ignore-whitespace": null });

    expect(readFileSync(join(clone, "README"), "utf8")).toBe("after\n");
    expect(git(["remote"], clone).toString().trim()).toBe("");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
