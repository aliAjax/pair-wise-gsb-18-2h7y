import type { CallRecord } from "../triage/types";
import { activeSymptomLabels } from "../triage/symptoms";
import {
  STATUS_LABEL,
  fmtDateTime,
  levelBadgeClass,
  statusBadgeClass,
} from "../triage/format";

interface Props {
  records: CallRecord[];
  onOpen: (id: string) => void;
}

export function RecordsList({ records, onOpen }: Props) {
  return (
    <section className="panel records-panel">
      <div className="section-heading">
        <div>
          <p>来电分诊记录</p>
          <h2>全部来电 · {records.length}</h2>
        </div>
      </div>
      {records.length === 0 && <p className="empty-hint">还没有来电记录</p>}
      <div className="table-scroll">
        <table className="records-table">
          <thead>
            <tr>
              <th>来电时刻</th>
              <th>患者</th>
              <th>牙位</th>
              <th>疼痛/症状</th>
              <th>分级与复诊时限</th>
              <th>状态/椅位</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r.id)}>
                <td className="nowrap">{fmtDateTime(r.calledAt)}</td>
                <td>
                  <strong>{r.patientName}</strong>
                  {r.phone ? <small>{r.phone}</small> : null}
                </td>
                <td className="tooth-cell">#{r.tooth}</td>
                <td>
                  <span className="inline-score">
                    {r.painScore}/10
                    {r.symptoms.nightPain ? <b className="night-flag">夜间痛</b> : null}
                  </span>
                  <small>{activeSymptomLabels(r.symptoms).join("、")}</small>
                </td>
                <td>
                  <span className={levelBadgeClass(r.triage.level)}>{r.triage.level}</span>
                  <small>{r.triage.deadlineText}</small>
                </td>
                <td>
                  <span className={statusBadgeClass(r.status)}>{STATUS_LABEL[r.status]}</span>
                  <small>
                    {r.assignment
                      ? `${r.assignment.chairName} ${r.assignment.date.slice(5)} ${r.assignment.time}`
                      : "—"}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
