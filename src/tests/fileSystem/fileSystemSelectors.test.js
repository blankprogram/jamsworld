import {
  getChildren,
  getNode,
} from "../../fileSystem/fileSystemSelectors";
import { createInitialFileSystemState } from "../../fileSystem/fileSystemReducer";

test("missing paths do not implicitly resolve to the Desktop", () => {
  const state = createInitialFileSystemState();

  expect(getNode(state, null)).toBeNull();
  expect(getNode(state, "")).toBeNull();
  expect(getChildren(state, undefined)).toEqual([]);
});
