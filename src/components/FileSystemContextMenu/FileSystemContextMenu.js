import React from "react";

import XpContextMenu, {
  XpContextMenuItem,
  XpContextMenuSeparator,
  XpContextMenuSubmenu,
} from "../XpContextMenu/XpContextMenu";

const hasAction = (action) => typeof action === "function";

function MenuAction({ action, children, disabled = false, onClose }) {
  return (
    <XpContextMenuItem
      disabled={disabled || !hasAction(action)}
      onActivate={() => {
        onClose();
        action();
      }}
    >
      {children}
    </XpContextMenuItem>
  );
}

export function FolderBackgroundContextMenu({
  actions = {},
  menu,
  onClose,
}) {
  if (!menu) return null;

  const canCreate =
    hasAction(actions.createFolder) ||
    hasAction(actions.createTextFile) ||
    hasAction(actions.createMarkdownFile);

  return (
    <XpContextMenu menu={menu}>
      <XpContextMenuSubmenu label="Arrange Icons By">
        <MenuAction action={actions.arrangeByName} onClose={onClose}>
          Name
        </MenuAction>
        <MenuAction action={actions.arrangeBySize} onClose={onClose}>
          Size
        </MenuAction>
        <MenuAction action={actions.arrangeByType} onClose={onClose}>
          Type
        </MenuAction>
        <MenuAction action={actions.arrangeByModified} onClose={onClose}>
          Modified
        </MenuAction>
        <XpContextMenuSeparator />
        <MenuAction action={actions.autoArrange} onClose={onClose}>
          Auto Arrange
        </MenuAction>
        <MenuAction action={actions.alignToGrid} onClose={onClose}>
          Align to Grid
        </MenuAction>
      </XpContextMenuSubmenu>
      <MenuAction action={actions.refresh} onClose={onClose}>
        Refresh
      </MenuAction>
      <XpContextMenuSeparator />
      <MenuAction action={actions.paste} onClose={onClose}>
        Paste
      </MenuAction>
      <MenuAction action={actions.pasteShortcut} onClose={onClose}>
        Paste Shortcut
      </MenuAction>
      <XpContextMenuSeparator />
      <XpContextMenuSubmenu disabled={!canCreate} label="New">
        <MenuAction action={actions.createFolder} onClose={onClose}>
          Folder
        </MenuAction>
        <MenuAction action={actions.createTextFile} onClose={onClose}>
          Text Document
        </MenuAction>
        <MenuAction action={actions.createMarkdownFile} onClose={onClose}>
          Markdown Document
        </MenuAction>
      </XpContextMenuSubmenu>
      <XpContextMenuSeparator />
      <MenuAction action={actions.properties} onClose={onClose}>
        Properties
      </MenuAction>
    </XpContextMenu>
  );
}

export function FileItemContextMenu({
  actions = {},
  canDelete = false,
  canRename = false,
  itemCount = 0,
  menu,
  onClose,
}) {
  if (!menu) return null;

  const hasSingleItem = itemCount === 1;

  return (
    <XpContextMenu menu={menu}>
      <MenuAction
        action={actions.open}
        disabled={!hasSingleItem}
        onClose={onClose}
      >
        Open
      </MenuAction>
      <MenuAction
        action={actions.openWith}
        disabled={!hasSingleItem}
        onClose={onClose}
      >
        Open With
      </MenuAction>
      <MenuAction
        action={actions.edit}
        disabled={!hasSingleItem}
        onClose={onClose}
      >
        Edit
      </MenuAction>
      <XpContextMenuSeparator />
      <MenuAction
        action={actions.sendTo}
        disabled={!itemCount}
        onClose={onClose}
      >
        Send To
      </MenuAction>
      <XpContextMenuSeparator />
      <MenuAction
        action={actions.print}
        disabled={!hasSingleItem}
        onClose={onClose}
      >
        Print
      </MenuAction>
      <XpContextMenuSeparator />
      <MenuAction
        action={actions.cut}
        disabled={!itemCount}
        onClose={onClose}
      >
        Cut
      </MenuAction>
      <MenuAction
        action={actions.copy}
        disabled={!itemCount}
        onClose={onClose}
      >
        Copy
      </MenuAction>
      <MenuAction
        action={actions.delete}
        disabled={!canDelete}
        onClose={onClose}
      >
        Delete
      </MenuAction>
      <MenuAction
        action={actions.rename}
        disabled={!canRename}
        onClose={onClose}
      >
        Rename
      </MenuAction>
      <XpContextMenuSeparator />
      <MenuAction
        action={actions.properties}
        disabled={!hasSingleItem}
        onClose={onClose}
      >
        Properties
      </MenuAction>
    </XpContextMenu>
  );
}
