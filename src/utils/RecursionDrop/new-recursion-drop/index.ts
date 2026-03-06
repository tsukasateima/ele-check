import {
  type CommonItemRecord,
  type DropChild,
  type DropInnerNode,
  type DropRecord,
  type DropTreeNode,
  DuplicateIdError,
  FatherCommonCellErr,
  mapToCommonItemRecord,
  NotFindIdError,
  NotFindNotifyErr
} from "@/utils/RecursionDrop/types";
import { findNotifyInfoById } from "@/utils/RecursionDrop";
import { readFileWithEncoding } from "@/utils/common";

/**
 * 查找所有的孩子函数 不管孩子是否为空
 * @param obj - 要提取子节点的对象
 * @returns 孩子数组
 */
export function extractChildren(obj: DropRecord): DropChild[] {
  const children: DropChild[] = [];
  const max = Number(obj.ItemMax ?? 0);

  for (let i = 1; i <= max; i++) {
    const child: DropChild = {
      ChildId: i,
      DropType: Number(obj[`DropType_${i}`]),
      ItemID: Number(obj[`ItemID_${i}`]),
      ItemDropRate: Number(obj[`ItemDropRate_${i}`]),
      Count: Number(obj[`Count_${i}`]),
      IsPrecious: Number(obj[`IsPrecious_${i}`])
    };
    children.push(child);
  }

  return children;
}

/**
 * 确定id唯一但是不确定找不找得到
 * @param file 文件
 * @param targetId 查找id
 * @param fieldMapper 列映射函数
 * @returns 空或找到的id
 */
export async function findByIdFromFile<T>(
  file: File,
  targetId: string,
  fieldMapper: (cols: string[]) => T
): Promise<T | null> {
  console.log(file.name);
  // readLast10Lines(file);
  const text = await readFileWithEncoding(file, "utf-8");
  const lines = text.split(/\r?\n/);
  const dataLines = lines.slice(4).filter(line => line.trim());

  const targetNumId = Number(targetId);

  for (const line of dataLines) {
    const cols = line.split(/\t+/);
    const id = Number(cols[0]);
    if (id === targetNumId) {
      return fieldMapper(cols);
    }
  }

  return null;
}
export function checkChildErr(child: DropChild): boolean {
  // 检查child是否为空
  if (
    child.DropType === -1 &&
    child.ItemID === -1 &&
    child.ItemDropRate === -1 &&
    child.Count === -1 &&
    child.IsPrecious === 0
  ) {
    return true;
  }

  // 检查child的基础属性是否配置正确
  if (child.DropType !== 1 && child.DropType !== 2 && child.DropType !== 3) {
    return true;
  }
  if (child.IsPrecious !== 0 && child.IsPrecious !== 1) {
    return true;
  }
  return false;
}
/**
 * 从 CommonItem.txt 文件中使用二分查找找到指定 Id 的记录，并返回对象格式。
 * @param file  CommonItem.txt 文件
 * @param targetId 查找的物品id
 * @returns 返回找到的CommonItem 找不到返回空
 */
export async function findCommonItemById(
  file: File,
  targetId: string
): Promise<CommonItemRecord | null> {
  // 输出file的内容
  return findByIdFromFile<CommonItemRecord>(
    file,
    targetId,
    mapToCommonItemRecord
  );
}

/**
 * 构建递归包数据结构
 * @param rootDrop  根节点
 * @param recursionDropFile  递归包文件
 * @param commonItemFile 物品文件
 * @returns 树根节点
 */
export async function buildDropTreeRootNode(
  dropRecord: DropRecord,
  recursionDropFile: File,
  commonItemFile: File
): Promise<DropInnerNode> {
  const children = extractChildren(dropRecord);

  const treeChildren: DropTreeNode[] = [];

  let hasRootProbErr = false; // 【新增】
  const rootMsg: string | undefined = undefined; // 【新增】
  const dropType = Number(dropRecord.DropType); // 【新增】获取根或包的类型

  for (const child of children) {
    const itemIdStr = String(child.ItemID);

    // 概率校验逻辑（只校验这一层的孩子）
    const rate = Number(child.ItemDropRate);
    if (dropType === 1) {
      if (rate < 0 || rate > 10) {
        treeChildren.push({
          type: "invalid",
          dropChild: child,
          hasErr: true,
          msg: `概率校验失败：Type为1时，\n子项第${child.ChildId}个的ItemDropRate必须是0~10的整数`
        });
        hasRootProbErr = true;
        continue;
      }
    } else if (dropType === 2) {
      if (isNaN(rate) || rate < 1) {
        treeChildren.push({
          type: "invalid",
          dropChild: child,
          hasErr: true,
          msg: `概率校验失败：Type为2时，\n子项第${child.ChildId}个的ItemDropRate必须大于1`
        });
        hasRootProbErr = true;
        continue;
      }
    }

    // 如果孩子节点有空的孩子节点，直接添加到树中退出
    if (checkChildErr(child)) {
      // 空孩子节点
      treeChildren.push({
        type: "invalid",
        dropChild: child,
        hasErr: true,
        msg: `id为${dropRecord.Id}的节点\n的第${child.ChildId}个孩子\n节点为空或基础配置项出错`
      });
      continue;
    }

    if (child.DropType === 1) {
      // 叶子节点：CommonItem
      const commonItem = await findCommonItemById(commonItemFile, itemIdStr);
      if (!commonItem) {
        // 如果找不到就将其作为不合法节点添加到树中
        treeChildren.push({
          type: "invalid",
          dropChild: child,
          hasErr: true,
          msg: `id为${dropRecord.Id}的节点\n的第${child.ChildId}个孩子\n在CommonItem.txt中不存在`
        });
        continue;
      }
      // 如果找不到公告也会添加不合法节点然后退出
      // 添加到树中
      treeChildren.push({
        type: "leaf",
        dropChild: child,
        commonItem,
        hasErr: false
      });
    } else if (child.DropType === 2) {
      // 子递归包
      const subDrop = await findDropRecordById(recursionDropFile, child.ItemID);
      if (subDrop.length === 0) {
        // 如果找不到就将其作为不合法节点添加到树中

        treeChildren.push({
          type: "invalid",
          dropChild: child,
          hasErr: true,
          msg: `id为${dropRecord.Id}的节点的\n第${child.ChildId}个孩子\n在RecursionDrop.txt中不存在`
        });
        continue;
      }
      const subDropRes = subDrop[0];
      const subtree = await buildDropTreeRootNode(
        subDropRes,
        recursionDropFile,
        commonItemFile
      );
      treeChildren.push({
        type: "node",
        dropChild: child,
        recursionDrop: subDropRes,
        children: subtree.children,
        hasErr: false,
        msg: ""
      });
    } else {
      throw new Error(`未知 DropType=${child.DropType}，ID=${itemIdStr}`);
    }
  }

  // 返回整个根节点（类型为 DropInnerNode）
  return {
    type: "node",
    dropChild: {
      ChildId: 0,
      DropType: 2,
      ItemID: Number(dropRecord.Id ?? 0),
      ItemDropRate: 1,
      Count: 1,
      IsPrecious: 0
    },
    recursionDrop: dropRecord,
    children: treeChildren,
    hasErr: hasRootProbErr, // 👉【新增】
    msg: rootMsg // 👉【新增】
  };
}

/**
 * 递归配置项检测
 * @param dropItem
 * @param recursionDropTxt
 * @param commonItemTxt
 */
export async function offspringCheck(
  dropItem: DropRecord,
  recursionDropTxt: File,
  commonItemTxt: File
): Promise<DropInnerNode> {
  const root = await buildDropTreeRootNode(
    dropItem,
    recursionDropTxt,
    commonItemTxt
  );
  return root;
}
/*
 * 基础配置项检测
 * 只检测是否空 不符合表头的情况 不检测逻辑性错误
 * 找不到抛出 NotFindIdError
 * 如果重复，抛出 DuplicateIdError
 * @param recursionDropTxt - txt 文件
 * @param dropItemId - 要查找的 id
 */
export async function checkCommonCellById(
  recursionDropTxt: File,
  dropNotifyTxt: File,
  dropItemId: number
): Promise<DropRecord> {
  const dropItems = await findDropRecordById(recursionDropTxt, dropItemId); // 物品，对象形式

  if (dropItems.length === 0) {
    throw new NotFindIdError(dropItemId.toString());
  }

  if (dropItems.length > 1) {
    throw new DuplicateIdError(dropItems);
  }
  const dropItem = dropItems[0];

  // 判断是否能找到公告
  if (Number(dropItem.NotifyId) !== -1) {
    const notify = await findNotifyInfoById(dropNotifyTxt, dropItem.NotifyId);
    if (notify === null) throw new NotFindNotifyErr(dropItem);
  }

  //#region -----------基础cells检查-------------
  const errCells: string[] = [];
  // 遍历属性，每个属性都不能为空
  for (const key in dropItem) {
    if (dropItem[key] === "") {
      errCells.push(key);
    }
  }
  //  检查Id是否合规
  if (Number(dropItem.Id) > 999999) {
    errCells.push("Id");
  }
  // 检测掉落类型是否合规
  if (dropItem.Type !== "1" && dropItem.Type !== "2") {
    errCells.push("Type");
  }
  // 检测物品绑定概率是否合规
  if (Number(dropItem.BindRate) > 1 || Number(dropItem.BindRate) < 0) {
    errCells.push("BindRate");
  }
  if (errCells.length > 0) {
    throw new FatherCommonCellErr(dropItem, errCells);
  }
  //#endregion  -----------基础cells检查 end-------------

  return dropItem;
}

/**
 * 从 txt 文件中找到指定 Id 的记录，并返回对象格式。
 * @param file 通过 <input type="file"> 获取的 txt 文件
 * @param targetId 要查找的 Id（整数）
 * @returns 返回找到的所有的对象，文件表头不够就报错
 */
export async function findDropRecordById(
  file: File,
  targetId: number
): Promise<DropRecord[]> {
  const text = await readFileWithEncoding(file, "gbk");
  const lines = text.split(/\r?\n/);

  if (lines.length <= 4) {
    throw new Error("文件内容行数不足，无法读取正常数据");
  }

  const headers = lines[0].trim().split(/\t+/);
  const dataLines = lines.slice(4).filter(line => line.trim().length > 0);

  const matchedRecords: DropRecord[] = [];

  for (const line of dataLines) {
    const cols = line.split(/\t+/);
    const lineId = parseInt(cols[0], 10);

    if (lineId === targetId) {
      const record: DropRecord = {};
      headers.forEach((key, i) => {
        record[key] = cols[i] ?? "";
      });
      matchedRecords.push(record);
    }
  }
  return matchedRecords;
}
