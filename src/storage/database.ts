import { emptyData, type StudyData } from "../core/model";
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("sat-study-local", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
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
): Promise<StudyData> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    const store = tx.objectStore("state");
    let data: StudyData;
    const req = store.get("current");
    req.onsuccess = () => {
      data = req.result ?? emptyData();
      try {
        update(data);
        store.put(data, "current");
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    tx.oncomplete = () => resolve(data);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(
        tx.error ?? new Error("Save failed. Your previous data is intact."),
      );
  });
}
