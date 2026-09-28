// 判断层：纯函数分诊规则。输入登记资料，输出紧急级别、复诊时限与分诊意见
// 不碰存储、不碰 DOM，便于核对与单测

import type { PainNature, TriageCall, Urgency } from "./types";

export const URGENCY_LABEL: Record<Urgency, string> = {
  emergency: "急救（当天处理）",
  urgent: "加急复诊",
  routine: "常规复诊",
};

/** 各级别从“来电时刻”起算的复诊时限（小时） */
export const DEADLINE_HOURS: Record<Urgency, number> = {
  emergency: 4, // 当天处理，进入急救待排
  urgent: 24,
  routine: 72,
};

export const URGENCY_ORDER: Record<Urgency, number> = {
  emergency: 0,
  urgent: 1,
  routine: 2,
};

export const PAIN_NATURE_LABEL: Record<PainNature, string> = {
  throbbing: "跳痛（搏动性）",
  bite: "咬合痛",
  dull: "钝痛/酸胀",
  none: "基本不痛",
};

export interface TriageInput {
  painScore: number;
  painNature: PainNature;
  nightPain: boolean;
  swelling: boolean;
  fever: boolean;
  postOpDays: number;
}

interface RuleHit {
  urgency: Urgency;
  reasons: string[];
}

export interface TriageVerdict {
  urgency: Urgency;
  advice: string;
  deadline: string;
  reasons: string[];
}

/**
 * 规则（命中任一高档条件即取更高档）：
 * - 急救当天：面部肿胀 或 发热 或 夜间痛且评分≥7 或 跳痛且评分≥7 或 咬合痛且评分≥6
 * - 加急24h：夜间痛、跳痛、咬合痛评分≥4、或评分≥5
 * - 常规72h：其余（术后轻度酸胀多为正常反应）
 */
export function evaluate(input: TriageInput, calledAt: string): TriageVerdict {
  const hits: RuleHit[] = [];
  const reasons: string[] = [];

  const push = (urgency: Urgency, reason: string) => {
    hits.push({ urgency, reasons: [reason] });
    reasons.push(reason);
  };

  if (input.swelling) push("emergency", "面部/牙龈肿胀，疑感染扩散");
  if (input.fever) push("emergency", "伴发热，需当天评估感染");
  if (input.nightPain && input.painScore >= 7)
    push("emergency", `夜间痛且疼痛 ${input.painScore} 分，疑残髓/急性炎症`);
  if (input.painNature === "throbbing" && input.painScore >= 7)
    push("emergency", `跳痛 ${input.painScore} 分，需当天排查急性炎症`);
  if (input.painNature === "bite" && input.painScore >= 6)
    push("emergency", `咬合痛 ${input.painScore} 分，需当天检查高点/根尖刺激`);

  if (input.nightPain && !hits.some((h) => h.urgency === "emergency"))
    push("urgent", "存在夜间痛");
  if (
    input.painNature === "throbbing" &&
    !hits.some((h) => h.urgency === "emergency")
  )
    push("urgent", "跳痛（搏动性疼痛）");
  if (
    input.painNature === "bite" &&
    input.painScore >= 4 &&
    !hits.some((h) => h.urgency === "emergency")
  )
    push("urgent", `咬合痛 ${input.painScore} 分，可能存在咬合高点`);
  if (
    input.painScore >= 5 &&
    !hits.some((h) => h.urgency !== "routine")
  )
    push("urgent", `疼痛评分 ${input.painScore} 分`);

  const urgency: Urgency =
    hits.some((h) => h.urgency === "emergency")
      ? "emergency"
      : hits.some((h) => h.urgency === "urgent")
        ? "urgent"
        : "routine";

  const hours = DEADLINE_HOURS[urgency];
  const deadline = new Date(
    new Date(calledAt).getTime() + hours * 3600_000
  ).toISOString();

  let advice: string;
  if (urgency === "emergency") {
    advice =
      `进入急救待排，当天（来电后 ${hours} 小时内）复诊。` +
      `依据：${reasons.join("；")}。` +
      "电话嘱避免患侧咀嚼，勿自行挑开暂封，持续加重立即急诊。";
  } else if (urgency === "urgent") {
    advice =
      `${hours} 小时内复诊。依据：${reasons.join("；")}。` +
      "电话嘱暂按医嘱镇痛，若出现肿胀、发热或疼痛加重立即来电升级急救。";
  } else {
    advice =
      `${hours} 小时内复诊或预约观察。` +
      "术后轻度酸胀多在 2–3 天内缓解；嘱避免患侧咀嚼、按医嘱镇痛，" +
      "出现跳痛加重、夜间痛、肿胀发热立即来电。";
  }

  return { urgency, advice, deadline, reasons };
}

export function isOverdue(call: Pick<TriageCall, "deadline" | "status">): boolean {
  if (call.status === "completed") return false;
  return new Date(call.deadline).getTime() < Date.now();
}
