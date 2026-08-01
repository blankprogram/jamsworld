import React, { useEffect, useRef } from "react";
import errorIcon from "../../assets/Icons/Error.png";
import questionIcon from "../../assets/Icons/Question.png";
import XpButton from "../XpButton/XpButton";
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
  const confirmButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const isError = windowProps.variant === "error";
  const icon = isError ? errorIcon : questionIcon;
  const confirmLabel = windowProps.confirmLabel || "OK";
  const cancelLabel = windowProps.cancelLabel || "Cancel";
  const showCancel = windowProps.showCancel !== false;
  const messageLines = toMessageLines(windowProps.message);

  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  const resolve = (value) => {
    windowRuntime?.resolveDialog?.(value);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      resolve(false);
      return;
    }
    if (event.key !== "Tab") return;

    const buttons = [confirmButtonRef.current, cancelButtonRef.current].filter(
      Boolean,
    );
    if (!buttons.length) return;

    const currentIndex = buttons.indexOf(document.activeElement);
    const isLeavingStart = event.shiftKey && currentIndex <= 0;
    const isLeavingEnd = !event.shiftKey && currentIndex === buttons.length - 1;
    if (!isLeavingStart && !isLeavingEnd && currentIndex >= 0) return;

    event.preventDefault();
    const nextButton = event.shiftKey ? buttons[buttons.length - 1] : buttons[0];
    nextButton.focus();
  };

  return (
    <div
      className={styles.root}
      role="alertdialog"
      aria-modal="true"
      onKeyDown={handleKeyDown}
    >
      <div className={styles.body}>
        <img className={styles.icon} src={icon} alt="" />
        <div className={styles.messages}>
          {messageLines.map((line, index) => (
            <p key={`${index}-${line}`} className={styles.message}>
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className={styles.actions}>
        <XpButton
          ref={confirmButtonRef}
          onClick={() => resolve(true)}
        >
          {confirmLabel}
        </XpButton>
        {showCancel && (
          <XpButton
            ref={cancelButtonRef}
            onClick={() => resolve(false)}
          >
            {cancelLabel}
          </XpButton>
        )}
      </div>
    </div>
  );
}
