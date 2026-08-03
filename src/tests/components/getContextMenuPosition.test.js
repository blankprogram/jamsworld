import getContextMenuPosition, {
  getSubmenuPosition,
} from "../../components/XpContextMenu/getContextMenuPosition";

const getPosition = (overrides = {}) =>
  getContextMenuPosition({
    anchorX: 100,
    anchorY: 100,
    menuHeight: 150,
    menuWidth: 200,
    viewportHeight: 800,
    viewportWidth: 1000,
    ...overrides,
  });

test("uses the cursor as the top-left corner when the menu fits", () => {
  expect(getPosition()).toEqual({ left: 100, top: 100 });
});

test("uses the cursor as the top-right corner near the right edge", () => {
  expect(getPosition({ anchorX: 900 })).toEqual({ left: 700, top: 100 });
});

test("uses the cursor as the bottom-left corner near the bottom edge", () => {
  expect(getPosition({ anchorY: 700 })).toEqual({ left: 100, top: 550 });
});

test("uses the cursor as the bottom-right corner near both edges", () => {
  expect(getPosition({ anchorX: 900, anchorY: 700 })).toEqual({
    left: 700,
    top: 550,
  });
});

test("keeps an oversized menu against the viewport padding", () => {
  expect(
    getPosition({
      anchorX: 1,
      anchorY: 1,
      menuHeight: 900,
      menuWidth: 1100,
    }),
  ).toEqual({ left: 2, top: 2 });
});

test("places a submenu to the right when it fits", () => {
  expect(
    getSubmenuPosition({
      triggerRect: { left: 100, right: 300, top: 200 },
      submenuWidth: 200,
      submenuHeight: 120,
      viewportHeight: 800,
      viewportWidth: 1000,
    }),
  ).toEqual({ left: 298, top: 197 });
});

test("places a submenu to the left near the right edge", () => {
  expect(
    getSubmenuPosition({
      triggerRect: { left: 700, right: 900, top: 700 },
      submenuWidth: 200,
      submenuHeight: 120,
      viewportHeight: 800,
      viewportWidth: 1000,
    }),
  ).toEqual({ left: 502, top: 678 });
});
