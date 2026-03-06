// 接口：基础递归包接口
export interface DropRecord {
  [key: string]: string;
}
// 类型：子包基础
export type DropChild = {
  ChildId: number;
  DropType: number;
  ItemID: number;
  ItemDropRate: number;
  Count: number;
  IsPrecious: number;
};
// 类型：公告记录
export interface NotifyRecord {
  Id: number;
  Desc: string;
  NoticetType: number;
  Content1: string;
  Content2: string;
  NoticeRate: number;
  MaxServerLev: number;
  ServerLevRate: number;
  IsCopyScneDrop: number;
}
// map: NotifyRecord映射
export const mapToNotifyRecord = (cols: string[]): NotifyRecord => ({
  Id: Number(cols[0]),
  Desc: cols[1] ?? "",
  NoticetType: Number(cols[2]),
  Content1: cols[3] ?? "",
  Content2: cols[4] ?? "",
  NoticeRate: Number(cols[5]),
  MaxServerLev: Number(cols[6]),
  ServerLevRate: Number(cols[7]),
  IsCopyScneDrop: Number(cols[8])
});

// 类型：CommonItem
export interface CommonItemRecord {
  Id: number;
  Desc: string;
  Name: string;
  Atlas: string;
  Icon: string;
  Tips: string;
  ClassID: number;
  SubClassID: number;
  ThirdClassID: number;
  Quality: number;
  Color: number;
  MinLevelRequire: number;
  MaxLevelRequire: number;
  IsCheckApotheosis: number;
  CanUse: number;
  BindType: number;
  CanSell: number;
  SellPrice: number;
  SellMoneyType: number;
  MaxStackSize: number;
  ProfessionRequire: number;
  SexReq: number;
  SortId: number;
  ExistTime: number;
  DropIcon: string;
  DropScaling: number;
  DropEffectId: number;
  CanThrow: number;
  IsCanStorage: number;
  IsCanQianKunDai: number;
  QianKunDaiGroup: number;
  QianKunDaiLevel: number;
  IsCanBatchUse: number;
  IsNeedAddRemind: number;
  IsNeedUseRemind: number;
  RemindUseRule: number;
  MaxStorage: number;
  SupplyJuqiExp: number;
  SearchId: number;
  StallItemID: number;
  StallOtherClass: number;
  IsNeedSecPasswd: number;
  DelayUseTime: number;
  StallSellType: number;
  ProfessionReq_Fashion: number;
  ExpireDate: string;
  CanTrade: number;
  AuctionId: number;
  MaskTipsItemId: number;
  BodyShapeReq: number;
  TipsModule: number;
  TipsSpecial: string;
}
// map: CommonItemRecord映射
export const mapToCommonItemRecord = (cols: string[]): CommonItemRecord => ({
  Id: Number(cols[0]),
  Desc: cols[1] ?? "",
  Name: cols[2] ?? "",
  Atlas: cols[3] ?? "",
  Icon: cols[4] ?? "",
  Tips: cols[5] ?? "",
  ClassID: Number(cols[6]),
  SubClassID: Number(cols[7]),
  ThirdClassID: Number(cols[8]),
  Quality: Number(cols[9]),
  Color: Number(cols[10]),
  MinLevelRequire: Number(cols[11]),
  MaxLevelRequire: Number(cols[12]),
  IsCheckApotheosis: Number(cols[13]),
  CanUse: Number(cols[14]),
  BindType: Number(cols[15]),
  CanSell: Number(cols[16]),
  SellPrice: Number(cols[17]),
  SellMoneyType: Number(cols[18]),
  MaxStackSize: Number(cols[19]),
  ProfessionRequire: Number(cols[20]),
  SexReq: Number(cols[21]),
  SortId: Number(cols[22]),
  ExistTime: Number(cols[23]),
  DropIcon: cols[24] ?? "",
  DropScaling: Number(cols[25]),
  DropEffectId: Number(cols[26]),
  CanThrow: Number(cols[27]),
  IsCanStorage: Number(cols[28]),
  IsCanQianKunDai: Number(cols[29]),
  QianKunDaiGroup: Number(cols[30]),
  QianKunDaiLevel: Number(cols[31]),
  IsCanBatchUse: Number(cols[32]),
  IsNeedAddRemind: Number(cols[33]),
  IsNeedUseRemind: Number(cols[34]),
  RemindUseRule: Number(cols[35]),
  MaxStorage: Number(cols[36]),
  SupplyJuqiExp: Number(cols[37]),
  SearchId: Number(cols[38]),
  StallItemID: Number(cols[39]),
  StallOtherClass: Number(cols[40]),
  IsNeedSecPasswd: Number(cols[41]),
  DelayUseTime: Number(cols[42]),
  StallSellType: Number(cols[43]),
  ProfessionReq_Fashion: Number(cols[44]),
  ExpireDate: cols[45] ?? "",
  CanTrade: Number(cols[46]),
  AuctionId: Number(cols[47]),
  MaskTipsItemId: Number(cols[48]),
  BodyShapeReq: Number(cols[49]),
  TipsModule: Number(cols[50]),
  TipsSpecial: cols[51] ?? ""
});

// 类型：递归树节点
export type DropTreeNode = DropLeafNode | DropInnerNode | ErrDropNullNode;
// 类型：递归树叶子节点
export type DropLeafNode = {
  type: "leaf";
  dropChild: DropChild;
  commonItem: CommonItemRecord;
  hasErr: boolean;
};
// 类型：递归树包节点
export type DropInnerNode = {
  type: "node";
  dropChild: DropChild;
  recursionDrop: DropRecord;
  children: DropTreeNode[];
  hasErr: boolean;
  msg: string;
};
// 类型： 错误的空节点
export type ErrDropNullNode = {
  type: "invalid";
  dropChild: DropChild;
  hasErr: boolean;
  msg: string;
};

// 错误：出现重复Id
export class DuplicateIdError extends Error {
  public records: DropRecord[];
  constructor(records: DropRecord[]) {
    super(`存在多个 id=${records[0].Id} 的记录`);
    this.name = "DuplicateIdError";
    this.records = records;
  }
}
// 错误：出现找不到Id
export class NotFindIdError extends Error {
  constructor(public targetId: string) {
    super(`未找到 id=${targetId} 的记录`);
    this.name = "NotFindIdError";
    this.targetId = targetId;
  }
}
// 错误：包本身基础cell错误
export class FatherCommonCellErr extends Error {
  constructor(
    public dropRecord: DropRecord,
    public errCells: string[]
  ) {
    super(
      `Id为${dropRecord.Id}的包的基础信息单元格${errCells.join(", ")}存在基础配置错误，如空，数值不符合表头等`
    );
    this.name = "FatherCommonCellErr";
    this.errCells = errCells;
    this.dropRecord = dropRecord;
  }
}

// 错误：找不到Notify
export class NotFindNotifyErr extends Error {
  constructor(public dropRecord: DropRecord) {
    super(
      `Id为${dropRecord.Id}的包找不到NotifyId为${dropRecord.NotifyId}的Notify`
    );
    this.name = "NotFindNotifyErr";
    this.dropRecord = dropRecord;
  }
}

// 错误：子包配置为空
export class SonPackNullErr extends Error {
  constructor(
    public fatherId: number,
    public childId: number
  ) {
    super(`Id为${fatherId}的包第${childId}个子包配置为空`);
    this.name = "SonPackNullErr";
    this.childId = childId;
    this.fatherId = fatherId;
  }
}

// 错误：子包基础cell错误
export class SonCommonCellErr extends Error {
  constructor(
    public fatherId: number,
    public errCells: string[],
    public childId: number
  ) {
    super(
      `Id为${fatherId}的包第${childId}个子包的基础信息单元格${errCells.join(", ")}存在基础配置错误，如空，数值不符合表头等`
    );
    this.errCells = errCells;
    this.fatherId = fatherId;
    this.childId = childId;
    this.name = "SonCommonCellErr";
  }
}
