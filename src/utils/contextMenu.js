export const XP_CONTEXT_MENU_SELECTOR = '[data-xp-context-menu="true"]';

export const isXpContextMenuTarget = (target) =>
  typeof Element !== "undefined" &&
  target instanceof Element &&
  Boolean(target.closest(XP_CONTEXT_MENU_SELECTOR));
