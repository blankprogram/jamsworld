import {
  createUniqueChildName,
  getNodeName,
  getParentPath,
  isChildPath,
  joinPath,
  normalizePath,
} from "./pathUtils";

const isPathProvided = (path) =>
  typeof path === "string" && path.trim().length > 0;

export const getNode = (state, path) => {
  if (!isPathProvided(path)) return null;
  return state?.nodes?.[normalizePath(path)] || null;
};

export const getChildren = (state, path) => {
  if (!isPathProvided(path)) return [];
  const normalizedPath = normalizePath(path);
  return Object.values(state?.nodes || {})
    .filter((node) => node.parentPath === normalizedPath)
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name),
    );
};

export const isNodeProtected = (node) => Boolean(node?.system || node?.readOnly);

export const getProtectedNodeMessage = (node) => {
  const nodeType = node?.type === "folder" ? "folder" : "file";
  return `This ${nodeType} is a system ${nodeType} and cannot be modified.`;
};

export const getRecycleBinConfirmationMessage = (itemCount) =>
  `Are you sure you want to send ${itemCount} item(s) to the Recycle Bin?`;

export const canCreateChildren = (node) =>
  node?.type === "folder" && node?.allowChildren !== false;

export const getNodeTypeLabel = (node) => {
  if (!node) return "";
  if (node.type === "folder") {
    return isNodeProtected(node) ? "System Folder" : "File Folder";
  }
  if (node.type === "markdown") return "Markdown Document";
  if (node.type === "text") return "Text Document";
  if (node.type === "shortcut") return "Shortcut";
  return "File";
};

export const canOpenInNotepad = (node) =>
  node?.type === "markdown" || node?.type === "text";

export const canEditNode = (node) =>
  canOpenInNotepad(node) && !isNodeProtected(node);

export const createAvailableChildPath = (state, parentPath, preferredName) => {
  const children = getChildren(state, parentPath);
  const name = createUniqueChildName(children, preferredName);
  return joinPath(parentPath, name);
};

export const createRenamedSubtree = (nodes, path, nextName, modified) => {
  const normalizedPath = normalizePath(path);
  const parentPath = getParentPath(normalizedPath);
  if (!parentPath) return nodes;

  const nextPath = joinPath(parentPath, nextName);
  if (nodes[nextPath]) return nodes;

  const nextNodes = {};
  Object.entries(nodes).forEach(([nodePath, node]) => {
    if (nodePath !== normalizedPath && !isChildPath(nodePath, normalizedPath)) {
      nextNodes[nodePath] = node;
      return;
    }

    const suffix =
      nodePath === normalizedPath ? "" : nodePath.slice(normalizedPath.length);
    const movedPath = normalizePath(`${nextPath}${suffix}`);
    const movedParentPath =
      nodePath === normalizedPath
        ? parentPath
        : normalizePath(`${nextPath}${node.parentPath.slice(normalizedPath.length)}`);

    nextNodes[movedPath] = {
      ...node,
      path: movedPath,
      parentPath: movedParentPath,
      name: nodePath === normalizedPath ? getNodeName(nextPath) : node.name,
      modified: modified || node.modified,
    };
  });

  return nextNodes;
};
