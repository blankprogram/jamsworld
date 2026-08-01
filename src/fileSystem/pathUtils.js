export const PATH_SEPARATOR = "/";
export const FILE_SYSTEM_ROOT_PATH = "C:";
export const DESKTOP_PATH = `${FILE_SYSTEM_ROOT_PATH}${PATH_SEPARATOR}Desktop`;

export const normalizePath = (path = FILE_SYSTEM_ROOT_PATH) => {
  const parts = String(path || FILE_SYSTEM_ROOT_PATH)
    .replace(/\\/g, PATH_SEPARATOR)
    .split(PATH_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return FILE_SYSTEM_ROOT_PATH;

  const [firstPart, ...remainingParts] = parts;
  return /^[a-zA-Z]:$/.test(firstPart)
    ? [firstPart.toUpperCase(), ...remainingParts].join(PATH_SEPARATOR)
    : parts.join(PATH_SEPARATOR);
};

export const sanitizeNodeName = (name, fallback = "Untitled") => {
  const cleaned = String(name || "")
    .replace(/[\\/]/g, "")
    .trim();
  return cleaned || fallback;
};

export const getNodeName = (path) => {
  const normalized = normalizePath(path);
  const parts = normalized.split(PATH_SEPARATOR);
  return parts[parts.length - 1] || normalized;
};

export const getParentPath = (path) => {
  const normalized = normalizePath(path);
  if (normalized === FILE_SYSTEM_ROOT_PATH) return null;

  const parts = normalized.split(PATH_SEPARATOR);
  return parts.slice(0, -1).join(PATH_SEPARATOR);
};

export const splitFileExtension = (name = "") => {
  const extensionIndex = name.lastIndexOf(".");
  if (extensionIndex <= 0) return { baseName: name, extension: "" };
  return {
    baseName: name.slice(0, extensionIndex),
    extension: name.slice(extensionIndex),
  };
};

export const joinPath = (parentPath, childName) => {
  const normalizedParent = normalizePath(parentPath);
  const safeName = sanitizeNodeName(childName);
  return normalizePath(
    `${normalizedParent}${PATH_SEPARATOR}${safeName}`,
  );
};

export const isChildPath = (candidatePath, parentPath) => {
  const candidate = normalizePath(candidatePath);
  const parent = normalizePath(parentPath);
  return candidate !== parent && candidate.startsWith(`${parent}${PATH_SEPARATOR}`);
};

export const createUniqueChildName = (children = [], preferredName) => {
  const existingNames = new Set(children.map((child) => child.name.toLowerCase()));
  const safeName = sanitizeNodeName(preferredName);
  if (!existingNames.has(safeName.toLowerCase())) return safeName;

  const extensionIndex = safeName.lastIndexOf(".");
  const hasExtension = extensionIndex > 0;
  const stem = hasExtension ? safeName.slice(0, extensionIndex) : safeName;
  const extension = hasExtension ? safeName.slice(extensionIndex) : "";

  let suffix = 2;
  let nextName = `${stem} (${suffix})${extension}`;
  while (existingNames.has(nextName.toLowerCase())) {
    suffix += 1;
    nextName = `${stem} (${suffix})${extension}`;
  }
  return nextName;
};
