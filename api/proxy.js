import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

// ── CORS headers ──────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function ok(data) {
  return new Response(JSON.stringify({ status: 'success', data }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

function err(msg, code = 500) {
  return new Response(JSON.stringify({ status: 'error', message: msg }), {
    status: code, headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

// ── INIT TABLES (run once) ────────────────────────────────────
async function initTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT,
      teacher TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
      parent_contact TEXT,
      enrollment_date TIMESTAMPTZ DEFAULT NOW(),
      total_fees INTEGER DEFAULT 0,
      paid_amount INTEGER DEFAULT 0
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS fees (
      id TEXT PRIMARY KEY,
      student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
      month TEXT,
      amount_paid INTEGER,
      payment_date TIMESTAMPTZ DEFAULT NOW(),
      status TEXT DEFAULT 'Paid'
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
      class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
      date TEXT,
      status TEXT
    )`;
  return { message: 'Tables ready' };
}

// ── CLASSES ───────────────────────────────────────────────────
async function getClasses() {
  const rows = await sql`SELECT * FROM classes ORDER BY created_at DESC`;
  return rows.map(r => ({
    id: r.id, name: r.name, subject: r.subject,
    teacher: r.teacher, createdAt: r.created_at
  }));
}

async function addClass(data) {
  const id = generateId('CLS');
  await sql`INSERT INTO classes (id, name, subject, teacher) VALUES (${id}, ${data.name}, ${data.subject}, ${data.teacher})`;
  return { message: 'Class added', id };
}

async function updateClass(data) {
  await sql`UPDATE classes SET name=${data.name}, subject=${data.subject}, teacher=${data.teacher} WHERE id=${data.id}`;
  return { message: 'Class updated' };
}

async function deleteClass(data) {
  await sql`DELETE FROM classes WHERE id=${data.id}`;
  return { message: 'Class deleted' };
}

// ── STUDENTS ──────────────────────────────────────────────────
async function getStudents(data) {
  let rows = await sql`
    SELECT s.*, c.name AS class_name
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    ORDER BY s.enrollment_date DESC`;

  let students = rows.map(r => ({
    id: r.id, name: r.name, classId: r.class_id,
    className: r.class_name || 'Unknown',
    parentContact: r.parent_contact,
    enrollmentDate: r.enrollment_date,
    totalFees: r.total_fees || 0,
    paidAmount: r.paid_amount || 0
  }));

  if (data.classId) students = students.filter(s => s.classId === data.classId);
  if (data.search) students = students.filter(s => s.name.toLowerCase().includes(data.search.toLowerCase()));
  return students;
}

async function addStudent(data) {
  const id = generateId('STU');
  await sql`INSERT INTO students (id, name, class_id, parent_contact, total_fees, paid_amount)
    VALUES (${id}, ${data.name}, ${data.classId}, ${data.parentContact}, ${data.totalFees || 0}, 0)`;
  return { message: 'Student added', id };
}

async function updateStudent(data) {
  await sql`UPDATE students SET name=${data.name}, class_id=${data.classId}, parent_contact=${data.parentContact}, total_fees=${data.totalFees} WHERE id=${data.id}`;
  return { message: 'Student updated' };
}

async function deleteStudent(data) {
  await sql`DELETE FROM students WHERE id=${data.id}`;
  return { message: 'Student deleted' };
}

// ── FEES ──────────────────────────────────────────────────────
async function getFees(data) {
  let rows = data.month
    ? await sql`SELECT * FROM fees WHERE month=${data.month} ORDER BY payment_date DESC`
    : await sql`SELECT * FROM fees ORDER BY payment_date DESC`;

  return rows.map(r => ({
    id: r.id, studentId: r.student_id, month: r.month,
    amountPaid: r.amount_paid, paymentDate: r.payment_date, status: r.status
  }));
}

async function recordPayment(data) {
  const id = generateId('FEE');
  await sql`INSERT INTO fees (id, student_id, month, amount_paid, status)
    VALUES (${id}, ${data.studentId}, ${data.month}, ${data.amount}, 'Paid')`;
  await sql`UPDATE students SET paid_amount = paid_amount + ${data.amount} WHERE id=${data.studentId}`;
  return { message: 'Payment recorded', id };
}

async function getFeeSummary() {
  const rows = await sql`SELECT SUM(total_fees) AS total, SUM(paid_amount) AS paid FROM students`;
  const total = parseInt(rows[0].total) || 0;
  const paid = parseInt(rows[0].paid) || 0;
  return {
    totalCollected: paid,
    totalPending: total - paid,
    collectionRate: total > 0 ? Math.round((paid / total) * 100) : 0
  };
}

// ── ATTENDANCE ────────────────────────────────────────────────
async function getAttendance(data) {
  let rows;
  if (data.classId && data.date)
    rows = await sql`SELECT * FROM attendance WHERE class_id=${data.classId} AND date=${data.date}`;
  else if (data.classId)
    rows = await sql`SELECT * FROM attendance WHERE class_id=${data.classId}`;
  else if (data.date)
    rows = await sql`SELECT * FROM attendance WHERE date=${data.date}`;
  else
    rows = await sql`SELECT * FROM attendance ORDER BY date DESC LIMIT 500`;

  return rows.map(r => ({ id: r.id, studentId: r.student_id, classId: r.class_id, date: r.date, status: r.status }));
}

async function markAttendance(data) {
  // Upsert: update if exists for same student+date, insert otherwise
  const existing = await sql`SELECT id FROM attendance WHERE student_id=${data.studentId} AND date=${data.date}`;
  if (existing.length > 0) {
    await sql`UPDATE attendance SET status=${data.status} WHERE student_id=${data.studentId} AND date=${data.date}`;
    return { message: 'Attendance updated', id: existing[0].id };
  }
  const id = generateId('ATT');
  await sql`INSERT INTO attendance (id, student_id, class_id, date, status)
    VALUES (${id}, ${data.studentId}, ${data.classId}, ${data.date}, ${data.status})`;
  return { message: 'Attendance marked', id };
}

async function getAttendanceStats() {
  const today = new Date().toISOString().split('T')[0];
  const rows = await sql`SELECT status, COUNT(*) AS count FROM attendance WHERE date=${today} GROUP BY status`;
  let present = 0, total = 0;
  rows.forEach(r => { total += parseInt(r.count); if (r.status === 'Present') present = parseInt(r.count); });
  const allRows = await sql`SELECT COUNT(*) AS count FROM attendance`;
  return {
    todayPercentage: total > 0 ? Math.round((present / total) * 100) : 0,
    totalRecords: parseInt(allRows[0].count)
  };
}

// ── MAIN HANDLER ──────────────────────────────────────────────
export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers: CORS });

  if (req.method !== 'POST') return err('Method not allowed', 405);

  if (!process.env.DATABASE_URL) return err('DATABASE_URL not set in Vercel environment variables');

  try {
    const body = await req.json();
    const { action, ...data } = body;

    let result;
    switch (action) {
      case 'initTables':       result = await initTables(); break;
      case 'getClasses':       result = await getClasses(); break;
      case 'addClass':         result = await addClass(data); break;
      case 'updateClass':      result = await updateClass(data); break;
      case 'deleteClass':      result = await deleteClass(data); break;
      case 'getStudents':      result = await getStudents(data); break;
      case 'addStudent':       result = await addStudent(data); break;
      case 'updateStudent':    result = await updateStudent(data); break;
      case 'deleteStudent':    result = await deleteStudent(data); break;
      case 'getFees':          result = await getFees(data); break;
      case 'recordPayment':    result = await recordPayment(data); break;
      case 'getFeeSummary':    result = await getFeeSummary(); break;
      case 'getAttendance':    result = await getAttendance(data); break;
      case 'markAttendance':   result = await markAttendance(data); break;
      case 'getAttendanceStats': result = await getAttendanceStats(); break;
      default: return err('Unknown action: ' + action, 400);
    }

    return ok(result);
  } catch (e) {
    console.error(e);
    return err(e.message);
  }
}

export const config = { runtime: 'edge' };
