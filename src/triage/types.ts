// 电话分诊领域类型：资料层（数据形状），不含任何界面与存储逻辑

/** 电话分诊记录的生命周期状态 */
export type CallStatus =
  | "emergency" // 急救待排：当天必须处理、尚未排入椅位
  | "pending" // 常规待排：已分诊、尚未排入椅位
  | "scheduled" // 已排入椅位时段、等待医生确认接诊
  | "waiting" // 等待区：符合时限的椅位时段全部冲突
  | "in_treatment" // 医生已确认接诊
  | "completed" // 已完成实际处理
  | "rescheduled"; // 已改约（保留原时段信息与原因）

/** 来电主诉的症状勾选项（跳痛 / 咬合痛等） */
export interface SymptomFlags {
  throbbing: boolean; // 跳痛（搏动性）
  bitePain: boolean; // 咬合痛 / 叩痛
  nightPain: boolean; // 夜间痛、影响入睡或痛醒
  spontaneous: boolean; // 无诱因自发痛
  swelling: boolean; // 面部或牙龈肿胀
  fever: boolean; // 发热
  trismus: boolean; // 张口受限
  highBite: boolean; // 补料/暂封物"高"，先咬合到
}

/** 来电登记输入（资料层） */
export interface TriageInput {
  patientName: string;
  phone: string;
  tooth: string; // 牙位，FDI 编号，如 46
  calledAt: string; // 来电时刻 ISO
  painScore: number; // 疼痛分值 0-10
  symptoms: SymptomFlags;
  note: string;
}

/** 分诊判断结果（判断层输出，登记时快照保存） */
export interface TriageResult {
  level: TriageLevel;
  label: string;
  deadlineHours: number;
  deadline: string; // 复诊时限 ISO
  deadlineText: string; // 复诊时限说明文案
  sameDayOnly: boolean; // 是否仅限当天门诊时段
  reasons: string[]; // 命中规则的逐条说明（写清判断依据）
  advice: string[]; // 给患者的临时建议
}

export type TriageLevel = "A" | "B" | "C" | "D";

/** 椅位时段占用者 */
export interface Occupancy {
  id: string;
  chairId: string;
  date: string;
  time: string;
  callId?: string; // 关联来电记录；无则为既有门诊占用
  kind: "blocker" | "call";
  patientName: string;
  tooth?: string;
  note?: string;
}

/** 一张牙椅一个时段的格子 */
export interface SlotCell {
  chairId: string;
  chairName: string;
  time: string; // HH:MM
  date: string; // YYYY-MM-DD
  occupant: Occupancy | null;
}

/** 一次排椅 / 改约 / 接诊动作留痕 */
export interface HistoryEntry {
  at: string;
  action: string;
  detail: string;
  by: string;
}

/** 一次预约（原时段或现时段） */
export interface Assignment {
  chairId: string;
  chairName: string;
  date: string;
  time: string;
  assignedAt: string;
  /** 改约前的原时段保留信息 */
  previousAssignment?: {
    chairId: string;
    chairName: string;
    date: string;
    time: string;
  };
}

/** 一条完整的电话分诊记录 */
export interface CallRecord extends TriageInput {
  id: string;
  status: CallStatus;
  triage: TriageResult;
  assignment: Assignment | null;
  waitingReason: string; // 进等待区时写清的冲突说明
  rescheduleReason: string; // 改约原因
  treatment: string; // 医生确认接诊后的实际处理
  doctor: string; // 接诊医生
  treatedAt: string; // 实际接诊/完成时刻
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

/** 本机保存的全部数据 */
export interface TriageState {
  version: number;
  records: CallRecord[];
  blockers: Occupancy[];
}
