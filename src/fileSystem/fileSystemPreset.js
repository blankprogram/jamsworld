import { FILE_SYSTEM_ROOT_PATH, joinPath, normalizePath } from "./pathUtils";
import { PROJECTS } from "../content/projects";

const PRESET_MODIFIED = "2026-08-01T00:00:00.000Z";

const createPresetNode = (type, name, options = {}) => ({
  type,
  name,
  modified: options.modified || PRESET_MODIFIED,
  system: !!options.system,
  readOnly: options.readOnly !== false,
  ...(type === "folder" && {
    allowChildren: options.allowChildren !== false,
  }),
  source: "preset",
  content: options.content,
  appId: options.appId,
  children: options.children || [],
});

export const folder = (name, children = [], options = {}) =>
  createPresetNode("folder", name, { ...options, children });

export const markdownFile = (name, content = "", options = {}) =>
  createPresetNode("markdown", name, { ...options, content });

export const textFile = (name, content = "", options = {}) =>
  createPresetNode("text", name, { ...options, content });

export const shortcut = (name, appId, options = {}) =>
  createPresetNode("shortcut", name, { ...options, appId });

const createProjectFolder = ({ name, appId, writeup }) =>
  folder(name, [
    markdownFile(`${name}.md`, writeup),
    shortcut(name, appId),
  ]);

const welcomeWriteup = `# Hi there, I'm Jamal Elmir

### Just a dude that does stuff and who enjoys messing around : )

<span style="color:pink">Kirby Enthusiast!</span>

---

![Kirby](./kirby.gif)

---

## Contact Me

- [**Email**](mailto:jelmirapp@gmail.com)
- [**LinkedIn**](https://www.linkedin.com/in/jamalelmir/)
`;

const FILE_SYSTEM_PRESET = folder(
  "Local Disk (C:)",
  [
    folder(
      "Desktop",
      [
        folder("Projects", PROJECTS.map(createProjectFolder)),
        markdownFile("Welcome.md", welcomeWriteup),
        shortcut("Internet Explorer", "internet-explorer"),
        shortcut("PixelPass", "pixelpass"),
        shortcut("Asciify", "asciify"),
        shortcut("Pixort", "pixort"),
        shortcut("CircFinity", "circfinity"),
        shortcut("ElementSim", "elementsim"),
        shortcut("Minecraft", "minecraft"),
        shortcut("Minesweeper", "minesweeper"),
        shortcut("Paint", "paint"),
        shortcut("Winamp", "winamp"),
      ],
      { system: true, readOnly: false },
    ),
    folder("My Documents"),
    folder("My Pictures"),
    folder("My Music"),
    folder("My Videos"),
  ],
  {
    system: true,
    readOnly: false,
  },
);

const flattenPresetTree = (
  node,
  path = node.name,
  parentPath = null,
  order = 0,
) => {
  const normalizedPath = normalizePath(path);
  const nodes = {
    [normalizedPath]: {
      ...node,
      path: normalizedPath,
      parentPath,
      order,
    },
  };
  delete nodes[normalizedPath].children;

  (node.children || []).forEach((child, childIndex) => {
    Object.assign(
      nodes,
      flattenPresetTree(
        child,
        joinPath(normalizedPath, child.name),
        normalizedPath,
        childIndex,
      ),
    );
  });

  return nodes;
};

export const createPresetFileSystem = () => ({
  nodes: flattenPresetTree(FILE_SYSTEM_PRESET, FILE_SYSTEM_ROOT_PATH),
});
