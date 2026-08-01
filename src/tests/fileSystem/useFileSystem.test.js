import { act, renderHook } from "@testing-library/react";

import { DESKTOP_PATH, joinPath } from "../../fileSystem/pathUtils";
import { useFileSystem } from "../../fileSystem/useFileSystem";

const STORAGE_KEY = "jamsworld:file-system";

beforeEach(() => {
  window.localStorage.clear();
});

test("persists user-created files across mounts", () => {
  const { result: initialResult, unmount } = renderHook(() => useFileSystem());

  let filePath;
  act(() => {
    filePath = initialResult.current.createFile(DESKTOP_PATH, {
      name: "Portfolio.txt",
      content: "Project notes",
    });
  });
  unmount();

  const { result: restoredResult } = renderHook(() => useFileSystem());
  expect(restoredResult.current.getNode(filePath)).toMatchObject({
    path: joinPath(DESKTOP_PATH, "Portfolio.txt"),
    content: "Project notes",
    source: "user",
  });
});

test("ignores persisted data from an unsupported schema", () => {
  const filePath = joinPath(DESKTOP_PATH, "Stale.txt");
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 999,
      userNodes: {
        [filePath]: {
          path: filePath,
          parentPath: DESKTOP_PATH,
          name: "Stale.txt",
          type: "text",
          source: "user",
        },
      },
    }),
  );

  const { result } = renderHook(() => useFileSystem());
  expect(result.current.getNode(filePath)).toBeNull();
});
