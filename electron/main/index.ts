import { release } from "node:os";
import { fileURLToPath } from "node:url";
import path, { join, dirname } from "node:path";
import {
  type MenuItem,
  type MenuItemConstructorOptions,
  app,
  Menu,
  shell,
  ipcMain,
  BrowserWindow,
  dialog,
  type IpcMainInvokeEvent
} from "electron";
import fs from "fs/promises";
// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
process.env.DIST_ELECTRON = join(__dirname, "..");
process.env.DIST = join(process.env.DIST_ELECTRON, "../dist");
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, "../public")
  : process.env.DIST;
// 是否为开发环境
const isDev = process.env["NODE_ENV"] === "development";

// Disable GPU Acceleration for Windows 7
if (release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null;
// Here, you can also use other preload
const preload = join(__dirname, "../preload/index.mjs");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, "index.html");

// 创建菜单
function createMenu(label = "进入全屏幕") {
  const menu = Menu.buildFromTemplate(
    appMenu(label) as (MenuItemConstructorOptions | MenuItem)[]
  );
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 1024,
    minHeight: 768,
    title: "Main window",
    icon: join(process.env.PUBLIC, "favicon.ico"),
    webPreferences: {
      preload
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    // electron-vite-vue#298
    win.loadURL(url);
    // Open devTool if the app is not packaged
    // win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }

  createMenu();

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });
  // win.webContents.on('will-navigate', (event, url) => { }) #344

  // 窗口进入全屏状态时触发
  win.on("enter-full-screen", () => {
    createMenu("退出全屏幕");
  });

  // 窗口离开全屏状态时触发
  win.on("leave-full-screen", () => {
    createMenu();
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// 菜单栏 https://www.electronjs.org/zh/docs/latest/api/menu-item#%E8%8F%9C%E5%8D%95%E9%A1%B9
const appMenu = (fullscreenLabel: string) => {
  const menuItems = [
    { label: "关于", role: "about" },
    { label: "开发者工具", role: "toggleDevTools" },
    { label: "强制刷新", role: "forcereload" },
    { label: "退出", role: "quit" }
  ];
  // 生产环境删除开发者工具菜单
  if (!isDev) menuItems.splice(1, 1);
  const template = [
    {
      label: app.name,
      submenu: menuItems
    },
    {
      label: "编辑",
      submenu: [
        { label: "撤销", role: "undo" },
        {
          label: "重做",
          role: "redo"
        },
        { type: "separator" },
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { label: "删除", role: "delete" },
        { label: "全选", role: "selectAll" }
      ]
    },
    {
      label: "显示",
      submenu: [
        { label: "加大", role: "zoomin" },
        {
          label: "默认大小",
          role: "resetzoom"
        },
        { label: "缩小", role: "zoomout" },
        { type: "separator" },
        {
          label: fullscreenLabel,
          role: "togglefullscreen"
        }
      ]
    }
  ];
  return template;
};

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});

// 存储路径：用户数据目录下的 directory-cache.json
const getCacheFilePath = () => {
  const userDataPath = app.getPath("userData"); // Electron内置用户数据目录
  return path.join(userDataPath, "directory-cache.json");
};

ipcMain.handle("dialog:open-directory", async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"], // 仅允许选择文件夹
      title: "选择目标文件夹",
      buttonLabel: "确认选择"
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, path: null };
    }
    return { success: true, path: result.filePaths[0] };
  } catch (error) {
    console.error("打开文件夹选择框失败：", error);
    return { success: false, path: null, error: error.message };
  }
});
// 2. 持久化文件夹路径（按tag缓存）
ipcMain.handle(
  "directory:persist",
  async (
    _: IpcMainInvokeEvent,
    { tag, dirPath }: { tag: string; dirPath: string }
  ) => {
    try {
      if (!tag || !dirPath) {
        throw new Error("tag和dirPath不能为空");
      }

      const cacheFile = getCacheFilePath();
      let cacheData: Record<string, string> = {};

      // 读取现有缓存
      try {
        const fileContent = await fs.readFile(cacheFile, "utf-8");
        cacheData = JSON.parse(fileContent);
      } catch (err) {
        // 文件不存在则创建空对象
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }

      // 更新缓存
      cacheData[tag] = dirPath;
      await fs.writeFile(
        cacheFile,
        JSON.stringify(cacheData, null, 2),
        "utf-8"
      );

      return { success: true, tag, dirPath };
    } catch (error) {
      console.error("持久化文件夹路径失败：", error);
      return { success: false, error: error.message };
    }
  }
);

// 3. 读取缓存的文件夹路径（按tag读取）
ipcMain.handle(
  "directory:get-persisted",
  async (_: IpcMainInvokeEvent, tag: string) => {
    try {
      if (!tag) {
        throw new Error("tag不能为空");
      }

      const cacheFile = getCacheFilePath();
      let cacheData: Record<string, string> = {};

      // 读取缓存文件
      try {
        const fileContent = await fs.readFile(cacheFile, "utf-8");
        cacheData = JSON.parse(fileContent);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }

      return {
        success: true,
        path: cacheData[tag] || null, // 无缓存返回null
        tag
      };
    } catch (error) {
      console.error("读取缓存路径失败：", error);
      return { success: false, error: error.message };
    }
  }
);
