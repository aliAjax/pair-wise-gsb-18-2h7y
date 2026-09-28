// 资料层：电话分诊的登记字段与领域类型定义
// 只描述“是什么”，不含判断规则（见 triageRules.ts）和存取（见 storage.ts）

export type Urgency = "emergency" | "urgent" | "routine";
export type CallStatus = "triaged" | "waiting" | "booked" | "completed";
export type BookingStatus = "pending" | "seen" | "rescheduled" | "void";

export type PainNature = "throbbing" | "bite" | "dull" | "none";

/** 椅位时段（每个槽位 30 分钟，同一牙椅同一槽位只允许一人） */
export interface Slot {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
}

/** 医生确认接诊后登记的实际处理 */
export interface ActualTreatment {
  doctor: string;
  procedure: string; // 调合/冲洗换药/根管再处理/开放引流/宣教观察…
  note: string;
  treatedAt: string; // ISO 时间
}

/** 改约留痕：保留原时段和原因 */
export interface RescheduleLog {
  id: string;
  fromDate: string;
  fromSlot: string; // HH:mm
  fromChairId: string;
  toDate: string;
  toSlot: string;
  toChairId: string;
  reason: string;
  operator: string;
  createdAt: string;
}

/** 一通来电分诊记录（患者、牙位、来电时刻、疼痛分值、夜间痛等） */
export interface TriageCall {
  id: string;
  patientName: string;
  phone: string;
  tooth: string; // 牙位，如 36 / 11 / 46
  calledAt: string; // ISO，来电时刻
  painScore: number; // 0–10
  painNature: PainNature; // 跳痛 / 咬合痛 …
  nightPain: boolean; // 夜间痛
  swelling: boolean; // 面部肿胀
  fever: boolean; // 发热
  postOpDays: number; // 根管治疗后第几天（本场景通常为 2）
  note: string;

  // 系统判断结果（由 triageRules 写入）
  urgency: Urgency;
  advice: string; // 分诊意见（复诊时限 + 依据）
  deadline: string; // ISO，复诊时限

  status: CallStatus;
  conflictNote?: string; // 排不进时写清冲突

  bookingId?: string; // 当前有效预约
  history?: ActualTreatment[]; // 历次实际处理
  createdAt: string;
  updatedAt: string;
}

export interface ChairBooking {
  id: string;
  callId: string;
  chairId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  rescheduleOf?: string; // 由哪张预约改约而来
  rescheduleReason?: string;
  createdAt: string;
}

export interface Chair {
  id: string;
  name: string;
}

export interface PersistState {
  version: 1;
  calls: TriageCall[];
  bookings: ChairBooking[];
  reschedules: RescheduleLog[];
  savedAt: string;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}
