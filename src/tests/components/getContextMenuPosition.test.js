import getContextMenuPosition from "../../components/XpContextMenu/getContextMenuPosition";

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
