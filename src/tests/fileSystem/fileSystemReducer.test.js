import {
  FILE_SYSTEM_ACTIONS,
  createInitialFileSystemState,
  fileSystemReducer,
} from "../../fileSystem/fileSystemReducer";
import {
  DESKTOP_PATH,
  FILE_SYSTEM_ROOT_PATH,
  joinPath,
} from "../../fileSystem/pathUtils";

const CREATED_AT = "2026-08-01T01:00:00.000Z";
const RENAMED_AT = "2026-08-01T02:00:00.000Z";
const DOCUMENTS_PATH = joinPath(FILE_SYSTEM_ROOT_PATH, "My Documents");
const PROJECTS_PATH = joinPath(DESKTOP_PATH, "Projects");
const TEMPORARY_PATH = joinPath(DESKTOP_PATH, "Temporary");
const NOTES_PATH = joinPath(TEMPORARY_PATH, "Notes.txt");
const WELCOME_PATH = joinPath(DESKTOP_PATH, "Welcome.md");

test("DELETE_NODES removes user-created subtrees atomically", () => {
  const initialState = createInitialFileSystemState();
  const withFolder = fileSystemReducer(initialState, {
    type: FILE_SYSTEM_ACTIONS.CREATE_FOLDER,
    payload: {
      parentPath: DESKTOP_PATH,
      path: TEMPORARY_PATH,
    },
  });
  const withFile = fileSystemReducer(withFolder, {
    type: FILE_SYSTEM_ACTIONS.CREATE_FILE,
    payload: {
      parentPath: TEMPORARY_PATH,
      path: NOTES_PATH,
      fileType: "text",
    },
  });
  const nextState = fileSystemReducer(withFile, {
    type: FILE_SYSTEM_ACTIONS.DELETE_NODES,
    payload: { paths: [TEMPORARY_PATH] },
  });

  expect(nextState.nodes[TEMPORARY_PATH]).toBeUndefined();
  expect(nextState.nodes[NOTES_PATH]).toBeUndefined();
});

test("preset nodes cannot be renamed, written, or deleted", () => {
  const initialState = createInitialFileSystemState();
  const renamedState = fileSystemReducer(initialState, {
    type: FILE_SYSTEM_ACTIONS.RENAME_NODE,
    payload: { path: WELCOME_PATH, name: "Changed.md" },
  });
  const writtenState = fileSystemReducer(initialState, {
    type: FILE_SYSTEM_ACTIONS.WRITE_FILE,
    payload: { path: WELCOME_PATH, content: "Changed" },
  });
  const deletedState = fileSystemReducer(initialState, {
    type: FILE_SYSTEM_ACTIONS.DELETE_NODES,
    payload: {
      paths: [joinPath(PROJECTS_PATH, "PixelPass"), WELCOME_PATH],
    },
  });

  expect(renamedState).toBe(initialState);
  expect(writtenState).toBe(initialState);
  expect(deletedState).toBe(initialState);
});

test("protected preset folders accept user-created children", () => {
  const initialState = createInitialFileSystemState();
  const projectState = fileSystemReducer(initialState, {
    type: FILE_SYSTEM_ACTIONS.CREATE_FILE,
    payload: {
      parentPath: PROJECTS_PATH,
      path: joinPath(PROJECTS_PATH, "Notes.txt"),
      fileType: "text",
    },
  });
  const documentsState = fileSystemReducer(projectState, {
    type: FILE_SYSTEM_ACTIONS.CREATE_FOLDER,
    payload: {
      parentPath: DOCUMENTS_PATH,
      path: joinPath(DOCUMENTS_PATH, "New Folder"),
    },
  });

  expect(
    documentsState.nodes[joinPath(PROJECTS_PATH, "Notes.txt")],
  ).toMatchObject({
    parentPath: PROJECTS_PATH,
    source: "user",
    type: "text",
  });
  expect(
    documentsState.nodes[joinPath(DOCUMENTS_PATH, "New Folder")],
  ).toMatchObject({
    parentPath: DOCUMENTS_PATH,
    source: "user",
    type: "folder",
  });
});

test("create actions cannot escape their parent or overwrite preset nodes", () => {
  const initialState = createInitialFileSystemState();
  const missingParentState = fileSystemReducer(initialState, {
    type: FILE_SYSTEM_ACTIONS.CREATE_FOLDER,
    payload: { name: "Unexpected" },
  });
  const escapedState = fileSystemReducer(initialState, {
    type: FILE_SYSTEM_ACTIONS.CREATE_FILE,
    payload: {
      parentPath: DOCUMENTS_PATH,
      path: joinPath(DESKTOP_PATH, "Escaped.txt"),
      fileType: "text",
    },
  });
  const overwrittenState = fileSystemReducer(initialState, {
    type: FILE_SYSTEM_ACTIONS.CREATE_FOLDER,
    payload: {
      parentPath: DESKTOP_PATH,
      path: PROJECTS_PATH,
    },
  });

  expect(missingParentState).toBe(initialState);
  expect(escapedState).toBe(initialState);
  expect(overwrittenState).toBe(initialState);
});

test("the preset includes empty top-level Other Places folders", () => {
  const initialState = createInitialFileSystemState();
  const folderNames = ["My Documents", "My Pictures", "My Music", "My Videos"];

  expect(initialState.nodes[FILE_SYSTEM_ROOT_PATH]).toMatchObject({
    path: FILE_SYSTEM_ROOT_PATH,
    name: "Local Disk (C:)",
    type: "folder",
    parentPath: null,
    system: true,
    allowChildren: true,
  });

  folderNames.forEach((folderName) => {
    const path = joinPath(FILE_SYSTEM_ROOT_PATH, folderName);
    expect(initialState.nodes[path]).toMatchObject({
      name: folderName,
      type: "folder",
      parentPath: FILE_SYSTEM_ROOT_PATH,
      readOnly: true,
      allowChildren: true,
    });
    expect(initialState.nodes[joinPath(DESKTOP_PATH, folderName)]).toBeUndefined();
    expect(
      Object.values(initialState.nodes).filter((node) => node.parentPath === path),
    ).toHaveLength(0);
  });
});

test("actions provide deterministic modification timestamps", () => {
  const initialState = createInitialFileSystemState();
  const createFolderAction = {
    type: FILE_SYSTEM_ACTIONS.CREATE_FOLDER,
    payload: {
      parentPath: DESKTOP_PATH,
      path: TEMPORARY_PATH,
      modified: CREATED_AT,
    },
  };
  const firstState = fileSystemReducer(initialState, createFolderAction);
  const secondState = fileSystemReducer(initialState, createFolderAction);
  const withFile = fileSystemReducer(firstState, {
    type: FILE_SYSTEM_ACTIONS.CREATE_FILE,
    payload: {
      parentPath: TEMPORARY_PATH,
      path: NOTES_PATH,
      fileType: "text",
      modified: CREATED_AT,
    },
  });
  const renamedState = fileSystemReducer(withFile, {
    type: FILE_SYSTEM_ACTIONS.RENAME_NODE,
    payload: {
      path: TEMPORARY_PATH,
      name: "Archive",
      modified: RENAMED_AT,
    },
  });

  expect(firstState).toEqual(secondState);
  const archivePath = joinPath(DESKTOP_PATH, "Archive");
  expect(renamedState.nodes[archivePath]).toMatchObject({
    modified: RENAMED_AT,
    name: "Archive",
  });
  expect(renamedState.nodes[joinPath(archivePath, "Notes.txt")]).toMatchObject({
    modified: RENAMED_AT,
    parentPath: archivePath,
  });
});
