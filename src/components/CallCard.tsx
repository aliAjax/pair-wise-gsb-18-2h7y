// 页面层：一通来电分诊记录卡片

import type { TriageCall } from "../triage/types";
import { PAIN_NATURE_LABEL, isOverdue } from "../triage/triageRules";
import { formatDateTime } from "../triage/time";
import { StatusBadge, UrgencyBadge, deadlineText } from "./ui";

interface Props {
  call: TriageCall;
  selected?: boolean;
  onSelect?: (id: string) => void;
  footer?: React.ReactNode;
}

export default function CallCard({ call, selected, onSelect, footer }: Props) {
  const tags: string[] = [`疼痛 ${call.painScore}/10`, PAIN_NATURE_LABEL[call.painNature]];
  if (call.nightPain) tags.push("夜间痛");
  if (call.swelling) tags.push("肿胀");
  if (call.fever) tags.push("发热");

  const overdue = isOverdue(call);

  return (
    <article
      className={`call-card ${selected ? "selected" : ""}`}
      onClick={() => onSelect?.(call.id)}
      role={onSelect ? "button" : undefined}
    >
      <header className="call-head">
        <div className="call-id">
          <span className="tooth">#{call.tooth}</span>
          <strong>{call.patientName}</strong>
          <span className="phone">{call.phone}</span>
        </div>
        <StatusBadge status={call.status} />
      </header>

      <div className="call-badges">
        <UrgencyBadge urgency={call.urgency} />
        <span className={`deadline ${overdue ? "overdue" : ""}`}>
          复诊时限：{formatDateTime(call.deadline)}（{deadlineText(call)}）
        </span>
      </div>

      <p className="call-tags">{tags.join(" · ")}</p>
      <p className="call-meta">
        来电 {formatDateTime(call.calledAt)} · 术后第 {call.postOpDays} 晚
      </p>
      {call.note && <p className="call-note">{call.note}</p>}
      {call.advice && <p className="call-advice">分诊：{call.advice}</p>}
      {call.conflictNote && (
        <p className="conflict-note">⚠ {call.conflictNote}</p>
      )}
      {footer && <footer className="call-actions" onClick={(e) => e.stopPropagation()}>{footer}</footer>}
    </article>
  );
}
