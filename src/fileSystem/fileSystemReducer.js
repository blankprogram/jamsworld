import { createPresetFileSystem } from "./fileSystemPreset";
import {
  canCreateChildren,
  canEditNode,
  createAvailableChildPath,
  createRenamedSubtree,
  getChildren,
  getNode,
  isNodeProtected,
} from "./fileSystemSelectors";
import {
  getNodeName,
  getParentPath,
  isChildPath,
  normalizePath,
} from "./pathUtils";

export const FILE_SYSTEM_ACTIONS = Object.freeze({
  CREATE_FOLDER: "CREATE_FOLDER",
  CREATE_FILE: "CREATE_FILE",
  WRITE_FILE: "WRITE_FILE",
  RENAME_NODE: "RENAME_NODE",
  DELETE_NODES: "DELETE_NODES",
});

const createNode = ({
  path,
  parentPath,
  type,
  content = "",
  modified = null,
}) => ({
  path,
  parentPath,
  name: getNodeName(path),
  type,
  content,
  modified,
  order: Number.MAX_SAFE_INTEGER,
  system: false,
  source: "user",
});

const resolveCreatedNodePath = (state, parentPath, requestedPath) => {
  if (!requestedPath) return null;
  const path = normalizePath(requestedPath);

  if (getParentPath(path) !== parentPath || getNode(state, path)) return null;
  return path;
};

export const createInitialFileSystemState = () => createPresetFileSystem();

export const fileSystemReducer = (state, action) => {
  switch (action.type) {
    case FILE_SYSTEM_ACTIONS.CREATE_FOLDER: {
      const parentNode = getNode(state, action.payload.parentPath);
      if (!canCreateChildren(parentNode)) return state;
      const parentPath = parentNode.path;
      const path = resolveCreatedNodePath(
        state,
        parentPath,
        action.payload.path,
      );
      if (!path) return state;

      return {
        ...state,
        nodes: {
          ...state.nodes,
          [path]: createNode({
            path,
            parentPath,
            type: "folder",
            modified: action.payload.modified,
          }),
        },
      };
    }

    case FILE_SYSTEM_ACTIONS.CREATE_FILE: {
      const parentNode = getNode(state, action.payload.parentPath);
      if (!canCreateChildren(parentNode)) return state;
      const parentPath = parentNode.path;
      const type = action.payload.fileType === "markdown" ? "markdown" : "text";
      const path = resolveCreatedNodePath(
        state,
        parentPath,
        action.payload.path,
      );
      if (!path) return state;

      return {
        ...state,
        nodes: {
          ...state.nodes,
          [path]: createNode({
            path,
            parentPath,
            type,
            content: action.payload.content ?? "",
            modified: action.payload.modified,
          }),
        },
      };
    }

    case FILE_SYSTEM_ACTIONS.WRITE_FILE: {
      const node = getNode(state, action.payload.path);
      if (!canEditNode(node)) return state;
      const path = node.path;

      return {
        ...state,
        nodes: {
          ...state.nodes,
          [path]: {
            ...node,
            content: String(action.payload.content ?? ""),
            modified: action.payload.modified || node.modified,
          },
        },
      };
    }

    case FILE_SYSTEM_ACTIONS.RENAME_NODE: {
      const node = getNode(state, action.payload.path);
      if (!node || isNodeProtected(node)) return state;
      const path = node.path;
      const parentPath = node.parentPath;
      const children = getChildren(state, parentPath).filter(
        (child) => child.path !== path,
      );
      const nextName = action.payload.name;
      const nextPath = createAvailableChildPath(
        { nodes: Object.fromEntries(children.map((child) => [child.path, child])) },
        parentPath,
        nextName,
      );

      return {
        ...state,
        nodes: createRenamedSubtree(
          state.nodes,
          path,
          getNodeName(nextPath),
          action.payload.modified,
        ),
      };
    }

    case FILE_SYSTEM_ACTIONS.DELETE_NODES: {
      const paths = [
        ...new Set(
          (Array.isArray(action.payload.paths) ? action.payload.paths : [])
            .map((path) => getNode(state, path))
            .filter((node) => node && !isNodeProtected(node))
            .map((node) => node.path),
        ),
      ];
      if (!paths.length) return state;

      const nextNodes = {};
      Object.entries(state.nodes).forEach(([nodePath, currentNode]) => {
        const shouldDelete = paths.some(
          (path) => nodePath === path || isChildPath(nodePath, path),
        );
        if (shouldDelete) return;
        nextNodes[nodePath] = currentNode;
      });

      return { ...state, nodes: nextNodes };
    }

    default:
      return state;
  }
};
