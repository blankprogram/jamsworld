import { useCallback, useMemo } from "react";

import { getFileSystemNodeIcon } from "../fileSystem/fileSystemIcons";
import {
  getProtectedNodeMessage,
  getRecycleBinConfirmationMessage,
} from "../fileSystem/fileSystemSelectors";
import { DESKTOP_PATH } from "../fileSystem/pathUtils";

export function useDesktopFileSystem({
  appsById,
  fileSystemRuntime,
  openDialog,
  openWindow,
}) {
  const items = useMemo(
    () =>
      fileSystemRuntime.getChildren(DESKTOP_PATH).map((node) => ({
        title: node.name,
        icon: getFileSystemNodeIcon(node, appsById),
        path: node.path,
        type: node.type,
      })),
    [appsById, fileSystemRuntime],
  );

  const showProtectedNodeError = useCallback(
    (node) =>
      openDialog("system-confirm-dialog", {
        titleOverride: "Error",
        windowProps: {
          variant: "error",
          message: [getProtectedNodeMessage(node)],
          confirmLabel: "OK",
          showCancel: false,
        },
      }),
    [openDialog],
  );

  const createItem = useCallback(
    (type) => {
      const path =
        type === "folder"
          ? fileSystemRuntime.createFolder(DESKTOP_PATH)
          : fileSystemRuntime.createFile(DESKTOP_PATH, {
              fileType: type === "markdown" ? "markdown" : "text",
            });

      return path;
    },
    [fileSystemRuntime],
  );

  const requestRenameItem = useCallback(
    (item) => {
      const node = fileSystemRuntime.getNode(item?.path);
      if (!node) return false;
      if (!fileSystemRuntime.isNodeProtected(node)) return true;

      void showProtectedNodeError(node);
      return false;
    },
    [fileSystemRuntime, showProtectedNodeError],
  );

  const renameItem = useCallback(
    (item, nextName) => {
      const node = fileSystemRuntime.getNode(item?.path);
      if (!node) return;
      if (fileSystemRuntime.isNodeProtected(node)) {
        void showProtectedNodeError(node);
        return;
      }

      fileSystemRuntime.renameNode(node.path, nextName);
    },
    [fileSystemRuntime, showProtectedNodeError],
  );

  const deleteItems = useCallback(
    async (selectedItems) => {
      const nodes = (selectedItems || [])
        .map((item) => fileSystemRuntime.getNode(item.path))
        .filter(Boolean);
      if (!nodes.length) return false;

      const protectedNode = nodes.find((node) =>
        fileSystemRuntime.isNodeProtected(node),
      );
      if (protectedNode) {
        await showProtectedNodeError(protectedNode);
        return false;
      }

      const confirmed = await openDialog("system-confirm-dialog", {
        titleOverride: "Confirm",
        windowProps: {
          message: [getRecycleBinConfirmationMessage(nodes.length)],
          confirmLabel: "Yes",
          cancelLabel: "No",
        },
      });
      if (confirmed !== true) return false;

      fileSystemRuntime.deleteNodes(nodes.map((node) => node.path));
      return true;
    },
    [fileSystemRuntime, openDialog, showProtectedNodeError],
  );

  const openItem = useCallback(
    (item) => {
      if (!item) return;

      const node = fileSystemRuntime.getNode(item.path);
      if (!node) return;

      if (node.type === "folder") {
        openWindow("explorer", {
          titleOverride: node.name,
          iconOverride: getFileSystemNodeIcon(node, appsById),
          windowProps: { path: node.path },
        });
        return;
      }

      if (node.type === "shortcut" && node.appId) {
        openWindow(node.appId);
        return;
      }

      if (fileSystemRuntime.canOpenInNotepad(node)) {
        openWindow("notepad", {
          titleOverride: node.name,
          iconOverride: getFileSystemNodeIcon(node, appsById),
          windowProps: { filePath: node.path },
        });
      }
    },
    [appsById, fileSystemRuntime, openWindow],
  );

  return {
    createItem,
    deleteItems,
    items,
    openItem,
    renameItem,
    requestRenameItem,
  };
}
