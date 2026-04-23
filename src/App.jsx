import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Trash2, Receipt, CalendarDays, Users, Check, Edit3 } from 'lucide-react';

// ─────────────────────────────────────────────────────────
// Constants & helpers

const CLASS_TYPES = {
  monday:    { label: 'Monday Class',    price: 25, fg: '#A84E3C', bg: '#F5E0DA', defaultTime: ['19:00', '20:00'] },
  saturday:  { label: 'Saturday Class',  price: 25, fg: '#7A5A6B', bg: '#EEE3E8', defaultTime: ['10:00', '11:30'] },
  rehearsal: { label: 'Rehearsal',       price: 20, fg: '#B8772E', bg: '#F5EEDF', defaultTime: ['18:00', '19:30'] },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const pad = (n) => String(n).padStart(2, '0');
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayIso = () => toIso(new Date());
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const monthKey = (iso) => iso.slice(0, 7);
const thisMonth = () => todayIso().slice(0, 7);

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
  if (samePeriod) {
    const startStripped = fmtTime(start).replace(/(am|pm)$/, '');
    return `${startStripped}–${fmtTime(end)}`;
  }
  return `${fmtTime(start)}–${fmtTime(end)}`;
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Geist:wght@300..700&family=Geist+Mono:wght@400..600&display=swap');`;

const migrateClass = (c) => ({
  ...c,
  startTime: c.startTime || CLASS_TYPES[c.type]?.defaultTime?.[0] || '19:00',
  endTime:   c.endTime   || CLASS_TYPES[c.type]?.defaultTime?.[1] || '20:00',
});

// ─────────────────────────────────────────────────────────
// Main App

export default function App() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [tab, setTab] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState(thisMonth());
  const [modal, setModal] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Load from localStorage on mount (synchronous — no async needed)
  useEffect(() => {
    const pull = (key) => {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
      catch { return null; }
    };
    const s = pull('students');
    const c = pull('classes');
    const p = pull('payments');
    if (s) setStudents(s);
    if (c) setClasses(c.map(migrateClass));
    if (p) setPayments(p);
    setLoaded(true);
  }, []);

  const persist = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const updateStudents = (next) => { setStudents(next); persist('students', next); };
  const updateClasses  = (next) => { setClasses(next);  persist('classes',  next); };
  const updatePayments = (next) => { setPayments(next); persist('payments', next); };

  const balanceOf = (sid) => {
    const paid = payments.filter(p => p.studentId === sid).reduce((s, p) => s + p.amount, 0);
    const used = classes
      .filter(c => c.attendeeIds.includes(sid))
      .reduce((s, c) => s + CLASS_TYPES[c.type].price, 0);
    return paid - used;
  };
  const totalPaidBy    = (sid) => payments.filter(p => p.studentId === sid).reduce((s, p) => s + p.amount, 0);
  const classesTakenBy = (sid) => classes.filter(c => c.attendeeIds.includes(sid)).length;

  const monthStats = useMemo(() => {
    const m = thisMonth();
    const monthClasses = classes.filter(c => monthKey(c.date) === m);
    const earned = monthClasses.reduce((s, c) => s + CLASS_TYPES[c.type].price * c.attendeeIds.length, 0);
    const received = payments.filter(p => monthKey(p.date) === m).reduce((s, p) => s + p.amount, 0);
    const totalBalance = students.reduce((s, st) => s + balanceOf(st.id), 0);
    return { earned, received, totalBalance, classCount: monthClasses.length, studentCount: students.length };
  }, [classes, payments, students]);

  const classesByDate = useMemo(() => {
    const m = new Map();
    for (const c of classes) {
      if (!m.has(c.date)) m.set(c.date, []);
      m.get(c.date).push(c);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    return m;
  }, [classes]);

  const addStudent = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = uid();
    const next = [...students, { id, name: trimmed, createdAt: new Date().toISOString() }];
    updateStudents(next);
    return id;
  };
  const deleteStudent = (id) => {
    if (!confirm('Remove this student from the roster? Their attendance and payment history stays in the log.')) return;
    updateStudents(students.filter(s => s.id !== id));
  };

  const addClass = (date, type, startTime, endTime) => {
    const id = uid();
    updateClasses([...classes, { id, date, type, startTime, endTime, attendeeIds: [], createdAt: new Date().toISOString() }]);
    return id;
  };
  const updateClass = (id, patch) => {
    updateClasses(classes.map(c => c.id === id ? { ...c, ...patch } : c));
  };
  const deleteClass = (id) => {
    if (!confirm('Delete this class session?')) return;
    updateClasses(classes.filter(c => c.id !== id));
    if (modal?.type === 'classDetail' && modal.id === id) setModal(null);
  };
  const toggleAttendee = (classId, studentId) => {
    const c = classes.find(x => x.id === classId);
    if (!c) return;
    const has = c.attendeeIds.includes(studentId);
    updateClass(classId, {
      attendeeIds: has ? c.attendeeIds.filter(x => x !== studentId) : [...c.attendeeIds, studentId]
    });
  };

  const recordPayment = (studentId, amount, date, note) => {
    updatePayments([...payments, { id: uid(), studentId, amount, date, note: note || '', createdAt: new Date().toISOString() }]);
  };
  const deletePayment = (id) => {
    if (!confirm('Delete this payment record?')) return;
    updatePayments(payments.filter(p => p.id !== id));
  };

  if (!loaded) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{FONTS}</style>
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', color: '#78716C' }}>Loading…</div>
      </div>
    );
  }

  const currentClass = modal?.type === 'classDetail' ? classes.find(c => c.id === modal.id) : null;
  const selectedStudent = selectedStudentId ? students.find(s => s.id === selectedStudentId) : null;

  return (
    <>
      <style>{FONTS}</style>
      <style>{`
        * { box-sizing: border-box; }
        body, html, #root { margin: 0; padding: 0; }
        .app { font-family: 'Geist', system-ui, sans-serif; color: #1C1917; }
        .serif { font-family: 'Fraunces', Georgia, serif; }
        .mono { font-family: 'Geist Mono', ui-monospace, monospace; font-feature-settings: 'tnum'; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #A84E3C; outline-offset: 2px; }
        .fade-in { animation: fadeIn 200ms cubic-bezier(0.2, 0, 0, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .scale-in { animation: scaleIn 180ms cubic-bezier(0.2, 0, 0, 1); }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        input, select { font: inherit; }
        ::selection { background: #A84E3C; color: #F5F0E8; }
        .calendar-day:hover .add-hint { opacity: 1; }
      `}</style>

      <div className="app" style={{ minHeight: '100vh', background: '#F5F0E8' }}>
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.5, background: 'radial-gradient(1200px 600px at 20% -200px, rgba(168, 78, 60, 0.08), transparent 70%)', zIndex: 0 }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 32px 120px', position: 'relative', zIndex: 1 }}>
          <header style={{ marginBottom: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div className="mono" style={{ fontSize: '11px', letterSpacing: '0.14em', color: '#A84E3C', textTransform: 'uppercase', marginBottom: '6px' }}>Dance Studio · Ledger</div>
                <h1 className="serif" style={{ margin: 0, fontSize: 'clamp(34px, 4.5vw, 48px)', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.02 }}>
                  The Book<span className="serif" style={{ fontStyle: 'italic', color: '#A84E3C' }}> of Classes</span>
                </h1>
              </div>
              <div className="mono" style={{ fontSize: '12px', color: '#78716C' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
            </div>

            <div style={{ marginTop: '28px', paddingTop: '22px', borderTop: '1px solid #E7E0D3', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '28px' }}>
              <StatBlock label="Outstanding balance" value={`$${monthStats.totalBalance.toFixed(0)}`} hint="total credit held" positive={monthStats.totalBalance >= 0} />
              <StatBlock label="Received this month" value={`$${monthStats.received.toFixed(0)}`} hint={`${payments.filter(p => monthKey(p.date) === thisMonth()).length} payments`} />
              <StatBlock label="Earned this month" value={`$${monthStats.earned.toFixed(0)}`} hint={`${monthStats.classCount} sessions held`} />
              <StatBlock label="Students" value={String(monthStats.studentCount)} hint="on the roster" />
            </div>
          </header>

          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #E7E0D3' }}>
            <TabButton active={tab === 'calendar'} onClick={() => setTab('calendar')}>
              <CalendarDays size={14} strokeWidth={1.75} /> Calendar
            </TabButton>
            <TabButton active={tab === 'students'} onClick={() => setTab('students')}>
              <Users size={14} strokeWidth={1.75} /> Students
            </TabButton>
          </div>

          {tab === 'calendar' && (
            <CalendarView
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              classesByDate={classesByDate}
              onAddClass={(date) => { setModalData({ date }); setModal('addClass'); }}
              onOpenClass={(id) => setModal({ type: 'classDetail', id })}
            />
          )}

          {tab === 'students' && (
            <StudentsView
              students={students}
              balanceOf={balanceOf}
              totalPaidBy={totalPaidBy}
              classesTakenBy={classesTakenBy}
              onAddStudent={() => setModal('addStudentStandalone')}
              onRecordPayment={(studentId) => { setModalData({ studentId }); setModal('recordPayment'); }}
              onViewStudent={(id) => setSelectedStudentId(id)}
            />
          )}

          <footer style={{ marginTop: '72px', paddingTop: '20px', borderTop: '1px solid #E7E0D3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div className="serif" style={{ fontStyle: 'italic', color: '#78716C', fontSize: '13px' }}>
              Balance rolls over automatically — no monthly math required.
            </div>
            <div className="mono" style={{ fontSize: '10px', color: '#A8A29E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>v0.2 · Prototype</div>
          </footer>
        </div>

        {modal === 'addClass' && (
          <AddClassModal
            defaultDate={modalData?.date || todayIso()}
            onClose={() => { setModal(null); setModalData(null); }}
            onSubmit={(date, type, st, et) => { const id = addClass(date, type, st, et); setModal({ type: 'classDetail', id }); setModalData(null); }}
          />
        )}
        {currentClass && (
          <ClassDetailModal
            cls={currentClass}
            students={students}
            onClose={() => setModal(null)}
            onToggleAttendee={(sid) => toggleAttendee(currentClass.id, sid)}
            onAddStudent={(name) => { const sid = addStudent(name); if (sid) toggleAttendee(currentClass.id, sid); }}
            onEditClass={(patch) => updateClass(currentClass.id, patch)}
            onDelete={() => deleteClass(currentClass.id)}
          />
        )}
        {modal === 'recordPayment' && (
          <RecordPaymentModal
            students={students}
            defaultStudentId={modalData?.studentId}
            onClose={() => { setModal(null); setModalData(null); }}
            onSubmit={(sid, amt, d, note) => { recordPayment(sid, amt, d, note); setModal(null); setModalData(null); }}
          />
        )}
        {modal === 'addStudentStandalone' && (
          <AddStudentStandaloneModal onClose={() => setModal(null)} onSubmit={(n) => { addStudent(n); setModal(null); }} />
        )}
        {selectedStudent && (
          <StudentDetailModal
            student={selectedStudent}
            balance={balanceOf(selectedStudent.id)}
            classes={classes.filter(c => c.attendeeIds.includes(selectedStudent.id))}
            payments={payments.filter(p => p.studentId === selectedStudent.id)}
            onClose={() => setSelectedStudentId(null)}
            onDeleteStudent={() => { deleteStudent(selectedStudent.id); setSelectedStudentId(null); }}
            onDeleteClass={deleteClass}
            onDeletePayment={deletePayment}
            onRecordPayment={() => { setModalData({ studentId: selectedStudent.id }); setModal('recordPayment'); setSelectedStudentId(null); }}
          />
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Calendar

function CalendarView({ currentMonth, setCurrentMonth, classesByDate, onAddClass, onOpenClass }) {
  const [y, m] = currentMonth.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const startWeekday = firstDay.getDay();

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayOffset = i - startWeekday;
    const d = new Date(y, m - 1, 1 + dayOffset);
    cells.push(d);
  }

  const jumpMonth = (delta) => {
    const d = new Date(y, m - 1 + delta, 1);
    setCurrentMonth(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);
  };

  const today = todayIso();
  const monthLabel = `${MONTH_NAMES[m-1]} ${y}`;

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconButton onClick={() => jumpMonth(-1)} aria-label="Previous month"><ChevronLeft size={17} strokeWidth={1.75} /></IconButton>
          <h2 className="serif" style={{ margin: 0, fontSize: '26px', fontWeight: 400, letterSpacing: '-0.01em', minWidth: '220px' }}>{monthLabel}</h2>
          <IconButton onClick={() => jumpMonth(1)} aria-label="Next month"><ChevronRight size={17} strokeWidth={1.75} /></IconButton>
          <button onClick={() => setCurrentMonth(thisMonth())}
            className="mono" style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#A84E3C', fontSize: '11px', letterSpacing: '0.08em', cursor: 'pointer', padding: '6px 10px', fontFamily: "'Geist Mono', monospace" }}>
            today
          </button>
        </div>
        <PrimaryButton onClick={() => onAddClass(today)}>
          <Plus size={15} strokeWidth={1.75} /> Add class
        </PrimaryButton>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '6px' }}>
        {WEEKDAYS.map(d => (
          <div key={d} className="mono" style={{ fontSize: '10px', letterSpacing: '0.12em', color: '#78716C', textTransform: 'uppercase', padding: '8px 10px' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', background: '#E7E0D3', border: '1px solid #E7E0D3', borderRadius: '2px', overflow: 'hidden' }}>
        {cells.map((d, i) => {
          const iso = toIso(d);
          const inMonth = d.getMonth() === m - 1;
          const isToday = iso === today;
          const dayClasses = classesByDate.get(iso) || [];
          return (
            <DayCell
              key={i}
              d={d}
              iso={iso}
              inMonth={inMonth}
              isToday={isToday}
              dayClasses={dayClasses}
              onAddClass={() => onAddClass(iso)}
              onOpenClass={onOpenClass}
            />
          );
        })}
      </div>

      <div style={{ marginTop: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {Object.entries(CLASS_TYPES).map(([key, v]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', background: v.fg, borderRadius: '1px' }} />
            <span className="mono" style={{ fontSize: '11px', color: '#78716C', letterSpacing: '0.04em' }}>
              {v.label.toLowerCase()} · ${v.price}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DayCell({ d, iso, inMonth, isToday, dayClasses, onAddClass, onOpenClass }) {
  const visible = dayClasses.slice(0, 3);
  const hidden = Math.max(0, dayClasses.length - 3);

  return (
    <div
      className="calendar-day"
      style={{
        background: inMonth ? '#FBF8F3' : '#F5F0E8',
        minHeight: '118px',
        padding: '8px 8px 10px',
        position: 'relative',
        cursor: 'pointer',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target.dataset?.cellBg === '1') onAddClass();
      }}
      data-cell-bg="1"
    >
      <div data-cell-bg="1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span className="serif" style={{
          fontSize: '15px', fontWeight: 500, letterSpacing: '-0.01em',
          color: isToday ? '#F5F0E8' : (inMonth ? '#1C1917' : '#B6AEA0'),
          background: isToday ? '#A84E3C' : 'transparent',
          width: isToday ? '24px' : 'auto', height: isToday ? '24px' : 'auto',
          borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          paddingLeft: isToday ? 0 : 4,
        }}>
          {d.getDate()}
        </span>
        <span className="add-hint mono" style={{ fontSize: '14px', color: '#A84E3C', opacity: 0, transition: 'opacity 150ms', pointerEvents: 'none' }}>+</span>
      </div>

      <div style={{ display: 'grid', gap: '2px' }} data-cell-bg="1">
        {visible.map(c => <ClassChip key={c.id} cls={c} onClick={() => onOpenClass(c.id)} />)}
        {hidden > 0 && (
          <div className="mono" style={{ fontSize: '10px', color: '#78716C', padding: '2px 4px', letterSpacing: '0.04em' }}>
            + {hidden} more
          </div>
        )}
      </div>
    </div>
  );
}

function ClassChip({ cls, onClick }) {
  const t = CLASS_TYPES[cls.type];
  const count = cls.attendeeIds.length;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        background: t.bg, border: 'none', borderLeft: `2px solid ${t.fg}`,
        padding: '4px 6px 4px 7px', borderRadius: '1px', cursor: 'pointer', textAlign: 'left',
        display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px', alignItems: 'center',
        fontFamily: 'inherit', overflow: 'hidden',
      }}
      title={`${t.label} · ${fmtTimeRange(cls.startTime, cls.endTime)}${count ? ` · ${count} attended` : ''}`}
    >
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span className="mono" style={{ fontSize: '10px', color: t.fg, letterSpacing: '0.02em' }}>
          {fmtTimeRange(cls.startTime, cls.endTime)}
        </span>
        <span style={{ fontSize: '11px', color: t.fg, fontWeight: 500, marginLeft: '5px' }}>
          {t.label.replace(' Class', '')}
        </span>
      </div>
      {count > 0 && (
        <span className="mono" style={{ fontSize: '9px', color: t.fg, opacity: 0.85, fontWeight: 600 }}>{count}</span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// Students

function StudentsView({ students, balanceOf, totalPaidBy, classesTakenBy, onAddStudent, onRecordPayment, onViewStudent }) {
  const rows = useMemo(() => students.map(s => ({
    ...s, balance: balanceOf(s.id), paid: totalPaidBy(s.id), taken: classesTakenBy(s.id),
  })).sort((a, b) => a.name.localeCompare(b.name)), [students, balanceOf, totalPaidBy, classesTakenBy]);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h2 className="serif" style={{ margin: 0, fontSize: '26px', fontWeight: 400, letterSpacing: '-0.01em' }}>
          Roster <span className="serif" style={{ fontStyle: 'italic', color: '#78716C', fontSize: '16px' }}>· {students.length} students</span>
        </h2>
        <SecondaryButton onClick={onAddStudent}><Plus size={14} strokeWidth={1.75} /> Add student</SecondaryButton>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users size={22} strokeWidth={1.5} />}
          title="No students yet"
          body="Add your first student, or add them on the fly when marking attendance in a class."
          cta="Add student"
          onClick={onAddStudent}
        />
      ) : (
        <div style={{ background: '#FBF8F3', border: '1px solid #E7E0D3', borderRadius: '2px', overflow: 'hidden' }}>
          <div className="mono" style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
            gap: '16px', padding: '14px 24px',
            fontSize: '10px', letterSpacing: '0.12em', color: '#78716C',
            textTransform: 'uppercase', borderBottom: '1px solid #E7E0D3',
          }}>
            <div>Student</div>
            <div style={{ textAlign: 'right' }}>Paid in</div>
            <div style={{ textAlign: 'right' }}>Classes taken</div>
            <div style={{ textAlign: 'right' }}>Balance</div>
            <div />
          </div>
          {rows.map(r => (
            <StudentRow key={r.id} row={r}
              onClick={() => onViewStudent(r.id)}
              onRecordPayment={(e) => { e.stopPropagation(); onRecordPayment(r.id); }} />
          ))}
        </div>
      )}
    </section>
  );
}

function StudentRow({ row, onClick, onRecordPayment }) {
  const negative = row.balance < 0;
  const low = !negative && row.balance < 25;
  return (
    <div onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
        gap: '16px', padding: '18px 24px', alignItems: 'center',
        borderBottom: '1px solid #E7E0D3', cursor: 'pointer',
        transition: 'background 120ms',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(168, 78, 60, 0.03)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div>
        <div className="serif" style={{ fontSize: '17px', fontWeight: 500, letterSpacing: '-0.01em' }}>{row.name}</div>
        {(negative || low) && (
          <span className="mono" style={{ fontSize: '9px', letterSpacing: '0.1em', marginTop: '4px', display: 'inline-block', color: negative ? '#A84E3C' : '#B8772E', textTransform: 'uppercase' }}>
            {negative ? 'overdrawn' : 'running low'}
          </span>
        )}
      </div>
      <div className="mono" style={{ fontSize: '15px', color: '#1C1917', textAlign: 'right' }}>${row.paid.toFixed(0)}</div>
      <div className="mono" style={{ fontSize: '15px', color: '#78716C', textAlign: 'right' }}>{row.taken}</div>
      <div className="serif mono" style={{
        fontSize: '22px', letterSpacing: '-0.01em', textAlign: 'right',
        color: negative ? '#A84E3C' : row.balance === 0 ? '#78716C' : '#1C1917',
      }}>
        {negative ? '−' : ''}${Math.abs(row.balance).toFixed(0)}
      </div>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button onClick={onRecordPayment} className="mono" style={{
          background: 'transparent', border: '1px solid #D6CCB8', color: '#1C1917',
          fontSize: '10px', letterSpacing: '0.08em', padding: '5px 10px',
          borderRadius: '2px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: "'Geist Mono', monospace",
        }}>+ pay</button>
        <ChevronRight size={14} strokeWidth={1.5} style={{ color: '#A8A29E' }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Primitives

function StatBlock({ label, value, hint, positive = true }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: '10px', color: '#78716C', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
      <div className="serif" style={{ fontSize: '30px', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1, color: positive ? '#1C1917' : '#A84E3C' }}>{value}</div>
      <div className="serif" style={{ fontStyle: 'italic', fontSize: '13px', color: '#78716C', marginTop: '4px' }}>{hint}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{
        background: 'transparent', border: 'none', padding: '12px 18px', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        fontSize: '13px', fontWeight: 500, fontFamily: 'inherit',
        color: active ? '#1C1917' : '#78716C',
        borderBottom: active ? '2px solid #A84E3C' : '2px solid transparent',
        marginBottom: '-1px', letterSpacing: '0.01em',
      }}>{children}</button>
  );
}

function PrimaryButton({ children, onClick, disabled, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '10px 16px', background: disabled ? '#D6CCB8' : '#1C1917',
        color: disabled ? '#78716C' : '#F5F0E8',
        border: 'none', borderRadius: '2px', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '13px', fontWeight: 500, fontFamily: 'inherit',
        transition: 'transform 150ms',
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
    >{children}</button>
  );
}

function SecondaryButton({ children, onClick, disabled, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '9px 15px', background: 'transparent',
        color: disabled ? '#A8A29E' : '#1C1917',
        border: '1px solid ' + (disabled ? '#E7E0D3' : '#1C1917'),
        borderRadius: '2px', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '13px', fontWeight: 500, fontFamily: 'inherit',
      }}
    >{children}</button>
  );
}

function IconButton({ children, onClick, ...rest }) {
  return (
    <button onClick={onClick} {...rest}
      style={{
        background: 'transparent', border: '1px solid #E7E0D3', borderRadius: '2px',
        width: '34px', height: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#1C1917',
      }}>{children}</button>
  );
}

function EmptyState({ icon, title, body, cta, onClick }) {
  return (
    <div style={{ border: '1px dashed #D6CCB8', borderRadius: '2px', padding: '48px 32px', textAlign: 'center', background: 'rgba(251, 248, 243, 0.5)' }}>
      <div style={{ color: '#A84E3C', marginBottom: '12px', display: 'inline-flex' }}>{icon}</div>
      <div className="serif" style={{ fontSize: '18px', marginBottom: '6px', letterSpacing: '-0.01em' }}>{title}</div>
      <div className="serif" style={{ fontStyle: 'italic', fontSize: '13px', color: '#78716C', marginBottom: cta ? '20px' : 0, maxWidth: '340px', margin: cta ? '0 auto 20px' : '0 auto' }}>{body}</div>
      {cta && <SecondaryButton onClick={onClick}><Plus size={14} strokeWidth={1.75} /> {cta}</SecondaryButton>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Modals

function ModalShell({ children, onClose, title, subtitle, maxWidth = '540px' }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28, 25, 23, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 100, backdropFilter: 'blur(4px)' }}>
      <div className="scale-in" onClick={e => e.stopPropagation()}
        style={{ background: '#FBF8F3', borderRadius: '3px', maxWidth, width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 40px 80px -20px rgba(28, 25, 23, 0.3)' }}>
        <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid #E7E0D3', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div>
            <h2 className="serif" style={{ margin: 0, fontSize: '22px', fontWeight: 400, letterSpacing: '-0.01em' }}>{title}</h2>
            {subtitle && <div className="serif" style={{ fontStyle: 'italic', fontSize: '13px', color: '#78716C', marginTop: '4px' }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#78716C', padding: '4px', display: 'flex' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div style={{ padding: '22px 28px 28px' }}>{children}</div>
      </div>
    </div>
  );
}

const inputStyle = () => ({ width: '100%', padding: '10px 13px', background: 'transparent', border: '1px solid #D6CCB8', borderRadius: '2px', fontSize: '14px', color: '#1C1917', fontFamily: 'inherit' });
const labelStyle = () => ({ display: 'block', fontSize: '10px', color: '#78716C', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '7px', fontFamily: "'Geist Mono', monospace" });

function AddStudentStandaloneModal({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  return (
    <ModalShell onClose={onClose} title="New student" subtitle="Add to the roster">
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name); }}>
        <label style={labelStyle()}>Name</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} style={inputStyle()} placeholder="e.g. Mia Chen" />
        <div style={{ display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'flex-end' }}>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={!name.trim()}>Add</PrimaryButton>
        </div>
      </form>
    </ModalShell>
  );
}

function AddClassModal({ defaultDate, onClose, onSubmit }) {
  const computeDefaults = (iso) => {
    const wd = parseIso(iso).getDay();
    const t = wd === 1 ? 'monday' : wd === 6 ? 'saturday' : 'rehearsal';
    return { type: t, startTime: CLASS_TYPES[t].defaultTime[0], endTime: CLASS_TYPES[t].defaultTime[1] };
  };

  const initial = computeDefaults(defaultDate);
  const [date, setDate] = useState(defaultDate);
  const [type, setType] = useState(initial.type);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);

  const changeType = (t) => {
    setType(t);
    setStartTime(CLASS_TYPES[t].defaultTime[0]);
    setEndTime(CLASS_TYPES[t].defaultTime[1]);
  };
  const changeDate = (d) => {
    setDate(d);
    const nd = computeDefaults(d);
    setType(nd.type);
    setStartTime(nd.startTime);
    setEndTime(nd.endTime);
  };

  return (
    <ModalShell onClose={onClose} title="Add a class" subtitle="Schedule a session on the calendar">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(date, type, startTime, endTime); }}>
        <label style={labelStyle()}>Date</label>
        <input type="date" value={date} onChange={e => changeDate(e.target.value)} style={{ ...inputStyle(), marginBottom: '18px' }} />

        <label style={labelStyle()}>Class type</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '18px' }}>
          {Object.entries(CLASS_TYPES).map(([key, v]) => {
            const active = type === key;
            return (
              <button key={key} type="button" onClick={() => changeType(key)}
                style={{
                  padding: '12px 8px', borderRadius: '2px', cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${active ? v.fg : '#D6CCB8'}`,
                  background: active ? v.bg : 'transparent',
                  color: active ? v.fg : '#1C1917',
                  textAlign: 'center',
                }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{v.label.replace(' Class', '')}</div>
                <div className="mono" style={{ fontSize: '10px', marginTop: '3px', opacity: 0.8 }}>${v.price}</div>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle()}>Start time</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle()} />
          </div>
          <div>
            <label style={labelStyle()}>End time</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle()} />
          </div>
        </div>

        <div style={{ padding: '12px 14px', background: CLASS_TYPES[type].bg, borderRadius: '2px', borderLeft: `2px solid ${CLASS_TYPES[type].fg}` }}>
          <div className="serif" style={{ fontStyle: 'italic', fontSize: '13px', color: CLASS_TYPES[type].fg }}>
            {fmtDateLong(date)} · {fmtTimeRange(startTime, endTime)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'flex-end' }}>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit">Add to calendar</PrimaryButton>
        </div>
      </form>
    </ModalShell>
  );
}

function ClassDetailModal({ cls, students, onClose, onToggleAttendee, onAddStudent, onEditClass, onDelete }) {
  const t = CLASS_TYPES[cls.type];
  const [showAddInput, setShowAddInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(false);
  const [editStart, setEditStart] = useState(cls.startTime);
  const [editEnd, setEditEnd] = useState(cls.endTime);
  const inputRef = useRef(null);

  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name));
  const present = cls.attendeeIds.length;
  const revenue = present * t.price;

  const handleAddStudent = () => {
    if (newName.trim()) {
      onAddStudent(newName.trim());
      setNewName('');
    }
  };

  useEffect(() => {
    if (showAddInput && inputRef.current) inputRef.current.focus();
  }, [showAddInput]);

  return (
    <ModalShell onClose={onClose} title={t.label} subtitle={fmtDateLong(cls.date)} maxWidth="540px">
      <div style={{ padding: '14px 16px', background: t.bg, borderRadius: '2px', borderLeft: `2px solid ${t.fg}`, marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        {!editing ? (
          <>
            <div>
              <div className="mono" style={{ fontSize: '10px', letterSpacing: '0.1em', color: t.fg, opacity: 0.7, textTransform: 'uppercase', marginBottom: '2px' }}>Time</div>
              <div className="serif" style={{ fontSize: '18px', color: t.fg }}>{fmtTimeRange(cls.startTime, cls.endTime)}</div>
            </div>
            <button type="button" onClick={() => setEditing(true)}
              style={{ background: 'transparent', border: 'none', color: t.fg, cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit', fontSize: '12px' }}>
              <Edit3 size={13} strokeWidth={1.75} /> edit
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} style={{ ...inputStyle(), flex: 1 }} />
            <span style={{ color: t.fg }}>–</span>
            <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} style={{ ...inputStyle(), flex: 1 }} />
            <button type="button" onClick={() => { onEditClass({ startTime: editStart, endTime: editEnd }); setEditing(false); }}
              className="mono" style={{ background: t.fg, color: '#F5F0E8', border: 'none', padding: '9px 12px', borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontFamily: "'Geist Mono', monospace" }}>
              save
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
        <div style={labelStyle()}>Attendance</div>
        {!showAddInput && (
          <button type="button" onClick={() => setShowAddInput(true)}
            className="mono" style={{ background: 'none', border: 'none', color: '#A84E3C', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.06em', padding: 0, fontFamily: "'Geist Mono', monospace" }}>
            + add new student
          </button>
        )}
      </div>

      <div style={{ border: '1px solid #D6CCB8', borderRadius: '2px', maxHeight: '280px', overflow: 'auto' }}>
        {showAddInput && (
          <div style={{ display: 'flex', padding: '10px 12px', gap: '8px', borderBottom: '1px solid #E7E0D3', background: 'rgba(168, 78, 60, 0.04)' }}>
            <input
              ref={inputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddStudent(); }
                if (e.key === 'Escape') { setShowAddInput(false); setNewName(''); }
              }}
              placeholder="New student name — hit enter to add"
              style={{ ...inputStyle(), flex: 1, padding: '7px 10px' }}
            />
            <button type="button" onClick={handleAddStudent} disabled={!newName.trim()}
              className="mono" style={{ background: newName.trim() ? '#A84E3C' : '#D6CCB8', color: '#F5F0E8', border: 'none', padding: '7px 12px', borderRadius: '2px', fontSize: '11px', cursor: newName.trim() ? 'pointer' : 'default', fontFamily: "'Geist Mono', monospace" }}>
              add
            </button>
            <button type="button" onClick={() => { setShowAddInput(false); setNewName(''); }}
              style={{ background: 'transparent', border: '1px solid #D6CCB8', padding: '6px 8px', borderRadius: '2px', cursor: 'pointer', color: '#78716C', display: 'flex', alignItems: 'center' }}>
              <X size={13} strokeWidth={1.5} />
            </button>
          </div>
        )}
        {sorted.length === 0 && !showAddInput ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' }} className="serif">
            <span style={{ fontStyle: 'italic', color: '#78716C', fontSize: '13px' }}>No students on roster yet. </span>
            <button type="button" onClick={() => setShowAddInput(true)}
              style={{ background: 'none', border: 'none', color: '#A84E3C', cursor: 'pointer', fontSize: '13px', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>
              add one now
            </button>
          </div>
        ) : (
          sorted.map(s => {
            const checked = cls.attendeeIds.includes(s.id);
            return (
              <label key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '11px 14px', cursor: 'pointer',
                  borderBottom: '1px solid #E7E0D3',
                  background: checked ? 'rgba(168, 78, 60, 0.05)' : 'transparent',
                }}>
                <input type="checkbox" checked={checked} onChange={() => onToggleAttendee(s.id)} style={{ accentColor: '#A84E3C' }} />
                <span style={{ fontSize: '14px', flex: 1 }}>{s.name}</span>
                {checked && <Check size={13} strokeWidth={2} style={{ color: '#A84E3C' }} />}
              </label>
            );
          })
        )}
      </div>

      <div style={{ marginTop: '18px', padding: '12px 14px', background: '#F5EEDF', borderRadius: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="serif" style={{ fontStyle: 'italic', fontSize: '13px', color: '#78716C' }}>
          {present} {present === 1 ? 'student' : 'students'} × ${t.price}
        </div>
        <div className="serif mono" style={{ fontSize: '22px', letterSpacing: '-0.01em' }}>${revenue}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '22px' }}>
        <button type="button" onClick={onDelete}
          className="mono" style={{ background: 'none', border: 'none', color: '#A84E3C', fontSize: '11px', letterSpacing: '0.06em', cursor: 'pointer', padding: 0, fontFamily: "'Geist Mono', monospace", display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Trash2 size={12} strokeWidth={1.5} /> delete class
        </button>
        <PrimaryButton onClick={onClose}>Done</PrimaryButton>
      </div>
    </ModalShell>
  );
}

function RecordPaymentModal({ students, defaultStudentId, onClose, onSubmit }) {
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name));
  const [studentId, setStudentId] = useState(defaultStudentId || sorted[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const amt = parseFloat(amount) || 0;

  return (
    <ModalShell onClose={onClose} title="Record a payment" subtitle="Money received from a student">
      <form onSubmit={(e) => { e.preventDefault(); if (studentId && amt) onSubmit(studentId, amt, date, note); }}>
        <label style={labelStyle()}>Student</label>
        <select value={studentId} onChange={e => setStudentId(e.target.value)} style={{ ...inputStyle(), marginBottom: '18px' }}>
          {sorted.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
          <div>
            <label style={labelStyle()}>Amount ($)</label>
            <input autoFocus type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle()} placeholder="100" />
          </div>
          <div>
            <label style={labelStyle()}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle()} />
          </div>
        </div>

        <label style={labelStyle()}>Note <span style={{ textTransform: 'none', letterSpacing: 0, color: '#A8A29E' }}>(optional)</span></label>
        <input value={note} onChange={e => setNote(e.target.value)} style={inputStyle()} placeholder="e.g. November upfront" />

        {amt > 0 && (
          <div style={{ marginTop: '16px', padding: '12px 14px', background: '#F0F3E5', borderRadius: '2px' }}>
            <div className="serif" style={{ fontStyle: 'italic', fontSize: '13px', color: '#5A6B2F' }}>
              Covers approximately <span className="mono" style={{ fontStyle: 'normal' }}>{Math.floor(amt / 25)}</span> regular classes
              {' '}or <span className="mono" style={{ fontStyle: 'normal' }}>{Math.floor(amt / 20)}</span> rehearsals.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'flex-end' }}>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={!studentId || !amt}>Record</PrimaryButton>
        </div>
      </form>
    </ModalShell>
  );
}

function StudentDetailModal({ student, balance, classes, payments, onClose, onDeleteStudent, onDeleteClass, onDeletePayment, onRecordPayment }) {
  const history = useMemo(() => {
    const items = [
      ...classes.map(c => ({ ...c, kind: 'class', sortKey: c.date + c.createdAt })),
      ...payments.map(p => ({ ...p, kind: 'payment', sortKey: p.date + p.createdAt })),
    ];
    return items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [classes, payments]);

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const totalSpent = classes.reduce((s, c) => s + CLASS_TYPES[c.type].price, 0);
  const negative = balance < 0;

  return (
    <ModalShell onClose={onClose} title={student.name} subtitle={`On roster since ${fmtDateLong(student.createdAt.slice(0, 10))}`}>
      <div style={{ padding: '16px 0 20px', borderBottom: '1px solid #E7E0D3', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
        <div>
          <div className="mono" style={{ fontSize: '10px', letterSpacing: '0.12em', color: '#78716C', textTransform: 'uppercase', marginBottom: '6px' }}>Current balance</div>
          <div className="serif mono" style={{ fontSize: '44px', fontWeight: 400, letterSpacing: '-0.03em', color: negative ? '#A84E3C' : '#1C1917', lineHeight: 1 }}>
            {negative ? '−' : ''}${Math.abs(balance).toFixed(0)}
          </div>
          <div className="serif" style={{ fontStyle: 'italic', fontSize: '13px', color: '#78716C', marginTop: '6px' }}>
            ${totalPaid.toFixed(0)} paid in · ${totalSpent.toFixed(0)} in classes · {classes.length} sessions
          </div>
        </div>
        <SecondaryButton onClick={onRecordPayment}><Receipt size={14} strokeWidth={1.75} /> Record payment</SecondaryButton>
      </div>

      <div style={labelStyle()}>History</div>
      {history.length === 0 ? (
        <div className="serif" style={{ fontStyle: 'italic', color: '#78716C', fontSize: '14px', padding: '16px 0' }}>No activity yet.</div>
      ) : (
        <div style={{ maxHeight: '300px', overflow: 'auto' }}>
          {history.map(item => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #E7E0D3' }}>
              <div className="mono" style={{ fontSize: '11px', color: '#78716C', width: '60px' }}>{fmtDate(item.date).toUpperCase()}</div>
              <div style={{ fontSize: '13px' }}>
                {item.kind === 'class' ? (
                  <>
                    <span style={{ color: CLASS_TYPES[item.type].fg }}>{CLASS_TYPES[item.type].label}</span>
                    <span className="mono" style={{ color: '#78716C', fontSize: '11px', marginLeft: '6px' }}>{fmtTimeRange(item.startTime, item.endTime)}</span>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#6B7B3F' }}>Payment</span>
                    {item.note && <span className="serif" style={{ fontStyle: 'italic', color: '#78716C' }}> · {item.note}</span>}
                  </>
                )}
              </div>
              <div className="mono" style={{ fontSize: '13px', color: item.kind === 'class' ? '#A84E3C' : '#6B7B3F' }}>
                {item.kind === 'class' ? `−$${CLASS_TYPES[item.type].price}` : `+$${item.amount}`}
              </div>
              <button
                onClick={() => item.kind === 'class' ? onDeleteClass(item.id) : onDeletePayment(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A8A29E', padding: '4px', display: 'flex' }}
                aria-label="Delete">
                <Trash2 size={12} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '18px', marginTop: '18px', borderTop: '1px solid #E7E0D3' }}>
        <button onClick={onDeleteStudent}
          className="mono" style={{ background: 'none', border: 'none', color: '#A84E3C', fontSize: '11px', letterSpacing: '0.06em', cursor: 'pointer', padding: 0, fontFamily: "'Geist Mono', monospace" }}>
          remove from roster
        </button>
        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
      </div>
    </ModalShell>
  );
}
