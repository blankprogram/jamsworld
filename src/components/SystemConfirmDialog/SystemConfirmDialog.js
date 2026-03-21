import React, { useMemo } from "react";
import styles from "./SystemConfirmDialog.module.css";

const toMessageLines = (message) => {
  if (Array.isArray(message)) {
    return message.filter((line) => typeof line === "string" && line.trim().length > 0);
  }
  if (typeof message === "string" && message.trim().length > 0) {
    return [message];
  }
  return ["Are you sure?"];
};

export default function SystemConfirmDialog({ windowProps = {}, windowRuntime }) {
  const title = windowProps.title || "Confirm";
  const confirmLabel = windowProps.confirmLabel || "OK";
  const cancelLabel = windowProps.cancelLabel || "Cancel";
  const messageLines = useMemo(
    () => toMessageLines(windowProps.message),
    [windowProps.message],
  );

  return (
    <div className={styles.root}>
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {messageLines.map((line, index) => (
          <p key={`${index}-${line}`} className={styles.message}>
            {line}
          </p>
        ))}
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className="xpButton"
          onClick={() => windowRuntime?.resolveDialog?.(true)}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          className="xpButton"
          onClick={() => windowRuntime?.resolveDialog?.(false)}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
