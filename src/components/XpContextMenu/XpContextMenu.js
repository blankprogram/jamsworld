import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import getContextMenuPosition, {
  getSubmenuPosition,
} from "./getContextMenuPosition";
import { isXpContextMenuTarget } from "../../utils/contextMenu";
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

    const handleWindowClick = (event) => {
      if (isXpContextMenuTarget(event.target)) return;
      closeContextMenu();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeContextMenu();
    };

    window.addEventListener("click", handleWindowClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleWindowClick);
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
  const [placement, setPlacement] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const submenu = submenuRef.current;
    const trigger = triggerRef.current;
    if (!open || !submenu || !trigger) return;

    setPlacement(
      getSubmenuPosition({
        triggerRect: trigger.getBoundingClientRect(),
        submenuWidth: submenu.getBoundingClientRect().width,
        submenuHeight: submenu.getBoundingClientRect().height,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      }),
    );
  }, [open]);

  const openSubmenu = () => {
    if (disabled) return;
    setOpen(true);
  };

  const closeWhenPointerOrFocusLeaves = (event) => {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      !event.currentTarget.contains(nextTarget)
    ) {
      setOpen(false);
    }
  };

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
      onMouseEnter={openSubmenu}
      onMouseLeave={closeWhenPointerOrFocusLeaves}
      onBlur={closeWhenPointerOrFocusLeaves}
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
          className={`${styles.menu} ${styles.submenu}`}
          style={placement}
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
