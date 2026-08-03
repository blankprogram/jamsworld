import React from "react";
import styles from "./SelectionMarquee.module.css";

export default function SelectionMarquee({ marquee, testId }) {
  if (!marquee) return null;

  return (
    <div
      className={styles.root}
      data-testid={testId}
      style={{
        left: marquee.left,
        top: marquee.top,
        width: marquee.width,
        height: marquee.height,
      }}
    />
  );
}
