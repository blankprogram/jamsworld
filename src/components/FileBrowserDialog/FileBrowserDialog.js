import React, { useMemo, useState } from "react";
import { getParentPath, normalizePath } from "../../fileSystem/pathUtils";
import computerIcon from "../../assets/Icons/Computer.png";
import desktopIcon from "../../assets/Icons/Desktop.png";
import documentsIcon from "../../assets/Icons/Document.png";
import folderIcon from "../../assets/Icons/Folder.png";
import folderUpIcon from "../../assets/Icons/FolderUp.png";
import notepadIcon from "../../assets/Icons/notepad.png";
import XpButton from "../XpButton/XpButton";
import styles from "./FileBrowserDialog.module.css";

const COMPUTER_PATH = "C:";

const QUICK_PLACES = [
  { label: "Desktop", path: "C:/Desktop", icon: desktopIcon },
  { label: "My Documents", path: "C:/My Documents", icon: documentsIcon },
  { label: "My Computer", path: COMPUTER_PATH, icon: computerIcon },
];

function FileBrowserControl({
  className,
  role = "button",
  disabled = false,
  onActivate,
  onDoubleClick,
  children,
  ...props
}) {
  return (
    <span
      {...props}
      role={role}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      className={className}
      onClick={disabled ? undefined : onActivate}
      onDoubleClick={disabled ? undefined : onDoubleClick}
      onKeyDown={(event) => {
        if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onActivate?.();
      }}
    >
      {children}
    </span>
  );
}

export default function FileBrowserDialog({
  windowProps = {},
  windowRuntime,
  fileSystemRuntime,
}) {
  const mode = windowProps.mode === "load" ? "load" : "save";
  const fileExtension = String(windowProps.fileExtension || ".json").startsWith(".")
    ? String(windowProps.fileExtension || ".json").toLowerCase()
    : `.${String(windowProps.fileExtension).toLowerCase()}`;
  const fileTypeLabel =
    windowProps.fileTypeLabel || "PixelPass Configuration (JSON)";
  const initialPath = normalizePath(windowProps.defaultPath || "C:/My Pictures");
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [fileName, setFileName] = useState(
    windowProps.fileName || "pixelpass.json",
  );
  const [selectedPath, setSelectedPath] = useState(null);

  const children = useMemo(
    () => fileSystemRuntime?.getChildren(currentPath) || [],
    [currentPath, fileSystemRuntime],
  );
  const folders = children.filter((node) => node.type === "folder");
  const configFiles = children.filter(
    (node) =>
      node?.type !== "folder" &&
      node?.name?.toLowerCase().endsWith(fileExtension),
  );
  const selectedNode = selectedPath
    ? fileSystemRuntime?.getNode(selectedPath)
    : null;
  const parentPath = getParentPath(currentPath);

  const resolve = (value) => windowRuntime?.resolveDialog?.(value);
  const navigate = (path) => {
    setCurrentPath(normalizePath(path));
    setSelectedPath(null);
  };

  const resolveSave = (value) => {
    const name = String(value || "").trim();
    if (!name) return;
    const normalizedName = name.toLowerCase().endsWith(fileExtension)
      ? name
      : `${name}${fileExtension}`;
    resolve({ action: "save", parentPath: currentPath, name: normalizedName });
  };

  const handleSave = () => resolveSave(fileName);

  const handleLoad = () => {
    if (selectedNode) resolve({ action: "load", path: selectedNode.path });
  };

  const handleFileClick = (node) => {
    setSelectedPath(node.path);
    setFileName(node.name);
  };

  const handleFileDoubleClick = (node) => {
    if (node.type === "folder") {
      navigate(node.path);
      return;
    }

    if (mode === "load") {
      resolve({ action: "load", path: node.path });
      return;
    }

    resolveSave(node.name);
  };

  return (
    <div className={styles.root}>
      <div className={styles.locationRow}>
        <label htmlFor="pixelpass-config-location">Look in:</label>
        <input
          id="pixelpass-config-location"
          value={currentPath}
          readOnly
          className={styles.location}
        />
        <FileBrowserControl
          className={styles.iconButton}
          disabled={!parentPath}
          onActivate={() => parentPath && navigate(parentPath)}
          title="Up one level"
          aria-label="Up one level"
        >
          <img src={folderUpIcon} alt="" />
        </FileBrowserControl>
      </div>

      <div className={styles.browser}>
        <aside className={styles.quickPlaces} aria-label="Quick places">
          {QUICK_PLACES.map((place) => (
            <FileBrowserControl
              key={place.path}
              className={`${styles.quickPlace} ${normalizePath(currentPath) === normalizePath(place.path) ? styles.selected : ""}`}
              onActivate={() => navigate(place.path)}
            >
              <img src={place.icon} alt="" />
              <span>{place.label}</span>
            </FileBrowserControl>
          ))}
        </aside>

        <section className={styles.fileArea}>
          <div
            className={styles.fileList}
            role="listbox"
            aria-label="Folders and configurations"
          >
            {folders.map((folder) => (
              <FileBrowserControl
                key={folder.path}
                role="option"
                aria-selected={selectedPath === folder.path}
                className={`${styles.entry} ${selectedPath === folder.path ? styles.selected : ""}`}
                onActivate={() => setSelectedPath(folder.path)}
                onDoubleClick={() => navigate(folder.path)}
              >
                <img src={folderIcon} alt="" />
                <span>{folder.name}</span>
              </FileBrowserControl>
            ))}
            {configFiles.map((file) => (
              <FileBrowserControl
                key={file.path}
                role="option"
                aria-selected={selectedPath === file.path}
                className={`${styles.entry} ${selectedPath === file.path ? styles.selected : ""}`}
                onActivate={() => handleFileClick(file)}
                onDoubleClick={() => handleFileDoubleClick(file)}
              >
                <img src={notepadIcon} alt="" />
                <span>{file.name}</span>
              </FileBrowserControl>
            ))}
          </div>

          <div className={styles.fileOptions}>
            <div className={styles.optionRow}>
              <label htmlFor="pixelpass-config-name">File name:</label>
              <input
                id="pixelpass-config-name"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                autoFocus={mode === "save"}
              />
              <XpButton
                onClick={mode === "save" ? handleSave : handleLoad}
                disabled={mode === "load" && !selectedNode}
              >
                {mode === "save" ? "Save" : "Open"}
              </XpButton>
            </div>
            <div className={styles.optionRow}>
              <label htmlFor="pixelpass-config-type">File type:</label>
              <select id="pixelpass-config-type" defaultValue={fileExtension}>
                <option value={fileExtension}>{fileTypeLabel}</option>
              </select>
              <XpButton onClick={() => resolve(null)}>Cancel</XpButton>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
