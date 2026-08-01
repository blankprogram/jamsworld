import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  FILE_SYSTEM_ACTIONS,
  createInitialFileSystemState,
  fileSystemReducer,
} from "./fileSystemReducer";
import {
  canCreateChildren,
  canEditNode,
  canOpenInNotepad,
  createAvailableChildPath,
  getChildren,
  getNode,
  isNodeProtected,
} from "./fileSystemSelectors";

const STORAGE_KEY = "jamsworld:file-system";
const STORAGE_SCHEMA_VERSION = 1;
const createModifiedTimestamp = () => new Date().toISOString();

const selectUserNodes = (state) =>
  Object.fromEntries(
    Object.entries(state.nodes).filter(([, node]) => node?.source === "user"),
  );

const mergeStoredUserNodesWithPreset = (stored) => {
  const presetState = createInitialFileSystemState();
  if (!stored || typeof stored !== "object") return presetState;

  const userNodes = Object.fromEntries(
    Object.entries(stored.userNodes || {})
      .filter(
        ([path, node]) =>
          node?.source === "user" && !presetState.nodes[path],
      ),
  );

  return {
    ...presetState,
    nodes: {
      ...presetState.nodes,
      ...userNodes,
    },
  };
};

const loadInitialState = () => {
  if (typeof window === "undefined") return createInitialFileSystemState();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return createInitialFileSystemState();
    const parsed = JSON.parse(stored);
    if (parsed?.schemaVersion !== STORAGE_SCHEMA_VERSION) {
      return createInitialFileSystemState();
    }
    return mergeStoredUserNodesWithPreset(parsed);
  } catch {
    return createInitialFileSystemState();
  }
};

export function useFileSystem() {
  const [fileSystemState, dispatch] = useReducer(
    fileSystemReducer,
    undefined,
    loadInitialState,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          schemaVersion: STORAGE_SCHEMA_VERSION,
          userNodes: selectUserNodes(fileSystemState),
        }),
      );
    } catch {
      // The in-memory filesystem remains usable when storage is unavailable.
    }
  }, [fileSystemState]);

  const createFolder = useCallback(
    (parentPath, name = "New Folder") => {
      if (!canCreateChildren(getNode(fileSystemState, parentPath))) return null;
      const path = createAvailableChildPath(fileSystemState, parentPath, name);
      dispatch({
        type: FILE_SYSTEM_ACTIONS.CREATE_FOLDER,
        payload: {
          parentPath,
          path,
          modified: createModifiedTimestamp(),
        },
      });
      return path;
    },
    [fileSystemState],
  );

  const createFile = useCallback(
    (parentPath, options = {}) => {
      if (!canCreateChildren(getNode(fileSystemState, parentPath))) return null;
      const fileType = options.fileType === "markdown" ? "markdown" : "text";
      const defaultName =
        fileType === "markdown"
          ? "New Markdown Document.md"
          : "New Text Document.txt";
      const path = createAvailableChildPath(
        fileSystemState,
        parentPath,
        options.name || defaultName,
      );
      dispatch({
        type: FILE_SYSTEM_ACTIONS.CREATE_FILE,
        payload: {
          parentPath,
          path,
          fileType,
          content: options.content ?? "",
          modified: createModifiedTimestamp(),
        },
      });
      return path;
    },
    [fileSystemState],
  );

  const writeFile = useCallback((path, content) => {
    dispatch({
      type: FILE_SYSTEM_ACTIONS.WRITE_FILE,
      payload: {
        path,
        content,
        modified: createModifiedTimestamp(),
      },
    });
  }, []);

  const renameNode = useCallback((path, name) => {
    dispatch({
      type: FILE_SYSTEM_ACTIONS.RENAME_NODE,
      payload: {
        path,
        name,
        modified: createModifiedTimestamp(),
      },
    });
  }, []);

  const deleteNodes = useCallback((paths) => {
    dispatch({
      type: FILE_SYSTEM_ACTIONS.DELETE_NODES,
      payload: { paths },
    });
  }, []);

  return useMemo(
    () => ({
      state: fileSystemState,
      getNode: (path) => getNode(fileSystemState, path),
      getChildren: (path) => getChildren(fileSystemState, path),
      isNodeProtected,
      canCreateChildren,
      canOpenInNotepad,
      canEditNode,
      createFolder,
      createFile,
      writeFile,
      renameNode,
      deleteNodes,
    }),
    [
      fileSystemState,
      createFolder,
      createFile,
      writeFile,
      renameNode,
      deleteNodes,
    ],
  );
}
