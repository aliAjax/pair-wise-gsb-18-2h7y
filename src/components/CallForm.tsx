import { useMemo, useState } from "react";
import type { SymptomFlags, TriageInput } from "../triage/types";
import { triage } from "../triage/rules";
import { SYMPTOM_META } from "../triage/symptoms";
import { toLocalInputValue } from "../triage/time";
import { levelBadgeClass } from "../triage/format";

const EMPTY_SYMPTOMS: SymptomFlags = {
  throbbing: false,
  bitePain: false,
  nightPain: false,
  spontaneous: false,
  swelling: false,
  fever: false,
  trismus: false,
  highBite: false,
};

interface Props {
  onSubmit: (input: TriageInput) => void;
}

export function CallForm({ onSubmit }: Props) {
  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [tooth, setTooth] = useState("");
  const [calledAt, setCalledAt] = useState(() => toLocalInputValue(new Date()));
  const [painScore, setPainScore] = useState(5);
  const [symptoms, setSymptoms] = useState<SymptomFlags>(EMPTY_SYMPTOMS);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // 页面上即时给前台看分诊判断，提交后再落库（判断与登记分离）
  const preview = useMemo(
    () =>
      triage({
        patientName,
        phone,
        tooth,
        calledAt: new Date(calledAt).toISOString(),
        painScore,
        symptoms,
        note,
      }),
    [patientName, phone, tooth, calledAt, painScore, symptoms, note]
  );

  const toggle = (key: keyof SymptomFlags) =>
    setSymptoms((prev) => ({ ...prev, [key]: !prev[key] }));

  const submit = () => {
    if (!patientName.trim()) {
      setError("请填写患者姓名");
      return;
    }
    if (!/^\d{1,2}$/.test(tooth.trim())) {
      setError("请填写 FDI 牙位编号（11-48 等两位数字，如 46）");
      return;
    }
    if (!calledAt) {
      setError("请选择来电时刻");
      return;
    }
    setError("");
    onSubmit({
      patientName: patientName.trim(),
      phone: phone.trim(),
      tooth: tooth.trim(),
      calledAt: new Date(calledAt).toISOString(),
      painScore,
      symptoms,
      note: note.trim(),
    });
    setPatientName("");
    setPhone("");
    setTooth("");
    setCalledAt(toLocalInputValue(new Date()));
    setPainScore(5);
    setSymptoms(EMPTY_SYMPTOMS);
    setNote("");
  };

  return (
    <section className="panel register-panel">
      <div className="section-heading">
        <div>
          <p>电话分诊登记</p>
          <h2>根管术后来电</h2>
        </div>
      </div>

      <div className="form-grid">
        <label>
          <span>患者姓名 *</span>
          <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="如：林晓" />
        </label>
        <label>
          <span>联系电话</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="选填" />
        </label>
        <label>
          <span>牙位（FDI）*</span>
          <input value={tooth} onChange={(e) => setTooth(e.target.value)} placeholder="如：46" inputMode="numeric" maxLength={2} />
        </label>
        <label>
          <span>来电时刻 *</span>
          <input type="datetime-local" value={calledAt} onChange={(e) => setCalledAt(e.target.value)} />
        </label>
      </div>

      <div className="pain-block">
        <div className="pain-head">
          <span>疼痛分值</span>
          <strong className={painScore >= 8 ? "pain-critical" : painScore >= 4 ? "pain-mid" : "pain-low"}>
            {painScore}/10
          </strong>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          value={painScore}
          onChange={(e) => setPainScore(Number(e.target.value))}
        />
        <div className="pain-scale">
          <span>0 无痛</span>
          <span>4 中度</span>
          <span>8 剧烈</span>
          <span>10 最痛</span>
        </div>
      </div>

      <div className="symptom-block">
        <span className="field-label">夜间痛 / 伴随症状（在电话中逐项确认）</span>
        <div className="symptom-grid">
          {SYMPTOM_META.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`symptom-chip ${symptoms[item.key] ? "on" : ""}`}
              onClick={() => toggle(item.key)}
              title={item.hint}
            >
              <i>{symptoms[item.key] ? "✓" : ""}</i>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <label className="note-label">
        <span>来电备注</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="如：根管治疗后第二晚，跳痛一夜，凌晨痛醒"
        />
      </label>

      <div className="triage-preview">
        <div className="preview-head">
          <span className={levelBadgeClass(preview.level)}>
            {preview.level} 级 · {preview.label}
          </span>
          <strong>复诊时限：{preview.deadlineText}</strong>
        </div>
        <ul className="reason-list">
          {preview.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      {error && <p className="form-error">{error}</p>}
      <button className="primary-action submit-btn" onClick={submit}>
        登记并自动排椅
      </button>
    </section>
  );
}
