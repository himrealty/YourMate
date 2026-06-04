import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

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

// ── INIT / MIGRATE TABLES ─────────────────────────────────────
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
      parent_name TEXT,
      parent_contact TEXT,
      whatsapp_number TEXT,
      address TEXT,
      date_of_birth TEXT,
      gender TEXT,
      class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
      enrollment_date TIMESTAMPTZ DEFAULT NOW(),
      total_fees INTEGER DEFAULT 0,
      paid_amount INTEGER DEFAULT 0,
      notes TEXT
    )`;
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name TEXT`;
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_number TEXT`;
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT`;
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth TEXT`;
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT`;
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS notes TEXT`;
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
  let rows;
  if (data.studentId) {
    rows = await sql`
      SELECT s.*, c.name AS class_name FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.id = ${data.studentId}`;
  } else {
    rows = await sql`
      SELECT s.*, c.name AS class_name FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      ORDER BY s.enrollment_date DESC`;
  }

  let students = rows.map(r => ({
    id: r.id,
    name: r.name,
    parentName: r.parent_name || '',
    parentContact: r.parent_contact || '',
    whatsappNumber: r.whatsapp_number || r.parent_contact || '',
    address: r.address || '',
    dateOfBirth: r.date_of_birth || '',
    gender: r.gender || '',
    classId: r.class_id,
    className: r.class_name || 'Unknown',
    enrollmentDate: r.enrollment_date,
    totalFees: r.total_fees || 0,
    paidAmount: r.paid_amount || 0,
    notes: r.notes || ''
  }));

  if (data.classId) students = students.filter(s => s.classId === data.classId);
  if (data.search) students = students.filter(s =>
    s.name.toLowerCase().includes(data.search.toLowerCase()) ||
    (s.parentContact || '').includes(data.search) ||
    (s.whatsappNumber || '').includes(data.search)
  );
  return students;
}

async function addStudent(data) {
  const id = generateId('STU');
  await sql`INSERT INTO students 
    (id, name, parent_name, parent_contact, whatsapp_number, address, date_of_birth, gender, class_id, total_fees, paid_amount, notes)
    VALUES (
      ${id}, ${data.name}, ${data.parentName||null}, ${data.parentContact||null},
      ${data.whatsappNumber||data.parentContact||null}, ${data.address||null},
      ${data.dateOfBirth||null}, ${data.gender||null}, ${data.classId},
      ${data.totalFees||0}, 0, ${data.notes||null}
    )`;
  return { message: 'Student added', id };
}

async function updateStudent(data) {
  await sql`UPDATE students SET
    name=${data.name},
    parent_name=${data.parentName||null},
    parent_contact=${data.parentContact||null},
    whatsapp_number=${data.whatsappNumber||data.parentContact||null},
    address=${data.address||null},
    date_of_birth=${data.dateOfBirth||null},
    gender=${data.gender||null},
    class_id=${data.classId},
    total_fees=${data.totalFees||0},
    notes=${data.notes||null}
    WHERE id=${data.id}`;
  return { message: 'Student updated' };
}

async function updateStudentFees(data) {
  await sql`UPDATE students SET total_fees=${data.totalFees} WHERE id=${data.id}`;
  return { message: 'Fees updated' };
}

async function deleteStudent(data) {
  await sql`DELETE FROM students WHERE id=${data.id}`;
  return { message: 'Student deleted' };
}

// ── FEES ──────────────────────────────────────────────────────
async function getFees(data) {
  let rows;
  if (data.studentId && data.month)
    rows = await sql`SELECT * FROM fees WHERE student_id=${data.studentId} AND month=${data.month} ORDER BY payment_date DESC`;
  else if (data.studentId)
    rows = await sql`SELECT * FROM fees WHERE student_id=${data.studentId} ORDER BY payment_date DESC`;
  else if (data.month)
    rows = await sql`SELECT * FROM fees WHERE month=${data.month} ORDER BY payment_date DESC`;
  else
    rows = await sql`SELECT * FROM fees ORDER BY payment_date DESC`;

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
  if (data.studentId)
    rows = await sql`SELECT * FROM attendance WHERE student_id=${data.studentId} ORDER BY date DESC`;
  else if (data.classId && data.date)
    rows = await sql`SELECT * FROM attendance WHERE class_id=${data.classId} AND date=${data.date}`;
  else if (data.classId)
    rows = await sql`SELECT * FROM attendance WHERE class_id=${data.classId} ORDER BY date DESC`;
  else if (data.date)
    rows = await sql`SELECT * FROM attendance WHERE date=${data.date}`;
  else
    rows = await sql`SELECT * FROM attendance ORDER BY date DESC LIMIT 500`;

  return rows.map(r => ({ id: r.id, studentId: r.student_id, classId: r.class_id, date: r.date, status: r.status }));
}

async function markAttendance(data) {
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
  if (!process.env.DATABASE_URL) return err('DATABASE_URL not set');

  try {
    const body = await req.json();
    const { action, ...data } = body;
    let result;

    switch (action) {
      case 'initTables':         result = await initTables(); break;
      case 'getClasses':         result = await getClasses(); break;
      case 'addClass':           result = await addClass(data); break;
      case 'updateClass':        result = await updateClass(data); break;
      case 'deleteClass':        result = await deleteClass(data); break;
      case 'getStudents':        result = await getStudents(data); break;
      case 'addStudent':         result = await addStudent(data); break;
      case 'updateStudent':      result = await updateStudent(data); break;
      case 'updateStudentFees':  result = await updateStudentFees(data); break;
      case 'deleteStudent':      result = await deleteStudent(data); break;
      case 'getFees':            result = await getFees(data); break;
      case 'recordPayment':      result = await recordPayment(data); break;
      case 'getFeeSummary':      result = await getFeeSummary(); break;
      case 'getAttendance':      result = await getAttendance(data); break;
      case 'markAttendance':     result = await markAttendance(data); break;
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
