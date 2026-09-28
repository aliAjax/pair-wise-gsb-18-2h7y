import { useState } from "react";
import type { CallRecord } from "../triage/types";
import { activeSymptomLabels } from "../triage/symptoms";
import { CHAIRS } from "../triage/schedule";
import { CLINIC, addDays, todayKey } from "../triage/time";
import {
  deadlineCountdown,
  fmtDateTime,
  levelBadgeClass,
  painClass,
  statusBadgeClass,
} from "../triage/format";
import type { TriageStore } from "../triage/store";

interface Props {
  record: CallRecord;
  store: TriageStore;
  onClose: () => void;
}

export function RecordModal({ record, store, onClose }: Props) {
  const [doctor, setDoctor] = useState(record.doctor);
  const [treatment, setTreatment] = useState(record.treatment);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rChair, setRChair] = useState(record.assignment?.chairId ?? CHAIRS[0].id);
  const [rDate, setRDate] = useState(addDays(todayKey(), 1));
  const [rTime, setRTime] = useState(CLINIC.slotTimes[0]);
  const [rReason, setRReason] = useState(record.rescheduleReason);

  const r = record;
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => addDays(todayKey(), d));
  const canReschedule = Boolean(r.assignment) && r.status !== "completed";
  const canAccept = Boolean(r.assignment) && r.status !== "completed" && r.status !== "in_treatment";
  const canComplete = r.status === "in_treatment";
  const canRetry = r.status === "waiting" || r.status === "emergency" || r.status === "pending";

  const doReschedule = () => {
    const err = store.reschedule(r.id, rChair, rDate, rTime, rReason);
    if (err) window.alert(err);
    else setShowReschedule(false);
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal detail" onClick={(e) => e.stopPropagation()}>
        <header className="detail-head">
          <div>
            <div className="detail-tags">
              <span className={levelBadgeClass(r.triage.level)}>
                {r.triage.level} 级 · {r.triage.label}
              </span>
              <span className={statusBadgeClass(r.status)}>{statusWord(r.status)}</span>
            </div>
            <h2>
              {r.patientName} · 牙位 #{r.tooth}
            </h2>
            <p className="detail-sub">
              {r.phone ? `电话 ${r.phone} · ` : ""}来电 {fmtDateTime(r.calledAt)}
            </p>
          </div>
          <button className="close-x" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="detail-body">
          <section className="detail-section">
            <h3>登记资料</h3>
            <div className="kv-grid">
              <div>
                <span>疼痛分值</span>
                <strong className={painClass(r.painScore)}>{r.painScore}/10</strong>
              </div>
              <div>
                <span>夜间痛</span>
                <strong>{r.symptoms.nightPain ? "是（痛醒/无法入睡）" : "否"}</strong>
              </div>
              <div className="kv-wide">
                <span>症状</span>
                <strong>
                  {activeSymptomLabels(r.symptoms).join("、") || "无勾选症状"}
                </strong>
              </div>
              {r.note && (
                <div className="kv-wide">
                  <span>来电备注</span>
                  <strong>{r.note}</strong>
                </div>
              )}
            </div>
          </section>

          <section className="detail-section triage-box">
            <h3>分诊判断</h3>
            <p className="deadline-line">
              复诊时限：<strong>{r.triage.deadlineText}</strong>
              <em className={overdue(r) ? "overdue" : ""}>{deadlineCountdown(r.triage.deadline)}</em>
            </p>
            <ul className="reason-list">
              {r.triage.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <div className="advice-box">
              <span>电话指导</span>
              <ul>
                {r.triage.advice.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </section>

          {r.status === "waiting" && (
            <section className="detail-section conflict-box">
              <h3>等待区 · 冲突说明</h3>
              <p>{r.waitingReason}</p>
            </section>
          )}

          {r.assignment && (
            <section className="detail-section">
              <h3>椅位安排</h3>
              <p className="assign-line">
                当前：<strong>{`${r.assignment.chairName} · ${r.assignment.date} ${r.assignment.time}`}</strong>
              </p>
              {r.assignment.previousAssignment && (
                <div className="previous-box">
                  <p>
                    原时段（改约保留）：
                    {`${r.assignment.previousAssignment.chairName} · ${r.assignment.previousAssignment.date} ${r.assignment.previousAssignment.time}`}
                  </p>
                  <p>改约原因：{r.rescheduleReason}</p>
                </div>
              )}
            </section>
          )}

          <section className="detail-section actions-box">
            <h3>处置</h3>
            {canRetry && (
              <button
                className="primary-action"
                onClick={() => {
                  const msg = store.retryAutoAssign(r.id);
                  if (msg) window.alert(msg);
                }}
              >
                重新自动排椅
              </button>
            )}

            {canAccept && (
              <div className="action-row">
                <input
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                  placeholder="接诊医生姓名"
                />
                <button
                  className="primary-action"
                  onClick={() => store.acceptByDoctor(r.id, doctor)}
                >
                  医生确认接诊
                </button>
              </div>
            )}

            {canComplete && (
              <div className="treat-row">
                <p className="doctor-line">接诊医生：{r.doctor} · 接诊于 {fmtDateTime(r.treatedAt)}</p>
                <textarea
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  rows={3}
                  placeholder="记实际处理：如调𬌗、去除暂封引流、根管冲洗封药、开具止痛药等"
                />
                <button
                  className="primary-action"
                  onClick={() => store.completeTreatment(r.id, treatment)}
                >
                  保存实际处理并完成
                </button>
              </div>
            )}

            {r.status === "completed" && (
              <div className="done-box">
                <p>
                  接诊医生：{r.doctor} · 完成于 {fmtDateTime(r.treatedAt)}
                </p>
                <p>实际处理：{r.treatment || "—"}</p>
              </div>
            )}

            {canReschedule && (
              <div className="reschedule-block">
                {!showReschedule ? (
                  <button className="ghost-btn" onClick={() => setShowReschedule(true)}>
                    改约（保留原时段与原因）
                  </button>
                ) : (
                  <div className="reschedule-form">
                    <p className="reschedule-tip">
                      原时段 {r.assignment!.chairName} {r.assignment!.date} {r.assignment!.time}{" "}
                      将保留在记录中
                    </p>
                    <div className="reschedule-fields">
                      <label>
                        <span>新牙椅</span>
                        <select value={rChair} onChange={(e) => setRChair(e.target.value)}>
                          {CHAIRS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>新日期</span>
                        <select value={rDate} onChange={(e) => setRDate(e.target.value)}>
                          {days.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>新时段</span>
                        <select value={rTime} onChange={(e) => setRTime(e.target.value)}>
                          {CLINIC.slotTimes.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="reason-field">
                        <span>改约原因 *</span>
                        <input
                          value={rReason}
                          onChange={(e) => setRReason(e.target.value)}
                          placeholder="如：医生临时手术 / 患者时间冲突 / 椅位故障"
                        />
                      </label>
                    </div>
                    <div className="action-row">
                      <button className="primary-action" onClick={doReschedule}>
                        确认改约
                      </button>
                      <button onClick={() => setShowReschedule(false)}>取消</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="detail-section">
            <h3>操作留痕</h3>
            <ol className="history-list">
              {r.history.map((h, i) => (
                <li key={i}>
                  <time>{fmtDateTime(h.at)}</time>
                  <div>
                    <strong>{h.action}</strong>
                    <p>{h.detail}</p>
                    <small>{h.by}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function statusWord(status: CallRecord["status"]): string {
  const map: Record<CallRecord["status"], string> = {
    emergency: "急救待排",
    pending: "待排",
    scheduled: "已排椅·待接诊",
    waiting: "等待区",
    in_treatment: "接诊中",
    completed: "已处理",
    rescheduled: "已改约",
  };
  return map[status];
}

function overdue(r: CallRecord): boolean {
  return (
    !["completed", "in_treatment"].includes(r.status) &&
    new Date(r.triage.deadline).getTime() < Date.now()
  );
}
