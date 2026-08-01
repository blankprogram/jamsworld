import React, { useEffect, useRef, useState } from "react";

import { splitFileExtension } from "../../fileSystem/pathUtils";

function FileNameEditor({
  ariaLabel,
  className,
  name,
  onCancel,
  onCommit,
  type,
}) {
  const inputRef = useRef(null);
  const finishedRef = useRef(false);
  const { baseName, extension } = splitFileExtension(name);
  const preserveExtension =
    (type === "text" || type === "markdown") && extension;
  const selectionEnd = preserveExtension ? baseName.length : name.length;
  const [value, setValue] = useState(name);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    input.setSelectionRange(0, selectionEnd);
  }, [selectionEnd]);

  const finish = (shouldCommit) => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    let nextName = value.trim();
    if (
      preserveExtension &&
      !nextName.toLowerCase().endsWith(extension.toLowerCase())
    ) {
      nextName += extension;
    }

    if (shouldCommit && nextName) onCommit(nextName);
    else onCancel();
  };

  const stopPropagation = (event) => event.stopPropagation();

  return (
    <input
      ref={inputRef}
      data-selection-control="true"
      className={className}
      aria-label={ariaLabel || `Rename ${name}`}
      value={value}
      spellCheck={false}
      onBlur={() => finish(true)}
      onChange={(event) => setValue(event.target.value)}
      onClick={stopPropagation}
      onDoubleClick={stopPropagation}
      onMouseDown={stopPropagation}
      onPointerDown={stopPropagation}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        }
      }}
    />
  );
}

export default FileNameEditor;
