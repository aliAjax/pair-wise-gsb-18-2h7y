// 判断层：根管治疗后电话分诊规则（纯函数，不含界面与存储）
// 业务背景：根管治疗后第二晚的跳痛 / 咬合痛，区分需要当天回诊的急症
// 与术后反应性疼痛，并输出复诊时限、依据与临时处理建议。

import type { TriageInput, TriageResult } from "./types";
import {
  CLINIC,
  addDays,
  combineDateTime,
  dateKey,
  isAfterCloses,
  isWorkday,
  nextOpenDay,
  pad2,
  renderDeadlineText,
} from "./time";

/** 复诊时限候选：A级当天门诊结束前，B级24h，C级72h，D级7天内复查 */
export function triage(input: TriageInput, now: Date = new Date()): TriageResult {
  const s = input.symptoms;
  const reasons: string[] = [];

  // —— A 级：感染扩散 / 急症征象，当天必须处理 ——
  const systemic = s.fever || s.trismus;
  if (systemic) {
    if (s.fever) reasons.push("伴发热，提示感染全身反应");
    if (s.trismus) reasons.push("张口受限，警惕间隙感染扩散");
  }
  if (s.swelling) reasons.push("面部或牙龈肿胀，存在急性根尖周脓肿/感染扩散风险");

  // —— A 级：剧烈疼痛（含夜间痛醒、跳痛、高分值）——
  const severePain = input.painScore >= 8;
  if (severePain) reasons.push(`疼痛分值 ${input.painScore}/10，属剧烈疼痛`);
  if (s.throbbing && s.nightPain)
    reasons.push("跳痛合并夜间痛（痛醒/无法入睡），符合急性根尖周炎急症表现");
  else if (s.nightPain && input.painScore >= 7)
    reasons.push("夜间痛且疼痛分值≥7，需警惕牙髓/根尖急性炎症");

  const isA = systemic || s.swelling || severePain || (s.throbbing && s.nightPain);

  // —— B 级：24 小时内复诊 ——
  if (!isA) {
    if (s.throbbing) reasons.push("根管术后跳痛，需排查髓腔高压或充填后急性反应");
    if (s.spontaneous) reasons.push("存在无诱因自发痛");
    if (s.bitePain && (s.nightPain || input.painScore >= 6))
      reasons.push("咬合痛叠加夜间痛或中重度疼痛，需24小时内复查咬合与根尖情况");
  }
  const isB = !isA && (s.throbbing || s.spontaneous || (s.bitePain && (s.nightPain || input.painScore >= 6)));

  // —— C 级：72 小时内复诊 ——
  if (!isA && !isB) {
    if (s.bitePain) reasons.push("咬合痛：术后早期根尖周膜反应常见，需排查咬合高点");
    if (s.highBite) reasons.push("自觉补料/暂封物先咬到，提示咬合高点需调𬌗");
    if (input.painScore >= 4) reasons.push(`疼痛分值 ${input.painScore}/10，属中度疼痛`);
    if (s.nightPain) reasons.push("夜间痛但程度尚轻，建议72小时内复查确认");
  }
  const isC = !isA && !isB && (s.bitePain || s.highBite || input.painScore >= 4 || s.nightPain);

  // —— D 级：术后反应性疼痛，7 天复查期内观察 ——
  if (!isA && !isB && !isC) {
    reasons.push("根管术后轻度反应性疼痛，无急症征象");
  }

  const level = isA ? "A" : isB ? "B" : isC ? "C" : "D";
  const meta = DEADLINE_RULES[level];

  // 计算复诊截止时刻
  const callDate = dateKey(new Date(input.calledAt));
  let deadline: Date;
  let sameDayOnly = false;
  if (level === "A") {
    // 当天门诊结束前；若来电时已闭诊，顺延至下一开放日开诊
    sameDayOnly = true;
    if (!isAfterCloses(new Date(input.calledAt))) {
      deadline = combineDateTime(callDate, CLINIC.closeTime);
    } else {
      const openDay = nextOpenDay(addDays(callDate, 1));
      deadline = combineDateTime(openDay, CLINIC.openTime);
    }
  } else if (level === "B") {
    deadline = new Date(new Date(input.calledAt).getTime() + 24 * 3600 * 1000);
    // 截止时刻落在闭诊后/非开放日时收敛到门诊时段
    deadline = clampToOpen(deadline);
  } else if (level === "C") {
    deadline = new Date(new Date(input.calledAt).getTime() + 72 * 3600 * 1000);
    deadline = clampToOpen(deadline);
  } else {
    deadline = combineDateTime(nextOpenDay(addDays(callDate, 7)), CLINIC.closeTime);
  }

  return {
    level,
    label: meta.label,
    deadlineHours: meta.hours,
    deadline: deadline.toISOString(),
    deadlineText: renderDeadlineText(level, deadline, sameDayOnly),
    sameDayOnly,
    reasons,
    advice: ADVICE[level],
  };
}

const DEADLINE_RULES: Record<
  "A" | "B" | "C" | "D",
  { label: string; hours: number }
> = {
  A: { label: "急症 · 当天处理", hours: 0 },
  B: { label: "紧急 · 24小时内复诊", hours: 24 },
  C: { label: "亚急 · 72小时内复诊", hours: 72 },
  D: { label: "常规 · 7天复查期内观察", hours: 168 },
};

const ADVICE: Record<"A" | "B" | "C" | "D", string[]> = {
  A: [
    "立即安排当天回诊；若当天椅位已满，进入急救待排优先加椅",
    "面部肿胀加重、呼吸或吞咽困难、发热不退时直接急诊",
    "来诊前可按说明书剂量服用布洛芬（无禁忌时），不要自行挑开暂封物",
  ],
  B: [
    "24小时内安排复诊，检查咬合、暂封与根尖情况",
    "避免患侧咀嚼，按说明书使用止痛药物",
    "若出现肿胀、发热或疼痛升至8分以上，按急症立即回诊",
  ],
  C: [
    "72小时内安排复诊，重点检查并调磨咬合高点",
    "术后2-3天内轻度跳痛/咬合痛多为根尖反应，通常逐日减轻",
    "记录疼痛变化，持续加重或出现夜间痛醒请来电升级为急症",
  ],
  D: [
    "术后轻度不适多在数日内缓解，按约复查即可",
    "保持口腔清洁，避免患侧咀嚼硬物",
    "出现肿胀、发热、夜间痛醒或疼痛加重时及时来电",
  ],
};

/** 某时刻是否处于门诊时间内 */
function isOpenAt(d: Date): boolean {
  const [oh, om] = CLINIC.openTime.split(":").map(Number);
  const [ch, cm] = CLINIC.closeTime.split(":").map(Number);
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins >= oh * 60 + om && mins <= ch * 60 + cm;
}

/** 把截止时刻收敛到最近的门诊时段内（闭诊后→当天17:00；非开放日→下一开放日） */
function clampToOpen(d: Date): Date {
  const key = dateKey(d);
  const openKey = isWorkday(key) ? key : nextOpenDay(key);
  let result = d;
  if (openKey !== key) result = combineDateTime(openKey, CLINIC.openTime);
  if (!isOpenAt(result)) {
    const [oh, om] = CLINIC.openTime.split(":").map(Number);
    const [ch] = CLINIC.closeTime.split(":").map(Number);
    const mins = result.getHours() * 60 + result.getMinutes();
    const t =
      mins > ch * 60 ? CLINIC.closeTime : `${pad2(oh)}:${pad2(om)}`;
    result = combineDateTime(dateKey(result), t);
  }
  return result;
}
