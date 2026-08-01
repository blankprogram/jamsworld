import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { createAppManifest } from "../createAppManifest";
import notepadIcon from "../../assets/Icons/notepad.png";

import styles from "./Notepad.module.css";

export const appManifest = createAppManifest({
  id: "notepad",
  title: "Notepad",
  icon: notepadIcon,
  windowDefaults: {
    width: 840,
    height: 620,
    minWidth: 500,
    minHeight: 340,
  },
});

const MENU_ITEMS = ["File", "Edit", "Format", "View", "Help"];

const runOnKeyboardActivate = (event, callback) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  callback();
};

function NotepadCommand({ children, disabled = false, onActivate, className }) {
  const activate = () => {
    if (disabled) return;
    onActivate?.();
  };

  return (
    <span
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      className={`${styles.notepadCommand} ${className || ""} ${
        disabled ? styles.disabledCommand : ""
      }`}
      onClick={activate}
      onKeyDown={(event) => runOnKeyboardActivate(event, activate)}
    >
      {children}
    </span>
  );
}

const Notepad = ({ windowProps = {}, fileSystemRuntime }) => {
  const filePath = windowProps.filePath || null;
  const defaultMode = windowProps.defaultMode === "preview" ? "preview" : "edit";
  const fileNode = filePath ? fileSystemRuntime?.getNode(filePath) : null;
  const canSaveFile = Boolean(
    fileNode && fileSystemRuntime?.canEditNode(fileNode),
  );
  const [draft, setDraft] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [previewMode, setPreviewMode] = useState(defaultMode === "preview");

  useEffect(() => {
    setPreviewMode(defaultMode === "preview");
  }, [defaultMode, filePath]);

  useEffect(() => {
    const content = String(fileNode?.content ?? "");
    setDraft(content);
    setSavedContent(content);
  }, [fileNode]);

  const dirty = Boolean(fileNode && draft !== savedContent);
  let title = filePath ? "Missing file" : "Untitled.txt";
  if (fileNode?.name) title = `${fileNode.name}${dirty ? " *" : ""}`;

  const save = () => {
    if (!canSaveFile) return;
    fileSystemRuntime.writeFile(fileNode.path, draft);
    setSavedContent(draft);
  };

  const toggleMode = () => {
    setPreviewMode((value) => !value);
  };

  return (
    <div className={styles.notepadXp}>
      <div className={styles.notepadMenuBar}>
        <div className={styles.notepadMenuItems}>
          {MENU_ITEMS.map((item) => (
            <span key={item} className={styles.notepadMenuItem}>
              {item}
            </span>
          ))}
        </div>
        <span className={styles.fileName}>{title}</span>
        <div className={styles.notepadActions}>
          <NotepadCommand disabled={!canSaveFile || !dirty} onActivate={save}>
            Save
          </NotepadCommand>
          <NotepadCommand
            disabled={!dirty}
            onActivate={() => setDraft(savedContent)}
          >
            Revert
          </NotepadCommand>
          <NotepadCommand
            className={styles.modeCommand}
            disabled={!fileNode}
            onActivate={toggleMode}
          >
            {previewMode ? "Edit" : "Preview"}
          </NotepadCommand>
        </div>
      </div>

      {previewMode ? (
        <div className={styles.notepadPreview}>
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{draft}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          className={styles.notepadTextarea}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck
        />
      )}
    </div>
  );
};

export default Notepad;
