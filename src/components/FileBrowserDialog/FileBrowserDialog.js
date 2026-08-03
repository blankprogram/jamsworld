import React, { useMemo, useState } from "react";
import { getParentPath, normalizePath } from "../../fileSystem/pathUtils";
import computerIcon from "../../assets/Icons/Computer.png";
import desktopIcon from "../../assets/Icons/Desktop.png";
import documentsIcon from "../../assets/Icons/Document.png";
import fileIcon from "../../assets/Icons/nofile.png";
import folderIcon from "../../assets/Icons/Folder.png";
import folderUpIcon from "../../assets/Icons/FolderUp.png";
import XpButton from "../XpButton/XpButton";
import styles from "./FileBrowserDialog.module.css";

const COMPUTER_PATH = "C:";

const QUICK_PLACES = [
  { label: "Desktop", path: "C:/Desktop", icon: desktopIcon },
  { label: "My Documents", path: "C:/My Documents", icon: documentsIcon },
  { label: "My Computer", path: COMPUTER_PATH, icon: computerIcon },
];

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

  const handleSave = () => {
    const name = fileName.trim();
    if (!name) return;
    const normalizedName = name.toLowerCase().endsWith(fileExtension)
      ? name
      : `${name}${fileExtension}`;
    resolve({ action: "save", parentPath: currentPath, name: normalizedName });
  };

  const handleLoad = () => {
    if (selectedNode) resolve({ action: "load", path: selectedNode.path });
  };

  const handleFileClick = (node) => {
    setSelectedPath(node.path);
    setFileName(node.name);
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
        <button
          type="button"
          className={styles.iconButton}
          disabled={!parentPath}
          onClick={() => parentPath && navigate(parentPath)}
          title="Up one level"
          aria-label="Up one level"
        >
          <img src={folderUpIcon} alt="" />
        </button>
      </div>

      <div className={styles.browser}>
        <aside className={styles.quickPlaces} aria-label="Quick places">
          {QUICK_PLACES.map((place) => (
            <button
              type="button"
              key={place.path}
              className={styles.quickPlace}
              onClick={() => navigate(place.path)}
            >
              <img src={place.icon} alt="" />
              <span>{place.label}</span>
            </button>
          ))}
        </aside>

        <section className={styles.fileArea}>
          <div
            className={styles.fileList}
            role="listbox"
            aria-label="Folders and configurations"
          >
            {folders.map((folder) => (
              <button
                type="button"
                key={folder.path}
                className={styles.entry}
                onClick={() => setSelectedPath(folder.path)}
                onDoubleClick={() => navigate(folder.path)}
              >
                <img src={folderIcon} alt="" />
                <span>{folder.name}</span>
              </button>
            ))}
            {configFiles.map((file) => (
              <button
                type="button"
                key={file.path}
                className={`${styles.entry} ${selectedPath === file.path ? styles.selected : ""}`}
                onClick={() => handleFileClick(file)}
              >
                <img src={fileIcon} alt="" />
                <span>{file.name}</span>
              </button>
            ))}
            {!folders.length && !configFiles.length && (
              <div className={styles.empty}>This folder is empty.</div>
            )}
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
