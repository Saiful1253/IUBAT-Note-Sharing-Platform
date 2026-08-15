const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'accounts.json');

app.use(cors());
app.use(express.json());

function ensureDataFile() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
    }
}

function readAccounts() {
    ensureDataFile();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

function writeAccounts(accounts) {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(accounts, null, 2));
}

function sendError(res, statusCode, message) {
    res.status(statusCode).json({ success: false, message });
}

app.get('/api/users', (req, res) => {
    try {
        const accounts = readAccounts();
        const { search, department, status, conduct, page = 1, limit = 10 } = req.query;

        let filtered = accounts.map(acc => ({
            id: acc.studentId || acc.id,
            name: acc.fullname || 'Unknown User',
            email: acc.email || '',
            department: acc.department || 'N/A',
            status: acc.status || 'active',
            accountType: acc.accountType || 'student',
            conduct: acc.conduct || 'clean',
            conductNote: acc.conductNote || '',
            warnings: acc.warnings || 0,
            isSystem: acc.isSystem || false,
            createdAt: acc.createdAt,
            lastDiscipline: acc.lastDiscipline,
            disciplineHistory: acc.disciplineHistory || []
        }));

        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(u =>
                u.name.toLowerCase().includes(searchLower) ||
                u.id.toLowerCase().includes(searchLower) ||
                u.department.toLowerCase().includes(searchLower) ||
                u.email.toLowerCase().includes(searchLower) ||
                u.accountType.toLowerCase().includes(searchLower) ||
                (u.conductNote && u.conductNote.toLowerCase().includes(searchLower))
            );
        }

        if (department) {
            filtered = filtered.filter(u => u.department === department);
        }

        if (status) {
            filtered = filtered.filter(u => u.status === status);
        }

        if (conduct) {
            filtered = filtered.filter(u => u.conduct === conduct);
        }

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.max(1, parseInt(limit));
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / limitNum));
        const start = (pageNum - 1) * limitNum;
        const paginated = filtered.slice(start, start + limitNum);

        res.json({
            success: true,
            data: paginated,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages
            }
        });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch users');
    }
});

app.get('/api/users/:id', (req, res) => {
    try {
        const accounts = readAccounts();
        const user = accounts.find(a => (a.studentId || a.id) === req.params.id);

        if (!user) {
            return sendError(res, 404, 'User not found');
        }

        res.json({
            success: true,
            data: {
                id: user.studentId || user.id,
                name: user.fullname || 'Unknown User',
                email: user.email || '',
                department: user.department || 'N/A',
                status: user.status || 'active',
                accountType: user.accountType || 'student',
                conduct: user.conduct || 'clean',
                conductNote: user.conductNote || '',
                warnings: user.warnings || 0,
                isSystem: user.isSystem || false,
                createdAt: user.createdAt,
                lastDiscipline: user.lastDiscipline,
                disciplineHistory: user.disciplineHistory || []
            }
        });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch user');
    }
});

app.post('/api/users', (req, res) => {
    try {
        const accounts = readAccounts();
        const { fullname, studentId, department, email, accountType = 'student' } = req.body;

        if (!fullname || !studentId || !department) {
            return sendError(res, 400, 'Name, ID, and department are required');
        }

        if (accounts.find(a => (a.studentId || a.id) === studentId)) {
            return sendError(res, 409, 'A user with this ID already exists');
        }

        const newUser = {
            fullname: fullname.trim(),
            studentId: studentId.trim(),
            department: department.trim(),
            email: email ? email.trim() : '',
            accountType: accountType.toLowerCase(),
            status: 'active',
            conduct: 'clean',
            conductNote: '',
            warnings: 0,
            isSystem: false,
            createdAt: new Date().toISOString()
        };

        accounts.push(newUser);
        writeAccounts(accounts);

        res.status(201).json({
            success: true,
            message: 'User added successfully',
            data: newUser
        });
    } catch (error) {
        sendError(res, 500, 'Failed to create user');
    }
});

app.put('/api/users/:id/status', (req, res) => {
    try {
        const accounts = readAccounts();
        const idx = accounts.findIndex(a => (a.studentId || a.id) === req.params.id);

        if (idx < 0) {
            return sendError(res, 404, 'User not found');
        }

        const { status } = req.body;
        if (!status || !['active', 'suspended'].includes(status)) {
            return sendError(res, 400, 'Valid status (active or suspended) is required');
        }

        accounts[idx].status = status;
        writeAccounts(accounts);

        res.json({
            success: true,
            message: 'User status updated',
            data: {
                id: accounts[idx].studentId || accounts[idx].id,
                status: accounts[idx].status
            }
        });
    } catch (error) {
        sendError(res, 500, 'Failed to update user status');
    }
});

app.put('/api/users/:id/conduct', (req, res) => {
    try {
        const accounts = readAccounts();
        const idx = accounts.findIndex(a => (a.studentId || a.id) === req.params.id);

        if (idx < 0) {
            return sendError(res, 404, 'User not found');
        }

        const { action, reason, remarks, caseId, admin } = req.body;

        if (!action || !reason) {
            return sendError(res, 400, 'Action and reason are required');
        }

        if (!accounts[idx].disciplineHistory) {
            accounts[idx].disciplineHistory = [];
        }

        const timestamp = new Date().toISOString();

        accounts[idx].disciplineHistory.push({
            caseId: caseId || 'DISC-' + Date.now().toString().slice(-8),
            action,
            reason,
            remarks: remarks || '',
            emailNotify: true,
            timestamp,
            admin: admin || 'Admin'
        });

        accounts[idx].conductNote = reason;
        accounts[idx].warnings = (accounts[idx].warnings || 0) + 1;
        accounts[idx].lastDiscipline = timestamp;

        if (action === '7-day-suspension') {
            const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            accounts[idx].status = 'suspended';
            accounts[idx].suspendedUntil = until;
            accounts[idx].conduct = 'suspended';
        } else if (action === 'permanent-ban') {
            accounts[idx].status = 'suspended';
            accounts[idx].conduct = 'suspended';
            accounts[idx].permanentBan = true;
        } else if (action === 'dismiss-flag') {
            accounts[idx].conduct = 'clean';
            accounts[idx].conductNote = '';
            accounts[idx].warnings = Math.max(0, (accounts[idx].warnings || 0) - 1);
        } else {
            accounts[idx].conduct = 'flagged';
        }

        writeAccounts(accounts);

        res.json({
            success: true,
            message: 'Disciplinary action recorded',
            data: {
                id: accounts[idx].studentId || accounts[idx].id,
                conduct: accounts[idx].conduct,
                warnings: accounts[idx].warnings,
                status: accounts[idx].status,
                lastDiscipline: accounts[idx].lastDiscipline
            }
        });
    } catch (error) {
        sendError(res, 500, 'Failed to apply disciplinary action');
    }
});

app.delete('/api/users/:id', (req, res) => {
    try {
        const accounts = readAccounts();
        const idx = accounts.findIndex(a => (a.studentId || a.id) === req.params.id);

        if (idx < 0) {
            return sendError(res, 404, 'User not found');
        }

        const deletedUser = accounts.splice(idx, 1)[0];
        writeAccounts(accounts);

        res.json({
            success: true,
            message: 'User deleted successfully',
            data: deletedUser
        });
    } catch (error) {
        sendError(res, 500, 'Failed to delete user');
    }
});

app.get('/api/users/stats/summary', (req, res) => {
    try {
        const accounts = readAccounts();
        const total = accounts.length;
        const active = accounts.filter(u => u.status === 'active').length;
        const suspended = accounts.filter(u => u.status === 'suspended' || u.conduct === 'suspended').length;
        const flagged = accounts.filter(u => u.conduct === 'flagged').length;
        const clean = accounts.filter(u => u.conduct === 'clean').length;

        res.json({
            success: true,
            data: {
                total,
                active,
                suspended,
                flagged,
                clean,
                departments: [...new Set(accounts.map(u => u.department).filter(Boolean))]
            }
        });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch statistics');
    }
});

app.listen(PORT, () => {
    console.log(`User Management API running on http://localhost:${PORT}`);
});

module.exports = app;