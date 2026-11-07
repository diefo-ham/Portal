/**
 * Browser side of scripts/build-examples.mjs. Runs the production PDF reader
 * (the one the Add-PDFs dialog uses) over the example PDFs and hands the
 * prepared library back to Node: questions, report, and the images as base64.
 */
import { openExport, encodeWebp } from "/src/importing/pdf/pdfjsAdapter.ts";
import {
  PAA_PROFILE,
  SAT_PROFILE,
  TSI_PROFILE,
  forExamples,
  prepareBankLibrary,
} from "/src/importing/pdf/preparePaa.ts";

// The example PDFs are the portal's own and carry no access code.
const PROFILES = {
  sat: forExamples(SAT_PROFILE),
  paa: forExamples(PAA_PROFILE),
  tsi: forExamples(TSI_PROFILE),
};

const toBase64 = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

window.buildExamples = async (kind, names) => {
  const assets = new Map();
  const deps = {
    open: openExport,
    store: {
      encode: (image) => encodeWebp(image),
      put: async (key, blob) => {
        if (!assets.has(key)) assets.set(key, await toBase64(blob));
      },
    },
  };
  const files = await Promise.all(
    names.map(async (name, i) => {
      const response = await fetch(`/__pdf/${kind}/${i}`);
      if (!response.ok) throw new Error("Cannot read " + name);
      return new File([await response.arrayBuffer()], name, {
        type: "application/pdf",
      });
    }),
  );
  const prepared = await prepareBankLibrary(files, {}, deps, PROFILES[kind]);
  return {
    questionsJson: prepared.questionsJson,
    report: prepared.report,
    assets: [...assets],
  };
};
window.examplesReady = true;
