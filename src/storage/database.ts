import { emptyData, type StudyData } from "../core/model";
import {
  createResetArchive,
  validateResetArchive,
  type ResetArchive,
} from "./resetArchive";
export type UpdateOptions = { resetArchive?: "save" | "restore" };
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("sat-study-local", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("state"))
        request.result.createObjectStore("state");
      if (!request.result.objectStoreNames.contains("assets"))
        request.result.createObjectStore("assets");
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        connection = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      connection = undefined;
      reject(new Error("Close other SAT Study tabs and reload."));
    };
  }));
}

export async function readAsset(key: string): Promise<Blob | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction("assets").objectStore("assets").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function assetKeys(): Promise<Set<string>> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction("assets").objectStore("assets").getAllKeys();
    r.onsuccess = () => resolve(new Set(r.result.map(String)));
    r.onerror = () => reject(r.error);
  });
}
export async function writeAssets(entries: { key: string; blob: Blob }[]) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    for (const e of entries) tx.objectStore("assets").put(e.blob, e.key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function readData(): Promise<StudyData> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction("state").objectStore("state").get("current");
    req.onsuccess = () => resolve(req.result ?? emptyData());
    req.onerror = () => reject(req.error);
  });
}
export async function updateData(
  update: (data: StudyData) => void,
  options: UpdateOptions = {},
): Promise<StudyData> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    const store = tx.objectStore("state");
    let data: StudyData;
    const req = store.get("current");
    req.onsuccess = () => {
      data = req.result ?? emptyData();
      const commit = (archive?: unknown) => {
        try {
          if (options.resetArchive === "save")
            store.put(createResetArchive(data), "reset-archive");
          if (options.resetArchive === "restore")
            Object.assign(data, validateResetArchive(archive, data).study);
          update(data);
          store.put(data, "current");
        } catch (error) {
          tx.abort();
          reject(error);
        }
      };
      if (options.resetArchive === "restore") {
        const archive = store.get("reset-archive");
        archive.onsuccess = () => commit(archive.result);
      } else commit();
    };
    tx.oncomplete = () => resolve(data);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(
        tx.error ?? new Error("Save failed. Your previous data is intact."),
      );
  });
}

export async function readResetArchive(): Promise<ResetArchive | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const store = db.transaction("state").objectStore("state");
    const current = store.get("current");
    const archive = store.get("reset-archive");
    archive.onsuccess = () => {
      try {
        resolve(
          validateResetArchive(archive.result, current.result ?? emptyData()),
        );
      } catch {
        resolve(undefined);
      }
    };
    archive.onerror = () => reject(archive.error);
  });
}
