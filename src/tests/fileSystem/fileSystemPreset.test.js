import { PROJECTS } from "../../content/projects";
import { createPresetFileSystem } from "../../fileSystem/fileSystemPreset";
import { DESKTOP_PATH, joinPath } from "../../fileSystem/pathUtils";

test("project manifests create matching folders, writeups, and shortcuts", () => {
  const { nodes } = createPresetFileSystem();
  const projectsPath = joinPath(DESKTOP_PATH, "Projects");

  PROJECTS.forEach(({ name, appId, writeup }) => {
    const projectPath = joinPath(projectsPath, name);

    expect(nodes[projectPath]).toMatchObject({
      name,
      type: "folder",
    });
    expect(nodes[joinPath(projectPath, `${name}.md`)]).toMatchObject({
      content: writeup,
      type: "markdown",
    });
    expect(nodes[joinPath(projectPath, name)]).toMatchObject({
      appId,
      type: "shortcut",
    });
  });
});
