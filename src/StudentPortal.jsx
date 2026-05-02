import React, { useMemo } from 'react';
import { supabase } from './supabase.js';
import { DEFAULT_CLASS_TYPES } from './App.jsx';

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Geist:wght@300..700&family=Geist+Mono:wght@400..600&display=swap');`;

// ── Helpers (duplicated subset from App.jsx) ──────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const parseIso = (iso) => new Date(iso + 'T00:00:00');
const fmtDate = (iso) => parseIso(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtDateLong = (iso) => parseIso(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
const fmtTime = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${pad(m)}${period}`;
};
const fmtTimeRange = (start, end) => {
  if (!start) return '';
  if (!end) return fmtTime(start);
  const [sh] = start.split(':').map(Number);
  const [eh] = end.split(':').map(Number);
  const samePeriod = (sh < 12) === (eh < 12);
  if (samePeriod) return `${fmtTime(start).replace(/(am|pm)$/, '')}–${fmtTime(end)}`;
  return `${fmtTime(start)}–${fmtTime(end)}`;
};
const getType = (ct, type) => ct[type] || Object.values(ct)[0];

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudentPortal({ user, studioData }) {
  const { teacherRow, student } = studioData || {};
  const ct = teacherRow?.class_types || DEFAULT_CLASS_TYPES;

  const myClasses = useMemo(() =>
    (teacherRow?.classes || [])
      .filter(c => student && c.attendeeIds.includes(student.id))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [teacherRow?.classes, student?.id]
  );

  const myPayments = useMemo(() =>
    (teacherRow?.payments || [])
      .filter(p => student && p.studentId === student.id)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [teacherRow?.payments, student?.id]
  );

  const totalPaid  = myPayments.reduce((s, p) => s + p.amount, 0);
  const totalSpent = myClasses.reduce((s, c) => s + (getType(ct, c.type).price || 0), 0);
  const balance    = totalPaid - totalSpent;
  const negative   = balance < 0;

  // Edge case: email matched a teacher row but no student record found
  if (!student) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <style>{FONTS}</style>
        <div style={{ maxWidth: '380px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', letterSpacing: '0.14em', color: '#A84E3C', textTransform: 'uppercase', marginBottom: '16px' }}>Dance Studio · Vila</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 400, color: '#1C1917', marginBottom: '8px' }}>Account not linked yet</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: '14px', color: '#78716C', marginBottom: '24px' }}>
            Your email is recognised but your student record isn't fully set up. Ask your teacher to check that your email is saved correctly in their roster.
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#A84E3C', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{FONTS}</style>
      <style>{`
        * { box-sizing: border-box; }
        body, html, #root { margin: 0; padding: 0; }
        .portal { font-family: 'Geist', system-ui, sans-serif; color: #1C1917; }
        .serif  { font-family: 'Fraunces', Georgia, serif; }
        .mono   { font-family: 'Geist Mono', ui-monospace, monospace; font-feature-settings: 'tnum'; }
        ::selection { background: #A84E3C; color: #F5F0E8; }
      `}</style>

      <div className="portal" style={{ minHeight: '100vh', background: '#F5F0E8' }}>
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.5, background: 'radial-gradient(1200px 600px at 20% -200px, rgba(168, 78, 60, 0.08), transparent 70%)', zIndex: 0 }} />

        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 24px 100px', position: 'relative', zIndex: 1 }}>

          {/* Header */}
          <header style={{ marginBottom: '36px' }}>
            <div className="mono" style={{ fontSize: '11px', letterSpacing: '0.14em', color: '#A84E3C', textTransform: 'uppercase', marginBottom: '6px' }}>
              Dance Studio · Vila
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <h1 className="serif" style={{ margin: 0, fontSize: 'clamp(30px, 5vw, 42px)', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
                Hi, <span style={{ fontStyle: 'italic', color: '#A84E3C' }}>{student.name}</span>
              </h1>
              <button onClick={() => supabase.auth.signOut()} className="mono"
                style={{ background: 'none', border: 'none', fontSize: '10px', color: '#A8A29E', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', padding: 0, fontFamily: "'Geist Mono', monospace" }}>
                Sign out
              </button>
            </div>
          </header>

          {/* Balance card */}
          <div style={{ background: '#FBF8F3', border: '1px solid #E7E0D3', borderRadius: '3px', padding: '24px 28px', marginBottom: '28px' }}>
            <div className="mono" style={{ fontSize: '10px', letterSpacing: '0.12em', color: '#78716C', textTransform: 'uppercase', marginBottom: '8px' }}>Your balance</div>
            <div className="serif mono" style={{ fontSize: '52px', fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1, color: negative ? '#A84E3C' : '#1C1917' }}>
              {negative ? '−' : ''}${Math.abs(balance).toFixed(0)}
            </div>
            <div className="serif" style={{ fontStyle: 'italic', fontSize: '13px', color: '#78716C', marginTop: '10px' }}>
              ${totalPaid.toFixed(0)} paid in · ${totalSpent.toFixed(0)} used across {myClasses.length} {myClasses.length === 1 ? 'class' : 'classes'}
            </div>
          </div>

          {/* Classes */}
          <section style={{ marginBottom: '32px' }}>
            <div className="mono" style={{ fontSize: '10px', letterSpacing: '0.12em', color: '#78716C', textTransform: 'uppercase', marginBottom: '14px' }}>
              Classes attended · {myClasses.length}
            </div>

            {myClasses.length === 0 ? (
              <div style={{ border: '1px dashed #D6CCB8', borderRadius: '2px', padding: '32px', textAlign: 'center' }}>
                <div className="serif" style={{ fontStyle: 'italic', color: '#78716C', fontSize: '14px' }}>No classes recorded yet.</div>
              </div>
            ) : (
              <div style={{ background: '#FBF8F3', border: '1px solid #E7E0D3', borderRadius: '2px', overflow: 'hidden' }}>
                {myClasses.map((c, i) => {
                  const t = getType(ct, c.type);
                  return (
                    <div key={c.id} style={{
                      display: 'grid', gridTemplateColumns: '80px 1fr auto',
                      gap: '12px', padding: '14px 20px', alignItems: 'center',
                      borderBottom: i < myClasses.length - 1 ? '1px solid #E7E0D3' : 'none',
                    }}>
                      <div className="mono" style={{ fontSize: '11px', color: '#78716C' }}>{fmtDate(c.date).toUpperCase()}</div>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: t.fg }}>{t.label}</span>
                        <span className="mono" style={{ fontSize: '11px', color: '#78716C', marginLeft: '8px' }}>{fmtTimeRange(c.startTime, c.endTime)}</span>
                      </div>
                      <div className="mono" style={{ fontSize: '13px', color: '#A84E3C' }}>−${t.price}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Payments */}
          <section>
            <div className="mono" style={{ fontSize: '10px', letterSpacing: '0.12em', color: '#78716C', textTransform: 'uppercase', marginBottom: '14px' }}>
              Payments · {myPayments.length}
            </div>

            {myPayments.length === 0 ? (
              <div style={{ border: '1px dashed #D6CCB8', borderRadius: '2px', padding: '32px', textAlign: 'center' }}>
                <div className="serif" style={{ fontStyle: 'italic', color: '#78716C', fontSize: '14px' }}>No payments recorded yet.</div>
              </div>
            ) : (
              <div style={{ background: '#FBF8F3', border: '1px solid #E7E0D3', borderRadius: '2px', overflow: 'hidden' }}>
                {myPayments.map((p, i) => (
                  <div key={p.id} style={{
                    display: 'grid', gridTemplateColumns: '80px 1fr auto',
                    gap: '12px', padding: '14px 20px', alignItems: 'center',
                    borderBottom: i < myPayments.length - 1 ? '1px solid #E7E0D3' : 'none',
                  }}>
                    <div className="mono" style={{ fontSize: '11px', color: '#78716C' }}>{fmtDate(p.date).toUpperCase()}</div>
                    <div>
                      <span style={{ fontSize: '14px', color: '#6B7B3F' }}>Payment</span>
                      {p.note && <span className="serif" style={{ fontStyle: 'italic', color: '#78716C', fontSize: '13px', marginLeft: '6px' }}>· {p.note}</span>}
                    </div>
                    <div className="mono" style={{ fontSize: '13px', color: '#6B7B3F' }}>+${p.amount}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <footer style={{ marginTop: '64px', paddingTop: '20px', borderTop: '1px solid #E7E0D3' }}>
            <div className="serif" style={{ fontStyle: 'italic', color: '#78716C', fontSize: '13px' }}>
              Balance rolls over automatically — no monthly math required.
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
