import { diffKeys, applyPassOptions } from "../../passOptions";
import WebGPUMaskCompositePass from "./MaskCompositePass";

function normalizeGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups.filter((group) => group && group.id);
}

export default class WebGPUPerMaskPipelinePass {
  static type = "PER_MASK";

  constructor(device, opts = {}) {
    this.device = device;
    this.passRegistry = opts.passRegistry || {};
    this.invalidate =
      typeof opts.invalidate === "function" ? opts.invalidate : () => {};
    this.groupRecords = new Map();
    this.groupOrder = [];
    this.setOption("groups", opts.groups || []);
  }

  setOption(name, value) {
    if (name === "invalidate") {
      this.invalidate = typeof value === "function" ? value : () => {};
      return;
    }
    if (name === "passRegistry") {
      this.passRegistry = value || {};
      return;
    }
    if (name === "groups") {
      this._syncGroups(value);
    }
  }

  _destroyGroupRecord(record) {
    for (const passRec of record.passCache.values()) {
      passRec.pass?.destroy?.();
    }
    record.passCache.clear();
    record.maskPass?.destroy?.();
  }

  _syncGroups(nextGroups) {
    const groups = normalizeGroups(nextGroups);
    const aliveIds = new Set(groups.map((group) => group.id));

    for (const [groupId, record] of this.groupRecords.entries()) {
      if (!aliveIds.has(groupId)) {
        this._destroyGroupRecord(record);
        this.groupRecords.delete(groupId);
      }
    }

    this.groupOrder = [];

    for (const group of groups) {
      let record = this.groupRecords.get(group.id);
      if (!record) {
        record = {
          id: group.id,
          enabled: true,
          chain: [],
          passCache: new Map(),
          maskPass: new WebGPUMaskCompositePass(this.device, {
            canvas: null,
            invert: false,
            version: -1,
          }),
          maskOptsSnapshot: {},
        };
        this.groupRecords.set(group.id, record);
      }

      record.enabled = !!group.enabled;

      const maskOpts = {
        canvas: group.canvas || null,
        invert: !!group.invert,
        version: Number(group.version ?? 0),
      };
      const changedMaskOpts = diffKeys(record.maskOptsSnapshot, maskOpts);
      applyPassOptions(
        record.maskPass,
        changedMaskOpts,
        maskOpts,
        `WebGPUPerMaskPipelinePass/${group.id}/mask`,
      );
      record.maskOptsSnapshot = maskOpts;

      this._syncGroupPasses(record, group.filters);
      this.groupOrder.push(group.id);
    }
  }

  _syncGroupPasses(record, filters) {
    const enabledFilters = Array.isArray(filters)
      ? filters.filter((filter) => filter && filter.enabled)
      : [];

    const aliveFilterIds = new Set(
      enabledFilters.map((filter) => filter?.id).filter(Boolean),
    );

    for (const [filterId, passRec] of record.passCache.entries()) {
      if (!aliveFilterIds.has(filterId)) {
        passRec.pass?.destroy?.();
        record.passCache.delete(filterId);
      }
    }

    const nextChain = [];

    for (const filter of enabledFilters) {
      const PassClass = this.passRegistry[filter.type];
      if (!PassClass) continue;

      const prevRec = record.passCache.get(filter.id) || {
        type: filter.type,
        pass: null,
        optsSnapshot: null,
      };
      const nextOpts = filter.opts || {};
      const changed = diffKeys(prevRec.optsSnapshot || {}, nextOpts);
      const typeChanged = prevRec.type !== filter.type;

      if (!prevRec.pass || typeChanged) {
        prevRec.pass?.destroy?.();
        const pass = new PassClass(this.device, {
          ...nextOpts,
          invalidate: this.invalidate,
        });
        record.passCache.set(filter.id, {
          type: filter.type,
          pass,
          optsSnapshot: nextOpts,
        });
        nextChain.push(pass);
        continue;
      }

      if (changed.length) {
        applyPassOptions(
          prevRec.pass,
          changed,
          nextOpts,
          `WebGPUPerMaskPipelinePass/${record.id}/${filter.type}`,
        );
        record.passCache.set(filter.id, {
          ...prevRec,
          optsSnapshot: nextOpts,
        });
      }

      nextChain.push(record.passCache.get(filter.id).pass);
    }

    record.chain = nextChain;
  }

  render(encoder, state, pool) {
    const sourceTexture = state.originalTexture || state.texture;
    const sourceWidth = state.originalWidth || state.width;
    const sourceHeight = state.originalHeight || state.height;
    if (!sourceTexture || sourceWidth <= 0 || sourceHeight <= 0) return state;

    let accumState = {
      texture: sourceTexture,
      width: sourceWidth,
      height: sourceHeight,
    };
    let compositedAtLeastOnce = false;

    for (const groupId of this.groupOrder) {
      const record = this.groupRecords.get(groupId);
      if (!record?.enabled) continue;
      if (!record.maskOptsSnapshot?.canvas) continue;
      if (!record.chain.length) continue;

      let groupState = {
        texture: sourceTexture,
        width: sourceWidth,
        height: sourceHeight,
        originalTexture: sourceTexture,
        originalWidth: sourceWidth,
        originalHeight: sourceHeight,
      };

      for (const pass of record.chain) {
        const prev = groupState;
        const next = pass.render(encoder, groupState, pool);
        if (prev.texture !== sourceTexture) {
          pool.returnTemp(prev.texture, prev.width, prev.height);
        }
        groupState = {
          ...next,
          originalTexture: sourceTexture,
          originalWidth: sourceWidth,
          originalHeight: sourceHeight,
        };
      }

      const prevAccum = accumState;
      const blended = record.maskPass.render(
        encoder,
        {
          texture: groupState.texture,
          width: sourceWidth,
          height: sourceHeight,
          originalTexture: accumState.texture,
          originalWidth: sourceWidth,
          originalHeight: sourceHeight,
        },
        pool,
      );

      if (groupState.texture !== sourceTexture) {
        pool.returnTemp(groupState.texture, groupState.width, groupState.height);
      }
      if (prevAccum.texture !== sourceTexture) {
        pool.returnTemp(prevAccum.texture, prevAccum.width, prevAccum.height);
      }

      accumState = {
        ...blended,
        width: sourceWidth,
        height: sourceHeight,
      };
      compositedAtLeastOnce = true;
    }

    return compositedAtLeastOnce ? accumState : state;
  }

  destroy() {
    for (const record of this.groupRecords.values()) {
      this._destroyGroupRecord(record);
    }
    this.groupRecords.clear();
    this.groupOrder = [];
  }
}
