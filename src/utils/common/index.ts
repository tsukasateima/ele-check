// 多层目录选择返回Handler
export const getNestedDirectoryHandle = async (
  baseHandle: FileSystemDirectoryHandle,
  path: string
): Promise<FileSystemDirectoryHandle> => {
  const parts = path.split("/");

  let currentHandle = baseHandle;

  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, {
      create: false
    });
  }

  return currentHandle;
};

/**
 * 读取文件内容并解析为指定编码
 * @param file 文件
 * @param encoding 编码
 * @returns 字符串Promise
 */
export const readFileWithEncoding = async (
  file: File,
  encoding: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const decoder = new TextDecoder(encoding);
      resolve(decoder.decode(buffer));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
