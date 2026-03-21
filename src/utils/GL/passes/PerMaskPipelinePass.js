import MaskCompositePass from "./MaskCompositePass.js";
import { diffKeys, applyPassOptions } from "../optionUtils.js";

function normalizeGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups.filter((group) => group && group.id);
}

export default class PerMaskPipelinePass {
  constructor(gl, opts = {}) {
    this.gl = gl;
    this.defs = opts.defs || {};
    this.invalidate =
      typeof opts.invalidate === "function" ? opts.invalidate : () => {};
    this.groupRecords = new Map();
    this.groupOrder = [];
    this.setOption("groups", opts.groups || []);
  }

  setOption(name, value) {
    if (name === "defs") {
      this.defs = value || {};
      return;
    }

    if (name === "invalidate") {
      this.invalidate = typeof value === "function" ? value : () => {};
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
          maskPass: new MaskCompositePass(this.gl, {
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
        `PerMaskPipelinePass/${group.id}/mask`,
      );
      record.maskOptsSnapshot = maskOpts;

      this._syncGroupPasses(record, group.filters);
      this.groupOrder.push(group.id);
    }
  }

  _syncGroupPasses(record, filters) {
    const enabledFilters = Array.isArray(filters)
      ? filters.filter((f) => f && f.enabled)
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

    for (let i = 0; i < enabledFilters.length; i += 1) {
      const filter = enabledFilters[i];
      const def = this.defs[filter.type];
      if (!def?.Pass) continue;

      const prevRec = record.passCache.get(filter.id) || {
        type: filter.type,
        pass: null,
        optsSnapshot: null,
      };

      const prevOpts = prevRec.optsSnapshot || {};
      const nextOpts = filter.opts || {};
      const changed = diffKeys(prevOpts, nextOpts);
      const structuralKeys = Array.isArray(def.structuralKeys)
        ? def.structuralKeys
        : [];
      const typeChanged = prevRec.type !== filter.type;
      const needsRebuild =
        !prevRec.pass ||
        typeChanged ||
        changed.some((key) => structuralKeys.includes(key));

      if (needsRebuild) {
        prevRec.pass?.destroy?.();
        const pass = new def.Pass(this.gl, { ...nextOpts, invalidate: this.invalidate });
        record.passCache.set(filter.id, {
          type: filter.type,
          pass,
          optsSnapshot: nextOpts,
        });
        nextChain.push(pass);
        continue;
      }

      if (prevRec.pass && changed.length) {
        applyPassOptions(
          prevRec.pass,
          changed,
          nextOpts,
          `PerMaskPipelinePass/${record.id}/${filter.type}`,
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

  render(gl, state, pool, vao, glState) {
    const sourceTexture = state.originalTexture || state.texture;
    const sourceWidth = state.originalWidth || state.width;
    const sourceHeight = state.originalHeight || state.height;

    if (!sourceTexture || sourceWidth <= 0 || sourceHeight <= 0) return state;

    let accumState = {
      texture: sourceTexture,
      width: sourceWidth,
      height: sourceHeight,
      temp: null,
    };
    let compositedAtLeastOnce = false;

    for (let i = 0; i < this.groupOrder.length; i += 1) {
      const groupId = this.groupOrder[i];
      const record = this.groupRecords.get(groupId);
      if (!record?.enabled) continue;
      if (!record.maskOptsSnapshot?.canvas) continue;
      if (!record.chain.length) continue;

      let groupState = {
        texture: sourceTexture,
        width: sourceWidth,
        height: sourceHeight,
        temp: null,
        originalTexture: sourceTexture,
        originalWidth: sourceWidth,
        originalHeight: sourceHeight,
      };

      for (let p = 0; p < record.chain.length; p += 1) {
        const next = record.chain[p].render(gl, groupState, pool, vao, glState);
        groupState = {
          ...next,
          originalTexture: sourceTexture,
          originalWidth: sourceWidth,
          originalHeight: sourceHeight,
        };
      }

      const blended = record.maskPass.render(
        gl,
        {
          texture: groupState.texture,
          width: sourceWidth,
          height: sourceHeight,
          originalTexture: accumState.texture,
          originalWidth: sourceWidth,
          originalHeight: sourceHeight,
        },
        pool,
        vao,
        glState,
      );

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
