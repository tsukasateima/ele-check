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
  dialog,
  BrowserWindow
} from "electron";
import * as fs from "fs/promises";
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
// 应用数据存储路径（Electron 专属目录，重启不丢失）
const STORAGE_FILE = join(app.getPath("userData"), "fs_handles.json");
// 初始化存储文件（不存在则创建空对象）
async function initStorageFile() {
  try {
    // ✅ 使用 Promise 版 access
    await fs.access(STORAGE_FILE);
  } catch {
    // ✅ 修正：Promise 版 writeFile 传参正确，无类型错误
    await fs.writeFile(
      STORAGE_FILE,
      JSON.stringify({}, null, 2),
      { encoding: "utf-8" } // 显式指定编码（TS 类型更友好）
    );
  }
}

// 读取所有保存的路径
async function getStoredPaths(): Promise<Record<string, string>> {
  await initStorageFile();
  const content = await fs.readFile(STORAGE_FILE, { encoding: "utf-8" });
  return JSON.parse(content) || {};
}

// -------------------------- IPC 处理器（供渲染进程调用） --------------------------
// 1. 保存路径（无需选择，直接传入路径和 key）
ipcMain.handle("fs:persistPath", async (_, key: string, path: string) => {
  try {
    const storedPaths = await getStoredPaths();
    storedPaths[key] = path;
    await fs.writeFile(STORAGE_FILE, JSON.stringify(storedPaths, null, 2), {
      encoding: "utf-8"
    });
    return true;
  } catch (error) {
    console.error("保存路径失败：", error);
    return false;
  }
});

// 2. 读取保存的路径
ipcMain.handle("fs:restorePath", async (_, key: string) => {
  try {
    const storedPaths = await getStoredPaths();
    return storedPaths[key] || null;
  } catch (error) {
    console.error("读取路径失败：", error);
    return null;
  }
});

// 3. 删除保存的路径
ipcMain.handle("fs:removePath", async (_, key: string) => {
  try {
    const storedPaths = await getStoredPaths();
    delete storedPaths[key];
    await fs.writeFile(
      STORAGE_FILE,
      JSON.stringify(storedPaths, null, 2),
      "utf-8"
    );
    return true;
  } catch (error) {
    console.error("删除路径失败：", error);
    return false;
  }
});
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

app.whenReady().then(createWindow).then(initStorageFile);

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

// 在 createWindow 函数外/内添加（建议放在 createWindow 上方）
ipcMain.handle("dialog:open-directory", async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"], // 仅允许选择文件夹
      title: "选择文件夹",
      defaultPath: process.env.VITE_DEV_SERVER_URL ? "" : app.getPath("desktop") // 兼容开发/生产环境
    });
    if (result.canceled) {
      console.log("用户取消选择文件夹");
      return null; // 取消选择时返回 null
    }
    console.log("选中的文件夹路径：", result.filePaths[0]);
    return result.filePaths[0];
  } catch (error) {
    console.error("文件夹选择对话框异常：", error);
    throw new Error(`选择失败：${error.message}`); // 抛出错误让渲染进程捕获
  }
});
// 注册 fs:persist-path 处理器（持久化路径到文件/本地存储）
ipcMain.handle("fs:persist-path", async (_, { key, dirPath }) => {
  try {
    // 1. 校验参数
    if (!key || !dirPath) {
      throw new Error("缺少必要参数：key 或 dirPath");
    }
    // 2. 确定持久化文件路径（用 app 自带的用户数据目录，避免权限问题）
    const userDataPath = app.getPath("userData"); // 跨平台：Windows/macOS/Linux 通用
    const persistFile = path.join(userDataPath, "path-config.json");

    // 3. 读取现有配置（文件不存在则初始化空对象）
    let config = {};
    try {
      const fileContent = await fs.readFile(persistFile, "utf-8");
      config = JSON.parse(fileContent);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        // 仅忽略“文件不存在”错误，其他错误抛出
        throw new Error(`读取配置文件失败：${err.message}`);
      }
    }

    // 4. 更新配置并写入文件
    config[key] = dirPath;
    await fs.writeFile(persistFile, JSON.stringify(config, null, 2), "utf-8");

    // 5. 返回成功结果
    return { success: true, path: dirPath, message: "路径持久化成功" };
  } catch (error) {
    console.error("路径持久化失败：", error);
    throw new Error(`fs:persist-path 执行失败：${error.message}`);
  }
});
// 可选：注册读取持久化路径的处理器（如果需要回显）
ipcMain.handle("fs:get-persist-path", async (_, key) => {
  try {
    const userDataPath = app.getPath("userData");
    const persistFile = path.join(userDataPath, "path-config.json");
    const fileContent = await fs.readFile(persistFile, "utf-8");
    const config = JSON.parse(fileContent);
    return config[key] || null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null; // 文件不存在返回 null
    }
    throw new Error(`读取持久化路径失败：${err.message}`);
  }
});
