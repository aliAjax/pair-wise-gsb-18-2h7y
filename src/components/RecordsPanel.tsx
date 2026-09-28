// 页面层：处理后记录（实际处理）与改约留痕（原时段、新时段、原因）

import { useMemo, useState } from "react";
import { useStore } from "../triage/store";
import {
  PAIN_NATURE_LABEL,
  URGENCY_LABEL,
} from "../triage/triageRules";
import { chairName, formatDateTime } from "../triage/time";

export default function RecordsPanel() {
  const { state } = useStore();
  const [tab, setTab] = useState<"treated" | "reschedules">("treated");

  const completed = useMemo(
    () =>
      state.calls
        .filter((c) => c.status === "completed")
        .sort(
          (a, b) =>
            new Date(b.history?.[b.history.length - 1]?.treatedAt ?? 0).getTime() -
            new Date(a.history?.[a.history.length - 1]?.treatedAt ?? 0).getTime()
        ),
    [state.calls]
  );

  return (
    <section className="panel records-panel">
      <div className="section-heading">
        <div>
          <p>留痕台账</p>
          <h2>处理与改约记录</h2>
        </div>
        <div className="tabs small">
          <button className={tab === "treated" ? "tab active" : "tab"} onClick={() => setTab("treated")}>
            实际处理 <em>{completed.length}</em>
          </button>
          <button className={tab === "reschedules" ? "tab active" : "tab"} onClick={() => setTab("reschedules")}>
            改约留痕 <em>{state.reschedules.length}</em>
          </button>
        </div>
      </div>

      {tab === "treated" ? (
        completed.length === 0 ? (
          <p className="empty">尚无已接诊记录。医生在椅位看板点“接诊”后，实际处理会写到这里。</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>患者 / 牙位</th>
                  <th>分诊级别</th>
                  <th>来电症状</th>
                  <th>实际处理</th>
                  <th>医生</th>
                  <th>接诊时刻</th>
                </tr>
              </thead>
              <tbody>
                {completed.flatMap((c) =>
                  (c.history ?? []).map((h, i) => (
                    <tr key={`${c.id}-${i}-${h.treatedAt}`}>
                      <td>
                        <strong>{c.patientName}</strong> #{c.tooth}
                        {i > 0 && <em className="dup">第 {i + 1} 次处理</em>}
                      </td>
                      <td>{URGENCY_LABEL[c.urgency]}</td>
                      <td className="muted">
                        {c.painScore}/10 · {PAIN_NATURE_LABEL[c.painNature]}
                        {c.nightPain ? " · 夜间痛" : ""}
                      </td>
                      <td>
                        {h.procedure}
                        {h.note && <p className="sub">{h.note}</p>}
                      </td>
                      <td>{h.doctor}</td>
                      <td>{formatDateTime(h.treatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )
      ) : state.reschedules.length === 0 ? (
        <p className="empty">尚无改约记录。改约会保留原时段与原因。</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>患者 / 牙位</th>
                <th>原时段（保留）</th>
                <th>改约后</th>
                <th>原因</th>
                <th>经办</th>
                <th>操作时刻</th>
              </tr>
            </thead>
            <tbody>
              {state.reschedules
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((r) => {
                  const linked = state.bookings.find(
                    (b) =>
                      b.chairId === r.toChairId &&
                      b.date === r.toDate &&
                      b.startTime === r.toSlot &&
                      b.status === "pending"
                  );
                  const owner = state.calls.find((c) => c.id === linked?.callId);
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{owner?.patientName ?? "—"}</strong>
                        {owner ? ` #${owner.tooth}` : ""}
                      </td>
                      <td className="muted">{r.fromDate} {r.fromSlot} · {chairName(r.fromChairId)}</td>
                      <td>{r.toDate} {r.toSlot} · {chairName(r.toChairId)}</td>
                      <td>{r.reason}</td>
                      <td>{r.operator}</td>
                      <td>{formatDateTime(r.createdAt)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
