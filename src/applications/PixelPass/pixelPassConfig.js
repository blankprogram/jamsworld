const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const cloneJsonValue = (value) => JSON.parse(JSON.stringify(value));

const createRuntimeId = (prefix) =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const serializeFilter = ({ type, opts, enabled }) => ({
  type,
  opts: cloneJsonValue(opts || {}),
  enabled: enabled !== false,
});

const serializeGroup = (group) => ({
  displayIndex: group.displayIndex,
  enabled: group.enabled !== false,
  invert: Boolean(group.invert),
  filters: (group.filters || []).map(serializeFilter),
});

const serializeSegment = (segment, groupIndexById) => {
  const { id, groupId, ...savedSegment } = segment;
  const groupIndex = groupIndexById.get(groupId) ?? 0;
  return {
    ...cloneJsonValue(savedSegment),
    group: groupIndex + 1,
  };
};

export const createPixelPassConfig = ({
  globalFilters,
  maskEnabled,
  maskInvert,
  pipelineMode,
  maskGroups,
  maskSegments,
}) => {
  const groups = Array.isArray(maskGroups) ? maskGroups : [];
  const segments = Array.isArray(maskSegments) ? maskSegments : [];
  const groupIndexById = new Map(
    groups.map((group, index) => [group.id, index]),
  );

  return {
    filters: (globalFilters || []).map(serializeFilter),
    mask: {
      enabled: Boolean(maskEnabled),
      invert: Boolean(maskInvert),
      pipelineMode: pipelineMode || "global",
      groups: groups.map(serializeGroup),
      segments: segments.map((segment) =>
        serializeSegment(segment, groupIndexById),
      ),
    },
  };
};

export const stringifyPixelPassConfig = (config) =>
  JSON.stringify(config, null, 2);

export const parsePixelPassConfig = (value) => {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (
    !isObject(parsed) ||
    !isObject(parsed.mask) ||
    !Array.isArray(parsed.filters) ||
    !Array.isArray(parsed.mask.groups) ||
    !Array.isArray(parsed.mask.segments)
  ) {
    throw new Error("This is not a supported PixelPass configuration.");
  }

  const groups = parsed.mask.groups.map((group) => ({
    ...group,
    id: createRuntimeId("group"),
    filters: (group.filters || []).map((filter) => ({
      ...filter,
      id: createRuntimeId("filter"),
    })),
  }));
  const filters = parsed.filters.map((filter) => ({
    ...filter,
    id: createRuntimeId("filter"),
  }));
  const segments = parsed.mask.segments.map(({ group = 1, ...segment }) => ({
    ...segment,
    id: createRuntimeId("segment"),
    groupId: groups[Math.max(0, group - 1)]?.id || groups[0]?.id || null,
  }));

  return {
    ...parsed,
    filters,
    mask: {
      ...parsed.mask,
      groups,
      segments,
    },
  };
};
