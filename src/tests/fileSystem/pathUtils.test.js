import {
  DESKTOP_PATH,
  FILE_SYSTEM_ROOT_PATH,
  getParentPath,
  isChildPath,
  joinPath,
  normalizePath,
} from "../../fileSystem/pathUtils";

test("paths form one canonical tree below the C drive root", () => {
  expect(getParentPath(FILE_SYSTEM_ROOT_PATH)).toBeNull();
  expect(getParentPath(DESKTOP_PATH)).toBe(FILE_SYSTEM_ROOT_PATH);
  expect(joinPath(FILE_SYSTEM_ROOT_PATH, "New Folder")).toBe("C:/New Folder");
  expect(isChildPath("C:/Desktop/Projects", FILE_SYSTEM_ROOT_PATH)).toBe(true);
});

test("canonical Windows paths use the internal separator and drive casing", () => {
  expect(normalizePath("c:\\Desktop\\Projects")).toBe("C:/Desktop/Projects");
});
