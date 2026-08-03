import {
  createPixelPassConfig,
  parsePixelPassConfig,
  stringifyPixelPassConfig,
} from "../../applications/PixelPass/pixelPassConfig";

const sampleState = {
  globalFilters: [{ id: "filter-1", type: "BLUR", opts: { amount: 4 }, enabled: true }],
  maskEnabled: true,
  maskInvert: false,
  pipelineMode: "perMask",
  maskGroups: [{ id: "group-1", displayIndex: 1, enabled: true, invert: true, filters: [] }],
  maskSegments: [{ id: "segment-1", type: "rect", groupId: "group-1" }],
};

test("round-trips the complete PixelPass configuration", () => {
  const config = createPixelPassConfig(sampleState);
  const parsed = parsePixelPassConfig(stringifyPixelPassConfig(config));

  expect(config.source).toBeUndefined();
  expect(config.mask.groups[0].id).toBeUndefined();
  expect(config.mask.segments[0].id).toBeUndefined();
  expect(config.mask.segments[0].group).toBe(1);
  expect(parsed.filters[0].id).toEqual(expect.any(String));
  expect(parsed.mask.groups[0].id).toEqual(expect.any(String));
  expect(parsed.mask.segments[0].id).toEqual(expect.any(String));
  expect(parsed.mask.segments[0].groupId).toBe(parsed.mask.groups[0].id);
  expect(parsed.format).toBeUndefined();
  expect(parsed.version).toBeUndefined();
});

test("rejects unsupported configuration documents", () => {
  expect(() => parsePixelPassConfig({ filters: [], mask: {} })).toThrow();
});
