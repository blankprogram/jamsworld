import React, { useCallback, useMemo, useRef, useState } from "react";
import { createAppManifest } from "../createAppManifest";
import styles from "./Explorer.module.css";
import backIcon from "../../assets/Icons/back.png";
import documentsIcon from "../../assets/Icons/Documents.png";
import explorerDropDownIcon from "../../assets/Icons/ExplorerDropDown.png";
import forwardIcon from "../../assets/Icons/forward.png";
import folderIcon from "../../assets/Icons/explorer.png";
import foldersIcon from "../../assets/Icons/Folders.png";
import folderUpIcon from "../../assets/Icons/FolderUp.png";
import folderViewIcon from "../../assets/Icons/FolderView.png";
import goIcon from "../../assets/Icons/go.png";
import notepadIcon from "../../assets/Icons/notepad.png";
import searchIcon from "../../assets/Icons/search.png";
import windowsIcon from "../../assets/Icons/windows.png";
import {
  DESKTOP_PATH,
  FILE_SYSTEM_ROOT_PATH,
  getParentPath,
  joinPath,
  normalizePath,
  splitFileExtension,
} from "../../fileSystem/pathUtils";
import { getFileSystemNodeIcon } from "../../fileSystem/fileSystemIcons";
import {
  getNodeTypeLabel,
  getProtectedNodeMessage,
  getRecycleBinConfirmationMessage,
} from "../../fileSystem/fileSystemSelectors";
import FileNameEditor from "../../components/FileNameEditor/FileNameEditor";
import SelectionMarquee from "../../components/SelectionMarquee/SelectionMarquee";
import {
  FileItemContextMenu,
  FolderBackgroundContextMenu,
} from "../../components/FileSystemContextMenu/FileSystemContextMenu";
import { useXpContextMenu } from "../../components/XpContextMenu/XpContextMenu";
import useMarqueeSelection from "../../hooks/useMarqueeSelection";
import {
  isAdditiveSelection,
  selectionSetsEqual,
  updateSelection,
} from "../../utils/selection";

export const appManifest = createAppManifest({
  id: "explorer",
  title: "Explorer",
  icon: folderIcon,
  windowDefaults: {
    width: 760,
    height: 520,
    minWidth: 520,
    minHeight: 360,
  },
});

const MENU_LABELS = ["File", "Edit", "View", "Favorites", "Tools", "Help"];
const VIEW_MODES = ["Thumbnails", "Tiles", "Icons", "List", "Details"];
const OTHER_PLACES = [
  { label: "Desktop", path: DESKTOP_PATH },
  { label: "Projects", path: joinPath(DESKTOP_PATH, "Projects") },
  {
    label: "My Documents",
    path: joinPath(FILE_SYSTEM_ROOT_PATH, "My Documents"),
  },
  {
    label: "My Pictures",
    path: joinPath(FILE_SYSTEM_ROOT_PATH, "My Pictures"),
  },
  { label: "My Music", path: joinPath(FILE_SYSTEM_ROOT_PATH, "My Music") },
  { label: "My Videos", path: joinPath(FILE_SYSTEM_ROOT_PATH, "My Videos") },
];
const SORT_ASCENDING = "ascending";
const SORT_DESCENDING = "descending";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const getExplorerDisplayName = (node) => {
  if (!node?.name) return "";
  if (node.type !== "text" && node.type !== "markdown") return node.name;
  return splitFileExtension(node.name).baseName;
};

const formatExplorerDate = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
};

const toWindowsAddress = (path) => {
  const normalizedPath = normalizePath(path);
  const windowsPath = normalizedPath.replace(/\//g, "\\");
  return normalizedPath === FILE_SYSTEM_ROOT_PATH
    ? `${windowsPath}\\`
    : windowsPath;
};

const fromWindowsAddress = (value) =>
  normalizePath(String(value || FILE_SYSTEM_ROOT_PATH).trim());

function ExplorerControl({
  className = "",
  disabled = false,
  onActivate,
  role = "button",
  children,
  ...props
}) {
  const activate = () => {
    if (!disabled) onActivate?.();
  };

  return (
    <span
      role={role}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      className={cx(styles.control, className, disabled && styles.disabledControl)}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate();
      }}
      {...props}
    >
      {children}
    </span>
  );
}

function ToolbarControl({
  icon,
  iconOnly = false,
  action = false,
  children,
  ...props
}) {
  return (
    <ExplorerControl
      className={cx(
        styles.toolbarControl,
        iconOnly && styles.toolbarIconOnly,
        action && styles.toolbarAction,
      )}
      {...props}
    >
      <img src={icon} alt="" />
      {children}
    </ExplorerControl>
  );
}

function DropdownArrow() {
  return <span className={styles.dropdownArrow} aria-hidden="true" />;
}

function sortNodesByName(nodes, direction) {
  const directionMultiplier = direction === SORT_DESCENDING ? -1 : 1;

  return [...nodes].sort((leftNode, rightNode) => {
    const nameComparison = leftNode.name.localeCompare(rightNode.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    const stableComparison =
      nameComparison || leftNode.path.localeCompare(rightNode.path);

    return stableComparison * directionMultiplier;
  });
}

const getNextSortDirection = (direction) =>
  direction === SORT_ASCENDING ? SORT_DESCENDING : SORT_ASCENDING;

function ExplorerChrome({
  addressInputRef,
  addressValue,
  canGoBack,
  canGoForward,
  onAddressChange,
  onAddressFocus,
  onAddressSubmit,
  onBack,
  onForward,
  onToggleFolders,
  onUp,
  onViewModeChange,
  viewMode,
}) {
  return (
    <>
      <div className={styles.menuBar}>
        {MENU_LABELS.map((label) => (
          <div key={label} className={styles.menuButton}>
            {label}
          </div>
        ))}
        <img src={windowsIcon} alt="" className={styles.logo} />
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <ToolbarControl
            icon={backIcon}
            disabled={!canGoBack}
            onActivate={onBack}
          >
            Back
            <DropdownArrow />
          </ToolbarControl>
          <ToolbarControl
            icon={forwardIcon}
            disabled={!canGoForward}
            onActivate={onForward}
            title="Forward"
            aria-label="Forward"
          >
            <DropdownArrow />
          </ToolbarControl>
        </div>

        <div className={styles.toolbarGroup}>
          <ToolbarControl
            icon={folderUpIcon}
            iconOnly
            disabled={!canGoBack}
            onActivate={onUp}
            title="Up"
            aria-label="Up"
          />
        </div>

        <div className={styles.separator} />

        <div className={styles.toolbarGroup}>
          <ToolbarControl icon={searchIcon} action>
            Search
          </ToolbarControl>
          <ToolbarControl
            icon={foldersIcon}
            action
            onActivate={onToggleFolders}
          >
            Folders
          </ToolbarControl>
        </div>

        <div className={styles.separator} />

        <div className={styles.toolbarGroup}>
          <label
            className={cx(styles.toolbarControl, styles.viewControl)}
            title="Views"
          >
            <img src={folderViewIcon} alt="" />
            <DropdownArrow />
            <select
              aria-label="View"
              value={viewMode}
              onChange={(event) => onViewModeChange(event.target.value)}
            >
              {VIEW_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <form
        className={styles.addressBar}
        onSubmit={(event) => {
          event.preventDefault();
          onAddressSubmit();
        }}
      >
        <span className={styles.addressLabel}>Address</span>
        <div className={styles.addressInputWrap}>
          <img src={documentsIcon} alt="" className={styles.addressIcon} />
          <input
            ref={addressInputRef}
            aria-label="Address"
            value={addressValue}
            onChange={(event) => onAddressChange(event.target.value)}
            spellCheck={false}
          />
          <ExplorerControl
            className={styles.addressDropdownControl}
            onActivate={onAddressFocus}
            title="Address options"
            aria-label="Address options"
          >
            <img
              src={explorerDropDownIcon}
              alt=""
              className={styles.addressDropdownIcon}
            />
          </ExplorerControl>
        </div>
        <ExplorerControl
          className={styles.addressGoControl}
          onActivate={onAddressSubmit}
        >
          <img src={goIcon} alt="" />
          Go
        </ExplorerControl>
      </form>
    </>
  );
}

function ExplorerSidebar({
  detailsNode,
  itemCount,
  onCreateFolder,
  onCreateMarkdownFile,
  onCreateTextFile,
  onOpenPlace,
  otherPlaces,
  selectionCount,
  visible,
}) {
  return (
    <aside className={`${styles.sideBar} ${visible ? "" : styles.sideBarHidden}`}>
      <section className={styles.sidePane}>
        <h2>File and Folder Tasks</h2>
        <ExplorerControl
          className={styles.sidePaneAction}
          onActivate={onCreateFolder}
        >
          Make a new folder
        </ExplorerControl>
        <ExplorerControl
          className={styles.sidePaneAction}
          onActivate={onCreateTextFile}
        >
          Make a new text file
        </ExplorerControl>
        <ExplorerControl
          className={styles.sidePaneAction}
          onActivate={onCreateMarkdownFile}
        >
          Make a new markdown file
        </ExplorerControl>
      </section>

      <section className={styles.sidePane}>
        <h2>Other Places</h2>
        {otherPlaces.map((place) => (
          <ExplorerControl
            key={place.path}
            className={styles.sidePaneAction}
            onActivate={() => onOpenPlace(place.path)}
          >
            {place.label}
          </ExplorerControl>
        ))}
      </section>

      <section className={styles.sidePane}>
        <h2>Details</h2>
        {selectionCount > 1 ? (
          <div className={styles.details}>
            <strong>{selectionCount} items selected</strong>
          </div>
        ) : (
          <div className={styles.details}>
            <strong>{getExplorerDisplayName(detailsNode) || "Desktop"}</strong>
            <span>{getNodeTypeLabel(detailsNode)}</span>
            {detailsNode?.type === "folder" && <span>{itemCount} item(s)</span>}
            {detailsNode?.modified && (
              <span>Modified: {formatExplorerDate(detailsNode.modified)}</span>
            )}
          </div>
        )}
      </section>
    </aside>
  );
}

function ExplorerDirectory({
  appsById,
  editingPath,
  items,
  nameSortDirection,
  onCancelRename,
  onClearSelection,
  onCommitRename,
  onContextMenu,
  onDeleteSelection,
  onOpenNode,
  onRenameSelection,
  onSelectAll,
  onSelectPath,
  onSelectionChange,
  onToggleNameSort,
  selectedPaths,
  viewMode,
}) {
  const containerRef = useRef(null);
  const nextNameSortDirection = getNextSortDirection(nameSortDirection);
  const { marquee, ...marqueePointerHandlers } = useMarqueeSelection({
    containerRef,
    onSelectionChange,
    selectedKeys: selectedPaths,
  });

  const handleKeyDown = (event) => {
    if (isAdditiveSelection(event) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      onSelectAll();
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      onDeleteSelection();
      return;
    }
    if (event.key === "F2") {
      event.preventDefault();
      onRenameSelection();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClearSelection();
    }
  };

  return (
    <main
      ref={containerRef}
      role="listbox"
      aria-multiselectable="true"
      tabIndex={0}
      className={`${styles.items} ${styles[`view${viewMode}`] || styles.viewTiles}`}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => onContextMenu(event)}
      {...marqueePointerHandlers}
    >
      {viewMode === "Details" && (
        <div className={styles.detailsHeader} data-selection-control="true">
          <ExplorerControl
            className={styles.detailsNameHeader}
            onActivate={onToggleNameSort}
            title={`Sort by name ${nextNameSortDirection}`}
            aria-label={`Name, sorted ${nameSortDirection}. Sort ${nextNameSortDirection}`}
          >
            <span>Name</span>
            <span
              className={`${styles.sortArrow} ${
                nameSortDirection === SORT_ASCENDING
                  ? styles.sortArrowAscending
                  : styles.sortArrowDescending
              }`}
              aria-hidden="true"
            />
          </ExplorerControl>
          <span>Size</span>
          <span>Type</span>
          <span>Modified</span>
        </div>
      )}

      {items.map((node) => {
        const isEditing = editingPath === node.path;

        return (
          <div
            key={node.path}
            role="option"
            aria-selected={selectedPaths.has(node.path)}
            tabIndex={isEditing ? -1 : 0}
            data-selection-item="true"
            data-selection-key={node.path}
            className={`${styles.item} ${
              selectedPaths.has(node.path) ? styles.selected : ""
            }`}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              onSelectPath(node.path, isAdditiveSelection(event));
            }}
            onDoubleClick={() => onOpenNode(node)}
            onContextMenu={(event) => onContextMenu(event, node)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onOpenNode(node);
                return;
              }
              if (event.key === " ") {
                event.preventDefault();
                onSelectPath(node.path, isAdditiveSelection(event));
              }
            }}
          >
            <span className={styles.itemVisual}>
              <img
                src={getFileSystemNodeIcon(node, appsById)}
                alt=""
                draggable={false}
              />
            </span>
            <span
              className={cx(
                styles.itemText,
                isEditing && styles.itemTextEditing,
              )}
            >
              {isEditing ? (
                <FileNameEditor
                  name={node.name}
                  type={node.type}
                  className={styles.renameInput}
                  onCancel={onCancelRename}
                  onCommit={(nextName) => onCommitRename(node, nextName)}
                />
              ) : (
                <span className={styles.itemName}>
                  {getExplorerDisplayName(node)}
                </span>
              )}
              <span className={styles.itemSize}>0 B</span>
              <span className={styles.itemType}>{getNodeTypeLabel(node)}</span>
              <span className={styles.itemDate}>
                {formatExplorerDate(node.modified)}
              </span>
            </span>
          </div>
        );
      })}

      <SelectionMarquee marquee={marquee} testId="selection-marquee" />
    </main>
  );
}

function Explorer({ windowProps = {}, windowRuntime, fileSystemRuntime, appsById }) {
  const initialPath = normalizePath(
    windowProps.path || DESKTOP_PATH,
  );
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [addressValue, setAddressValue] = useState(toWindowsAddress(initialPath));
  const [forwardPaths, setForwardPaths] = useState([]);
  const [selectedPaths, setSelectedPaths] = useState(() => new Set());
  const [editingPath, setEditingPath] = useState(null);
  const { contextMenu, openContextMenu, closeContextMenu } =
    useXpContextMenu();
  const [viewMode, setViewMode] = useState("Tiles");
  const [nameSortDirection, setNameSortDirection] =
    useState(SORT_ASCENDING);
  const [showFoldersPane, setShowFoldersPane] = useState(true);
  const addressInputRef = useRef(null);

  const replaceSelection = useCallback((paths) => {
    const nextSelection =
      paths instanceof Set ? new Set(paths) : new Set(paths || []);
    setSelectedPaths((currentSelection) =>
      selectionSetsEqual(currentSelection, nextSelection)
        ? currentSelection
        : nextSelection,
    );
  }, []);

  const selectPath = useCallback((path, additive = false) => {
    setSelectedPaths((currentSelection) =>
      updateSelection(currentSelection, path, additive),
    );
  }, []);

  const currentNode = fileSystemRuntime?.getNode(currentPath);
  const children = useMemo(
    () => fileSystemRuntime?.getChildren(currentPath) || [],
    [fileSystemRuntime, currentPath],
  );
  const sortedChildren = useMemo(
    () => sortNodesByName(children, nameSortDirection),
    [children, nameSortDirection],
  );
  const selectedNodes = useMemo(
    () => sortedChildren.filter((node) => selectedPaths.has(node.path)),
    [selectedPaths, sortedChildren],
  );
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;

  const showDirectory = useCallback(
    (path) => {
      const nextPath = normalizePath(path);
      const nextNode = fileSystemRuntime?.getNode(nextPath);
      if (!nextNode || nextNode.type !== "folder") return null;

      setCurrentPath(nextPath);
      setAddressValue(toWindowsAddress(nextPath));
      setEditingPath(null);
      replaceSelection([]);
      closeContextMenu();

      return nextPath;
    },
    [closeContextMenu, fileSystemRuntime, replaceSelection],
  );

  const navigateTo = useCallback(
    (path) => {
      const nextPath = showDirectory(path);
      if (!nextPath) return null;
      setForwardPaths([]);
      return nextPath;
    },
    [showDirectory],
  );

  const openApplication =
    windowRuntime?.openRootWindow || windowRuntime?.openWindow;

  const openNode = useCallback(
    (node) => {
      if (!node) return;
      if (node.type === "folder") {
        navigateTo(node.path);
        return;
      }

      if (node.type === "shortcut" && node.appId) {
        openApplication?.(node.appId);
        return;
      }

      if (fileSystemRuntime?.canOpenInNotepad(node)) {
        openApplication?.("notepad", {
          titleOverride: node.name,
          iconOverride: notepadIcon,
          windowProps: { filePath: node.path },
        });
      }
    },
    [fileSystemRuntime, navigateTo, openApplication],
  );

  const goBack = () => {
    const parentPath = getParentPath(currentPath);
    if (!parentPath) return;

    if (showDirectory(parentPath)) {
      setForwardPaths((paths) => [...paths, currentPath]);
    }
  };

  const goForward = () => {
    const nextPath = forwardPaths[forwardPaths.length - 1];
    if (!nextPath) return;
    setForwardPaths((paths) => paths.slice(0, -1));
    showDirectory(nextPath);
  };

  const goUp = () => {
    const parentPath = getParentPath(currentPath);
    if (parentPath) navigateTo(parentPath);
  };

  const submitAddress = () => {
    navigateTo(fromWindowsAddress(addressValue));
  };

  const toggleNameSort = () => {
    setNameSortDirection(getNextSortDirection);
  };

  const focusAddressInput = () => {
    addressInputRef.current?.focus();
  };

  const showProtectedNodeError = async (node) => {
    const message = getProtectedNodeMessage(node);
    if (windowRuntime?.openDialog) {
      await windowRuntime.openDialog("system-confirm-dialog", {
        titleOverride: "Error",
        windowProps: {
          variant: "error",
          message: [message],
          confirmLabel: "OK",
          showCancel: false,
        },
      });
      return;
    }
    window.alert(message);
  };

  const canModifyFolder = (path) => {
    const folderNode = fileSystemRuntime?.getNode(path);
    if (fileSystemRuntime?.canCreateChildren(folderNode)) return true;
    showProtectedNodeError(folderNode);
    return false;
  };

  const createFolder = (targetPath = currentPath) => {
    if (!canModifyFolder(targetPath)) return;
    const path = fileSystemRuntime?.createFolder(targetPath);
    if (!path) return;
    if (targetPath !== currentPath) navigateTo(targetPath);
    replaceSelection([path]);
    setEditingPath(path);
  };

  const createFile = (targetPath = currentPath, fileType = "text") => {
    if (!canModifyFolder(targetPath)) return;
    const path = fileSystemRuntime?.createFile(targetPath, { fileType });
    if (!path) return;
    if (targetPath !== currentPath) navigateTo(targetPath);
    replaceSelection([path]);
    setEditingPath(path);
  };

  const startRenaming = (node) => {
    if (!node) return;
    if (fileSystemRuntime?.isNodeProtected(node)) {
      showProtectedNodeError(node);
      return;
    }
    replaceSelection([node.path]);
    setEditingPath(node.path);
  };

  const commitRename = (node, nextName) => {
    setEditingPath(null);
    if (nextName === node.name) return;
    fileSystemRuntime?.renameNode(node.path, nextName);
    replaceSelection([]);
  };

  const deleteSelectedNodes = async () => {
    if (!selectedNodes.length) return;
    const protectedNode = selectedNodes.find((node) =>
      fileSystemRuntime?.isNodeProtected(node),
    );
    if (protectedNode) {
      await showProtectedNodeError(protectedNode);
      return;
    }
    const message = getRecycleBinConfirmationMessage(selectedNodes.length);

    let confirmed = true;
    if (windowRuntime?.openDialog) {
      const result = await windowRuntime.openDialog("system-confirm-dialog", {
        titleOverride: "Confirm",
        windowProps: {
          message: [message],
          confirmLabel: "Yes",
          cancelLabel: "No",
        },
      });
      confirmed = result === true;
    } else {
      confirmed = window.confirm(message);
    }

    if (!confirmed) return;
    const paths = selectedNodes.map((node) => node.path);
    fileSystemRuntime?.deleteNodes(paths);
    replaceSelection([]);
  };

  const handleContextMenu = (event, node = null) => {
    event.preventDefault();
    event.stopPropagation();
    if (node) {
      if (!selectedPaths.has(node.path)) replaceSelection([node.path]);
    } else {
      replaceSelection([]);
    }
    openContextMenu({
      kind: node ? "items" : "folder",
      x: event.clientX,
      y: event.clientY,
      nodePath: node?.path || null,
    });
  };

  const refreshDirectory = () => {
    setEditingPath(null);
    replaceSelection([]);
  };

  const detailsNode = selectedNode || currentNode;
  const itemCount = children.length;
  const detailsItemCount =
    detailsNode?.type === "folder"
      ? fileSystemRuntime?.getChildren(detailsNode.path)?.length || 0
      : 0;
  const canGoBack = Boolean(getParentPath(currentPath));
  const canGoForward = forwardPaths.length > 0;
  const canDeleteSelection = selectedNodes.length > 0;
  const canRenameSelection = selectedNodes.length === 1;
  const contextNode =
    contextMenu?.kind === "items" && contextMenu.nodePath
    ? fileSystemRuntime?.getNode(contextMenu.nodePath)
    : null;

  return (
    <div className={styles.root}>
      <ExplorerChrome
        addressInputRef={addressInputRef}
        addressValue={addressValue}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onAddressChange={setAddressValue}
        onAddressFocus={focusAddressInput}
        onAddressSubmit={submitAddress}
        onBack={goBack}
        onForward={goForward}
        onToggleFolders={() => setShowFoldersPane((value) => !value)}
        onUp={goUp}
        onViewModeChange={setViewMode}
        viewMode={viewMode}
      />

      <div className={styles.middle}>
        <ExplorerSidebar
          detailsNode={detailsNode}
          itemCount={detailsItemCount}
          onCreateFolder={() => createFolder()}
          onCreateMarkdownFile={() => createFile(currentPath, "markdown")}
          onCreateTextFile={() => createFile(currentPath, "text")}
          onOpenPlace={navigateTo}
          otherPlaces={OTHER_PLACES}
          selectionCount={selectedNodes.length}
          visible={showFoldersPane}
        />
        <ExplorerDirectory
          appsById={appsById}
          editingPath={editingPath}
          items={sortedChildren}
          nameSortDirection={nameSortDirection}
          onCancelRename={() => setEditingPath(null)}
          onClearSelection={() => replaceSelection([])}
          onCommitRename={commitRename}
          onContextMenu={handleContextMenu}
          onDeleteSelection={deleteSelectedNodes}
          onOpenNode={openNode}
          onRenameSelection={() => startRenaming(selectedNode)}
          onSelectAll={() => replaceSelection(sortedChildren.map((node) => node.path))}
          onSelectPath={selectPath}
          onSelectionChange={replaceSelection}
          onToggleNameSort={toggleNameSort}
          selectedPaths={selectedPaths}
          viewMode={viewMode}
        />
      </div>

      <footer className={styles.statusBar}>
        <span>
          {selectedNodes.length
            ? `${selectedNodes.length} object(s) selected`
            : `${itemCount} object(s)`}
        </span>
        <span>{currentPath}</span>
      </footer>

      {contextMenu?.kind === "folder" && (
        <FolderBackgroundContextMenu
          actions={{
            createFolder: () => createFolder(currentPath),
            createMarkdownFile: () => createFile(currentPath, "markdown"),
            createTextFile: () => createFile(currentPath, "text"),
            refresh: refreshDirectory,
          }}
          menu={contextMenu}
          onClose={closeContextMenu}
        />
      )}
      {contextMenu?.kind === "items" && (
        <FileItemContextMenu
          actions={{
            delete: deleteSelectedNodes,
            open: () => openNode(contextNode),
            rename: () => startRenaming(contextNode),
          }}
          canDelete={canDeleteSelection}
          canRename={canRenameSelection}
          itemCount={selectedNodes.length}
          menu={contextMenu}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}

export default Explorer;
