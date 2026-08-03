import React, { useRef, useState } from "react";

import FileNameEditor from "../FileNameEditor/FileNameEditor";
import {
  FileItemContextMenu,
  FolderBackgroundContextMenu,
} from "../FileSystemContextMenu/FileSystemContextMenu";
import { useXpContextMenu } from "../XpContextMenu/XpContextMenu";
import SelectionMarquee from "../SelectionMarquee/SelectionMarquee";
import useMarqueeSelection from "../../hooks/useMarqueeSelection";
import {
  isAdditiveSelection,
  SELECTION_CONTROL_SELECTOR,
  SELECTION_ITEM_SELECTOR,
  updateSelection,
} from "../../utils/selection";
import styles from "./Background.module.css";

const RIGHT_CLICK_EVENT_DEDUPE_MS = 500;

const Background = ({
  items = [],
  interactionLocked = false,
  onCreateItem,
  onDeleteItems,
  onRenameItem,
  onRequestRenameItem,
  openDesktopItem,
  selectedPaths = [],
  setSelectedPaths,
}) => {
  const backgroundRef = useRef(null);
  const lastRightPointerTimeRef = useRef(0);
  const { contextMenu, openContextMenu, closeContextMenu } =
    useXpContextMenu();
  const [editingPath, setEditingPath] = useState(null);
  const selectedPathSet = new Set(selectedPaths);
  const selectedItems = items.filter((item) =>
    selectedPathSet.has(item.path),
  );
  const contextItem = contextMenu?.kind === "items" && contextMenu.itemPath
    ? items.find((item) => item.path === contextMenu.itemPath) || null
    : null;

  const replaceSelection = (paths) => {
    setSelectedPaths?.([...(paths || [])]);
  };

  const {
    marquee: selectionBox,
    ...marqueePointerHandlers
  } = useMarqueeSelection({
    containerRef: backgroundRef,
    selectedKeys: selectedPathSet,
    onSelectionChange: replaceSelection,
    onStart: () => {
      closeContextMenu();
      setEditingPath(null);
    },
  });

  const openContextMenuForEvent = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(SELECTION_CONTROL_SELECTOR)) return;

    event.preventDefault();
    event.stopPropagation();
    backgroundRef.current?.focus();
    setEditingPath(null);

    const itemElement = target?.closest(SELECTION_ITEM_SELECTOR);
    const itemPath = itemElement?.dataset.selectionKey || null;
    if (itemPath && !selectedPathSet.has(itemPath)) {
      replaceSelection([itemPath]);
    } else if (!itemPath) {
      replaceSelection([]);
    }

    openContextMenu({
      kind: itemPath ? "items" : "folder",
      x: event.clientX,
      y: event.clientY,
      itemPath,
    });
  };

  const handleContextMenu = (event) => {
    const lastRightPointerTime = lastRightPointerTimeRef.current;
    const isDuplicatePointerEvent =
      lastRightPointerTime > 0 &&
      Date.now() - lastRightPointerTime < RIGHT_CLICK_EVENT_DEDUPE_MS;

    if (isDuplicatePointerEvent) {
      lastRightPointerTimeRef.current = 0;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    openContextMenuForEvent(event);
  };

  const handleRightPointerDown = (event) => {
    if (event.button !== 2) return;
    lastRightPointerTimeRef.current = Date.now();
    openContextMenuForEvent(event);
  };

  const createItem = (type) => {
    const path = onCreateItem?.(type);
    if (!path) return;
    replaceSelection([path]);
    setEditingPath(path);
  };

  const requestRename = (item) => {
    if (!item || onRequestRenameItem?.(item) === false) return;
    replaceSelection([item.path]);
    setEditingPath(item.path);
  };

  const commitRename = (item, nextName) => {
    setEditingPath(null);
    replaceSelection([]);
    onRenameItem?.(item, nextName);
  };

  const deleteSelectedItems = async () => {
    if (!selectedItems.length) return;
    const deleted = await onDeleteItems?.(selectedItems);
    if (!deleted) return;
    setEditingPath(null);
    replaceSelection([]);
  };

  const handleKeyDown = (event) => {
    if (event.target.closest("input, textarea, select")) return;

    if (event.key === "Delete") {
      event.preventDefault();
      void deleteSelectedItems();
      return;
    }
    if (event.key === "F2" && selectedItems.length === 1) {
      event.preventDefault();
      requestRename(selectedItems[0]);
      return;
    }
    if (event.key === "Enter" && selectedItems.length === 1) {
      event.preventDefault();
      openDesktopItem?.(selectedItems[0]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setEditingPath(null);
      closeContextMenu();
      replaceSelection([]);
    }
  };

  const handleIconDoubleClick = (item) => {
    replaceSelection([]);
    openDesktopItem?.(item);
  };

  const refreshDesktop = () => {
    setEditingPath(null);
    replaceSelection([]);
  };

  return (
    <div
      ref={backgroundRef}
      role="listbox"
      aria-label="Desktop"
      aria-multiselectable="true"
      aria-hidden={interactionLocked || undefined}
      inert={interactionLocked ? "" : undefined}
      tabIndex={0}
      className={styles.background}
      onContextMenuCapture={handleContextMenu}
      onPointerDownCapture={handleRightPointerDown}
      onKeyDown={handleKeyDown}
      {...marqueePointerHandlers}
    >
      {items.map((item) => {
        const selected = selectedPathSet.has(item.path);
        const editing = editingPath === item.path;

        return (
          <div
            key={item.path}
            role="option"
            aria-selected={selected}
            data-selection-item="true"
            data-selection-key={item.path}
            className={`${styles.icon} ${selected ? styles.selected : ""}`}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              backgroundRef.current?.focus();
              closeContextMenu();
              setEditingPath(null);
              replaceSelection(
                updateSelection(
                  selectedPathSet,
                  item.path,
                  isAdditiveSelection(event),
                ),
              );
            }}
            onDoubleClick={() => {
              if (!editing) handleIconDoubleClick(item);
            }}
          >
            <img
              src={item.icon}
              alt=""
              className={styles.appIcon}
              draggable={false}
            />
            {editing ? (
              <FileNameEditor
                name={item.title}
                type={item.type}
                className={styles.renameInput}
                onCancel={() => setEditingPath(null)}
                onCommit={(nextName) => commitRename(item, nextName)}
              />
            ) : (
              <span className={styles.label}>{item.title}</span>
            )}
          </div>
        );
      })}

      <SelectionMarquee marquee={selectionBox} />

      {contextMenu?.kind === "folder" && (
        <FolderBackgroundContextMenu
          actions={{
            createFolder: () => createItem("folder"),
            createMarkdownFile: () => createItem("markdown"),
            createTextFile: () => createItem("text"),
            refresh: refreshDesktop,
          }}
          menu={contextMenu}
          onClose={closeContextMenu}
        />
      )}
      {contextMenu?.kind === "items" && (
        <FileItemContextMenu
          actions={{
            delete: () => void deleteSelectedItems(),
            open: () => openDesktopItem?.(contextItem),
            rename: () => requestRename(contextItem),
          }}
          canDelete={selectedItems.length > 0}
          canRename={selectedItems.length === 1}
          itemCount={selectedItems.length}
          menu={contextMenu}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};

export default Background;
