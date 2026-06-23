import { diffKeys, applyPassOptions } from "../utils/passOptions";
import {
  WEBGPU_PASS_REGISTRY,
  WebGPUMaskCompositePass,
  WebGPUPerMaskPipelinePass,
  canRunFilterOnWebGPU,
  getWebGPUPassClass,
} from "../utils/WebGPU";

const MASK_PASS_ID = "__mask_composite__";
const PER_MASK_PASS_ID = "__per_mask_pipeline__";

function getPerMaskGroups(maskCfg) {
  if (!Array.isArray(maskCfg?.groups)) return [];
  const groupCanvases =
    maskCfg?.groupCanvases instanceof Map ? maskCfg.groupCanvases : null;
  return maskCfg.groups
    .filter((group) => group && group.id)
    .map((group) => {
      const liveCanvas = groupCanvases?.get(group.id) || null;
      return {
        ...group,
        canvas: liveCanvas || group.canvas || null,
      };
    })
    .filter((group) => !!group.canvas);
}

function syncWebGPUPasses(pipeline, passCache, filters, extras = {}) {
  if (!pipeline) return;

  const enabled = Array.isArray(filters)
    ? filters.filter((filter) => filter && filter.enabled)
    : [];
  const aliveIds = new Set(enabled.map((filter) => filter.id).filter(Boolean));

  for (const [id, rec] of passCache.entries()) {
    if (id === MASK_PASS_ID || id === PER_MASK_PASS_ID) continue;
    if (!aliveIds.has(id)) {
      rec.pass?.destroy?.();
      passCache.delete(id);
    }
  }

  const nextPasses = [];
  for (const filter of enabled) {
    if (!canRunFilterOnWebGPU(filter)) {
      throw new Error(`Filter ${filter.type} does not have a WebGPU pass`);
    }

    const PassClass = getWebGPUPassClass(filter.type);
    const prevRec = passCache.get(filter.id) || {
      type: filter.type,
      pass: null,
      optsSnapshot: null,
    };
    const nextOpts = filter.opts || {};
    const changed = diffKeys(prevRec.optsSnapshot || {}, nextOpts);
    const typeChanged = prevRec.type !== filter.type;

    if (!prevRec.pass || typeChanged) {
      prevRec.pass?.destroy?.();
      const pass = new PassClass(pipeline.device, {
        ...nextOpts,
        invalidate: extras.invalidate,
      });
      passCache.set(filter.id, {
        type: filter.type,
        pass,
        optsSnapshot: nextOpts,
      });
      nextPasses.push(pass);
      continue;
    }

    if (changed.length) {
      applyPassOptions(
        prevRec.pass,
        changed,
        nextOpts,
        `useProcessMedia/webgpu:${filter.type}`,
      );
      passCache.set(filter.id, { ...prevRec, optsSnapshot: nextOpts });
    }

    nextPasses.push(passCache.get(filter.id).pass);
  }

  pipeline.passes = nextPasses;
}

function syncWebGPUMaskPass(pipeline, passCache, maskCfg) {
  if (!pipeline || !maskCfg?.enabled || !maskCfg?.canvas) return null;

  const prevRec = passCache.get(MASK_PASS_ID) || {
    type: "MASK",
    pass: null,
    optsSnapshot: null,
  };
  const nextOpts = {
    canvas: maskCfg.canvas,
    invert: !!maskCfg.invert,
    version: Number(maskCfg.version ?? 0),
  };
  const changed = diffKeys(prevRec.optsSnapshot || {}, nextOpts);

  if (!prevRec.pass) {
    const pass = new WebGPUMaskCompositePass(pipeline.device, nextOpts);
    passCache.set(MASK_PASS_ID, {
      type: "MASK",
      pass,
      optsSnapshot: nextOpts,
    });
    return pass;
  }

  if (changed.length) {
    applyPassOptions(
      prevRec.pass,
      changed,
      nextOpts,
      "useProcessMedia/webgpu-mask",
    );
    passCache.set(MASK_PASS_ID, { ...prevRec, optsSnapshot: nextOpts });
  }

  return passCache.get(MASK_PASS_ID)?.pass || null;
}

function syncWebGPUPerMaskPass(pipeline, passCache, groups, invalidate) {
  if (!pipeline) return null;

  const prevRec = passCache.get(PER_MASK_PASS_ID) || {
    type: "PER_MASK",
    pass: null,
    optsSnapshot: null,
  };
  const nextOpts = {
    groups,
    invalidate,
    passRegistry: WEBGPU_PASS_REGISTRY,
  };

  if (!prevRec.pass) {
    const pass = new WebGPUPerMaskPipelinePass(pipeline.device, nextOpts);
    passCache.set(PER_MASK_PASS_ID, {
      type: "PER_MASK",
      pass,
      optsSnapshot: nextOpts,
    });
    return pass;
  }

  const changed = diffKeys(prevRec.optsSnapshot || {}, nextOpts);
  applyPassOptions(
    prevRec.pass,
    changed,
    nextOpts,
    "useProcessMedia/webgpu-per-mask",
  );
  passCache.set(PER_MASK_PASS_ID, { ...prevRec, optsSnapshot: nextOpts });
  return prevRec.pass;
}

export function syncWebGPUPipelineForConfig(
  pipeline,
  passCache,
  config,
  invalidate,
) {
  if (!pipeline) return;

  const filters = Array.isArray(config?.filters) ? config.filters : [];
  const maskCfg = config?.mask || null;
  const perMaskEnabled = !!(
    maskCfg?.enabled &&
    maskCfg?.pipelineMode === "perMask"
  );

  if (perMaskEnabled) {
    for (const [id, rec] of passCache.entries()) {
      if (id !== PER_MASK_PASS_ID) {
        rec.pass?.destroy?.();
        passCache.delete(id);
      }
    }
    const pass = syncWebGPUPerMaskPass(
      pipeline,
      passCache,
      getPerMaskGroups(maskCfg),
      invalidate,
    );
    pipeline.passes = pass ? [pass] : [];
    return;
  }

  syncWebGPUPasses(pipeline, passCache, filters, { invalidate });

  if (maskCfg?.enabled && maskCfg?.canvas) {
    const maskPass = syncWebGPUMaskPass(pipeline, passCache, maskCfg);
    if (maskPass) pipeline.passes = [...pipeline.passes, maskPass];
  } else {
    const maskRec = passCache.get(MASK_PASS_ID);
    maskRec?.pass?.destroy?.();
    passCache.delete(MASK_PASS_ID);
  }

  const perMaskRec = passCache.get(PER_MASK_PASS_ID);
  perMaskRec?.pass?.destroy?.();
  passCache.delete(PER_MASK_PASS_ID);
}
