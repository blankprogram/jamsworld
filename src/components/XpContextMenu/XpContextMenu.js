import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import getContextMenuPosition from "./getContextMenuPosition";
import styles from "./XpContextMenu.module.css";

let activeContextMenuCloser = null;

export function useXpContextMenu() {
  const [contextMenu, setContextMenu] = useState(null);
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    if (activeContextMenuCloser === closeContextMenu) {
      activeContextMenuCloser = null;
    }
  }, []);
  const openContextMenu = useCallback(
    (menu) => {
      if (
        activeContextMenuCloser &&
        activeContextMenuCloser !== closeContextMenu
      ) {
        activeContextMenuCloser();
      }
      activeContextMenuCloser = closeContextMenu;
      setContextMenu(menu);
    },
    [closeContextMenu],
  );
  const isOpen = Boolean(contextMenu);

  useEffect(
    () => () => {
      if (activeContextMenuCloser === closeContextMenu) {
        activeContextMenuCloser = null;
      }
    },
    [closeContextMenu],
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeContextMenu();
    };

    window.addEventListener("click", closeContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeContextMenu, isOpen]);

  return { contextMenu, openContextMenu, closeContextMenu };
}

export function XpContextMenuItem({
  children,
  disabled = false,
  onActivate,
}) {
  const activate = () => {
    if (!disabled) onActivate?.();
  };

  return (
    <span
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      className={`${styles.action} ${disabled ? styles.disabled : ""}`}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate();
      }}
    >
      {children}
    </span>
  );
}

export function XpContextMenuSeparator() {
  return <div className={styles.separator} role="separator" />;
}

export function XpContextMenuSubmenu({
  children,
  disabled = false,
  label,
}) {
  const submenuRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({
    opensLeft: false,
    offsetY: 0,
  });

  useLayoutEffect(() => {
    const submenu = submenuRef.current;
    if (!open || !submenu) return;

    const rect = submenu.getBoundingClientRect();
    const viewportPadding = 2;
    const opensLeft = rect.right > window.innerWidth - viewportPadding;
    const offsetY = Math.min(
      0,
      window.innerHeight - viewportPadding - rect.bottom,
    );

    setPlacement({ opensLeft, offsetY });
  }, [open]);

  const openAndFocusFirstItem = () => {
    if (disabled) return;
    setOpen(true);
    window.setTimeout(() => {
      submenuRef.current
        ?.querySelector('[role="menuitem"]:not([aria-disabled="true"])')
        ?.focus();
    }, 0);
  };

  return (
    <div
      className={styles.submenuRoot}
      onMouseEnter={() => {
        if (!disabled) setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          event.stopPropagation();
          openAndFocusFirstItem();
        } else if (event.key === "ArrowLeft" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <span
        ref={triggerRef}
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${styles.action} ${styles.submenuTrigger} ${
          disabled ? styles.disabled : ""
        }`}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          openAndFocusFirstItem();
        }}
      >
        <span>{label}</span>
        <span className={styles.submenuArrow} aria-hidden="true" />
      </span>
      {open && (
        <div
          ref={submenuRef}
          role="menu"
          aria-label={label}
          className={`${styles.menu} ${styles.submenu} ${
            placement.opensLeft ? styles.submenuLeft : ""
          }`}
          style={{ transform: `translateY(${placement.offsetY}px)` }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function XpContextMenu({ children, menu, ...props }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState(() => ({
    left: menu?.x || 0,
    top: menu?.y || 0,
  }));

  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!menu || !element) return;

    const rect = element.getBoundingClientRect();
    setPosition(
      getContextMenuPosition({
        anchorX: menu.x,
        anchorY: menu.y,
        menuHeight: rect.height,
        menuWidth: rect.width,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      }),
    );
  }, [menu]);

  if (!menu) return null;

  const menuElement = (
    <div
      ref={menuRef}
      {...props}
      data-xp-context-menu="true"
      role="menu"
      className={styles.menu}
      style={position}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );

  return typeof document === "undefined"
    ? menuElement
    : createPortal(menuElement, document.body);
}

export default XpContextMenu;
