// 症状字典（资料层）：字段键与中文标签、分诊提示语的对应

import type { SymptomFlags } from "./types";

export const SYMPTOM_META: Array<{ key: keyof SymptomFlags; label: string; hint: string }> = [
  { key: "throbbing", label: "跳痛", hint: "搏动性、一阵一阵加重" },
  { key: "bitePain", label: "咬合痛", hint: "咬东西或叩齿时痛" },
  { key: "nightPain", label: "夜间痛", hint: "夜间加重、痛醒或无法入睡" },
  { key: "spontaneous", label: "自发痛", hint: "没有刺激也会痛" },
  { key: "highBite", label: "咬合高点", hint: "补料/暂封物先咬到" },
  { key: "swelling", label: "肿胀", hint: "牙龈或面部肿起" },
  { key: "fever", label: "发热", hint: "体温升高、发冷" },
  { key: "trismus", label: "张口受限", hint: "嘴张不大、吞咽不适" },
];

export function activeSymptomLabels(flags: SymptomFlags): string[] {
  return SYMPTOM_META.filter((item) => flags[item.key]).map((item) => item.label);
}
