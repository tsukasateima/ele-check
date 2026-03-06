import { ElMessage } from "element-plus";

// 模拟 FileSystemDirectoryHandle 对象（保持原有类型兼容）
interface MockDirectoryHandle {
  kind: "directory";
  name: string;
  path: string;
  queryPermission: (opts: { mode: "read" | "write" }) => Promise<"granted">;
}

// 全局声明 window.electronFs 类型（解决编译报错）
declare global {
  interface Window {
    electronFs: {
      persistPath: (key: string, path: string) => Promise<boolean>;
      restorePath: (key: string) => Promise<string | null>;
      removePath: (key: string) => Promise<void>;
      showDirectoryPicker?: () => Promise<string | null>; // 可选：文件夹选择对话框
    };
  }
}
/**
 * 带文件夹选择的版本（如需保留用户选择逻辑）
 */
export async function pickAndPersistDirectory(
  targetRef: { value: MockDirectoryHandle | null },
  persistKey: string,
  options?: {
    successMessage?: string;
    errorMessage?: string;
  }
) {
  const normalizedOptions = {
    successMessage: "文件夹选择成功，已持久化",
    errorMessage: "文件夹选择失败",
    ...options
  };

  try {
    // 调用 Electron 原生选择对话框（需在 main.ts 中实现）
    const directoryPath = await window.electronFs.showDirectoryPicker?.();
    if (!directoryPath) return null;

    const mockHandle: MockDirectoryHandle = {
      kind: "directory",
      name: directoryPath.split(/[\\/]/).pop()!,
      path: directoryPath,
      queryPermission: async () => "granted"
    };

    await window.electronFs.persistPath(persistKey, directoryPath);
    targetRef.value = mockHandle;
    ElMessage.success(normalizedOptions.successMessage);
    return mockHandle;
  } catch (error) {
    ElMessage.error(normalizedOptions.errorMessage);
    console.error(normalizedOptions.errorMessage, error);
    return null;
  }
}

/**
 * 恢复持久化的路径（重建模拟句柄）
 */
export async function restoreHandle(
  key: string
): Promise<MockDirectoryHandle | null> {
  try {
    // 从 Electron 应用目录读取路径
    const directoryPath = await window.electronFs.restorePath(key);
    if (!directoryPath) return null;

    // 重建模拟句柄
    return {
      kind: "directory",
      name: directoryPath.split(/[\\/]/).pop()!,
      path: directoryPath,
      queryPermission: async () => "granted"
    };
  } catch (error) {
    console.error("恢复句柄失败：", error);
    return null;
  }
}

/**
 * 页面刷新/重启恢复句柄（保留原有逻辑）
 */
export async function restoreDirectoryHandle(
  targetRef: { value: MockDirectoryHandle | null },
  persistKey: string,
  options?: {
    warnMessage?: string;
  }
) {
  const warnMessage = options?.warnMessage ?? "句柄恢复失败或无权限";
  try {
    const handle = await restoreHandle(persistKey);

    if (
      handle &&
      (await handle.queryPermission({ mode: "read" })) === "granted"
    ) {
      targetRef.value = handle;
      return handle;
    }

    console.warn(warnMessage);
    return null;
  } catch (error) {
    console.warn(warnMessage, error);
    return null;
  }
}

/**
 * 保存路径（保留原有函数名）
 */
export async function persistHandle(
  key: string,
  handle: MockDirectoryHandle
): Promise<void> {
  await window.electronFs.persistPath(key, handle.path);
}

/**
 * 删除路径（保留原有函数名）
 */
export async function removeHandle(key: string): Promise<void> {
  await window.electronFs.removePath(key);
}
