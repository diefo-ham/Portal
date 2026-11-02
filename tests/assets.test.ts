import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { emptyData, type Question } from "../src/core/model";
import { referencedAssetKeys } from "../src/importing/documents";
import {
  assetKeys,
  deleteAssetsExcept,
  writeAssets,
} from "../src/storage/database";

const key = (n: number) => n.toString(16).padStart(64, "0") + ".webp";
const panel = (n: number) => ({
  src: "asset:" + key(n),
  alt: "x",
  width: 1,
  height: 1,
});
const question = (id: string, used: number[], inline = false): Question => ({
  id,
  section: "math",
  stem: "s",
  testStatus: "inactive",
  answer: { type: "numeric", accepted: ["1"] },
  document: {
    question: used.slice(0, 1).map(panel),
    rationale: [
      ...used.slice(1).map(panel),
      ...(inline
        ? [{ src: "data:image/png;base64,AAAA", alt: "x", width: 1, height: 1 }]
        : []),
    ],
    textIsApproximate: true,
    provenance: [],
  },
});

describe("unused images", () => {
  it("lists the images that questions refer to, ignoring inline images", () => {
    const data = {
      ...emptyData(),
      questions: [question("a", [1, 2], true), question("b", [2, 3])],
    };
    expect([...referencedAssetKeys(data)].sort()).toEqual(
      [key(1), key(2), key(3)].sort(),
    );
  });

  it("removes stored images that no question refers to any more", async () => {
    const blob = (n: number) => new Blob([String(n)]);
    await writeAssets(
      [1, 2, 3, 4, 5].map((n) => ({ key: key(n), blob: blob(n) })),
    );
    const removed = await deleteAssetsExcept(new Set([key(2), key(4)]));
    expect(removed).toBe(3);
    expect([...(await assetKeys())].sort()).toEqual([key(2), key(4)].sort());
    expect(await deleteAssetsExcept(new Set([key(2), key(4)]))).toBe(0);
  });
});
