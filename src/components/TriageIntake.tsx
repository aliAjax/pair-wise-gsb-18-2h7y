// 页面层：电话分诊登记表
// 登记患者、牙位、来电时刻、疼痛分值、夜间痛等；提交后系统按症状给复诊时限

import { useState } from "react";
import type { PainNature } from "../triage/types";
import { PAIN_NATURE_LABEL } from "../triage/triageRules";
import { nowLocal, toDateTimeLocal } from "../triage/time";
import { useStore } from "../triage/store";

interface Props {
  onRegistered: (callId: string) => void;
}

const PAIN_HINT = ["无不适", "轻度", "中度", "重度", "剧痛"];

export function painHint(score: number): string {
  if (score <= 1) return PAIN_HINT[0];
  if (score <= 3) return PAIN_HINT[1];
  if (score <= 5) return PAIN_HINT[2];
  if (score <= 7) return PAIN_HINT[3];
  return PAIN_HINT[4];
}

export default function TriageIntake({ onRegistered }: Props) {
  const { addCall } = useStore();
  const now = nowLocal();

  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [tooth, setTooth] = useState("");
  const [calledAt, setCalledAt] = useState(toDateTimeLocal(now.iso));
  const [painScore, setPainScore] = useState(5);
  const [painNature, setPainNature] = useState<PainNature>("throbbing");
  const [nightPain, setNightPain] = useState(true);
  const [swelling, setSwelling] = useState(false);
  const [fever, setFever] = useState(false);
  const [postOpDays, setPostOpDays] = useState(2);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return setError("请登记患者姓名");
    if (!tooth.trim()) return setError("请登记牙位（如 36）");
    if (!calledAt) return setError("请确认来电时刻");
    setError("");

    const call = addCall({
      patientName,
      phone,
      tooth,
      calledAt: new Date(calledAt).toISOString(),
      painScore,
      painNature,
      nightPain,
      swelling,
      fever,
      postOpDays,
      note,
    });

    // 重置为下一通电话做准备
    setPatientName("");
    setPhone("");
    setTooth("");
    setNote("");
    setPainScore(5);
    setPainNature("throbbing");
    setNightPain(true);
    setSwelling(false);
    setFever(false);
    setPostOpDays(2);
    setCalledAt(toDateTimeLocal(new Date().toISOString()));
    onRegistered(call.id);
  };

  return (
    <form className="panel intake" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <p>电话分诊登记</p>
          <h2>来电记录</h2>
        </div>
        <button type="submit" className="primary-action">登记并分诊</button>
      </div>

      <div className="field-grid">
        <label>
          <span>患者姓名 *</span>
          <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="如：张磊" />
        </label>
        <label>
          <span>联系电话</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="便于复诊联系" />
        </label>
        <label>
          <span>牙位 *（FDI）</span>
          <input value={tooth} onChange={(e) => setTooth(e.target.value)} placeholder="如 36 / 11 / 46" maxLength={2} />
        </label>
        <label>
          <span>来电时刻 *</span>
          <input type="datetime-local" value={calledAt} onChange={(e) => setCalledAt(e.target.value)} />
        </label>
        <label>
          <span>术后第几晚</span>
          <input
            type="number"
            min={0}
            max={30}
            value={postOpDays}
            onChange={(e) => setPostOpDays(Number(e.target.value))}
          />
        </label>
        <label>
          <span>疼痛性质</span>
          <select
            value={painNature}
            onChange={(e) => setPainNature(e.target.value as PainNature)}
          >
            {(Object.keys(PAIN_NATURE_LABEL) as PainNature[]).map((k) => (
              <option key={k} value={k}>{PAIN_NATURE_LABEL[k]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="score-row">
        <label className="score-label">
          <span>疼痛分值 <strong>{painScore}</strong>/10（{painHint(painScore)}）</span>
          <input
            type="range"
            min={0}
            max={10}
            value={painScore}
            onChange={(e) => setPainScore(Number(e.target.value))}
          />
        </label>
        <div className="check-row">
          <label className="check">
            <input type="checkbox" checked={nightPain} onChange={(e) => setNightPain(e.target.checked)} />
            <span>夜间痛</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={swelling} onChange={(e) => setSwelling(e.target.checked)} />
            <span>面部/牙龈肿胀</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={fever} onChange={(e) => setFever(e.target.checked)} />
            <span>发热</span>
          </label>
        </div>
      </div>

      <label className="full-note">
        <span>电话补充（暂封情况、服药、放射痛…）</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="前台按患者口述简要记录" />
      </label>

      {error && <p className="form-error">{error}</p>}
      <p className="form-hint">
        提交后系统依据症状自动判定复诊时限：急救当天（进入急救待排）／加急 24 小时／常规 72 小时。
      </p>
    </form>
  );
}
