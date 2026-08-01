import {
  DESKTOP_ACTIONS,
  desktopReducer,
} from "../../desktop/desktopReducer";

const app = {
  id: "test-app",
  windowDefaults: {
    width: 640,
    height: 480,
    minWidth: 320,
    minHeight: 200,
    resizable: true,
  },
};

test("opening a supplied window instance is deterministic", () => {
  const state = {
    windows: [],
    focusedWindowId: null,
    selectedDesktopPaths: [],
  };
  const action = {
    type: DESKTOP_ACTIONS.OPEN_WINDOW_INSTANCE,
    payload: {
      app,
      options: {
        windowId: "window-1",
        rect: { x: 10, y: 20, width: 640, height: 480 },
      },
    },
  };

  expect(desktopReducer(state, action)).toEqual(desktopReducer(state, action));
  expect(desktopReducer(state, action).windows[0].id).toBe("window-1");
});

test("opening a window without an instance id is ignored", () => {
  const state = {
    windows: [],
    focusedWindowId: null,
    selectedDesktopPaths: [],
  };

  expect(
    desktopReducer(state, {
      type: DESKTOP_ACTIONS.OPEN_WINDOW_INSTANCE,
      payload: { app, options: {} },
    }),
  ).toBe(state);
});
