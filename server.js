const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Routes
app.get('/', (req, res) => {
    const stats = db.getStats();
    res.render('index', { stats });
});

// Students
app.get('/students', (req, res) => {
    const students = db.getStudents();
    res.render('students', { students });
});

app.post('/students', (req, res) => {
    db.addStudent(req.body);
    res.redirect('/students');
});

// Attendance
app.get('/attendance', (req, res) => {
    const students = db.getStudents();
    const records = db.getAttendance();
    res.render('attendance', { students, records });
});

app.post('/attendance', (req, res) => {
    db.addAttendance(req.body);
    res.redirect('/attendance');
});

// Fees
app.get('/fees', (req, res) => {
    const fees = db.getFees();
    res.render('fees', { fees });
});

app.post('/fees', (req, res) => {
    db.addFee(req.body);
    res.redirect('/fees');
});

// Reminders
app.get('/reminders', (req, res) => {
    const reminders = db.getReminders();
    res.render('reminders', { reminders });
});

app.post('/reminders', (req, res) => {
    db.addReminder(req.body);
    res.redirect('/reminders');
});

// Homework
app.get('/homework', (req, res) => {
    const homeworks = db.getHomework();
    res.render('homework', { homeworks });
});

app.post('/homework', (req, res) => {
    db.addHomework(req.body);
    res.redirect('/homework');
});

// Reports
app.get('/reports', (req, res) => {
    const reports = db.getReports();
    res.render('reports', { reports });
});

app.listen(PORT, () => {
    console.log(`YourMate running at http://localhost:${PORT}`);
});