import { describe, expect, it } from "vitest";
import { filesFromEntries, type DroppedEntry } from "../src/ui/droppedFiles";

const file = (name: string): DroppedEntry => ({
  isFile: true,
  isDirectory: false,
  name,
  file: (success) => success(new File(["x"], name)),
});

/** A folder that hands out its children a few at a time, as browsers do. */
const folder = (
  name: string,
  children: DroppedEntry[],
  batch = 2,
): DroppedEntry => ({
  isFile: false,
  isDirectory: true,
  name,
  createReader: () => {
    let at = 0;
    return {
      readEntries: (success) => {
        const next = children.slice(at, at + batch);
        at += batch;
        success(next);
      },
    };
  },
});

describe("files from a dropped folder", () => {
  it("reads every file, across batches and subfolders", async () => {
    const files = await filesFromEntries([
      folder("exports", [
        file("math_active.pdf"),
        file("math_inactive.pdf"),
        file("read_write_active.pdf"),
        folder("more", [file("banco.pdf"), file("notes.txt")]),
      ]),
    ]);
    expect(files.map((f) => f.name)).toEqual([
      "math_active.pdf",
      "math_inactive.pdf",
      "read_write_active.pdf",
      "banco.pdf",
      "notes.txt",
    ]);
  });
  it("mixes loose files and folders, and skips empty slots", async () => {
    const files = await filesFromEntries([
      file("a.pdf"),
      null,
      folder("f", [file("b.pdf")]),
    ]);
    expect(files.map((f) => f.name)).toEqual(["a.pdf", "b.pdf"]);
  });
  it("does not follow folders nested without end", async () => {
    let chain: DroppedEntry = folder("bottom", [file("deep.pdf")]);
    for (let level = 0; level < 12; level++)
      chain = folder(`level-${level}`, [chain]);
    await expect(filesFromEntries([chain])).resolves.toEqual([]);
  });
  it("reports a read failure instead of hanging", async () => {
    const broken: DroppedEntry = {
      isFile: true,
      isDirectory: false,
      name: "x.pdf",
      file: (_success, failure) => failure?.(new Error("denied")),
    };
    await expect(filesFromEntries([broken])).rejects.toThrow("denied");
  });
});
