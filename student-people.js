const STORAGE_KEY = 'ishare_announcements';
const NOTES_KEY = 'ishare_notes';
const DEPT_KEY = 'ishare_departments';
const NOTIF_KEY = 'ishare_notifications';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getAnnouncements() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function getNotes() {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); } catch { return []; }
}

function getDepartments() {
    try { return JSON.parse(localStorage.getItem(DEPT_KEY) || '[]'); } catch { return []; }
}

function showToast(message, type) {
    type = type || 'success';
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() { toast.classList.remove('show'); }, 3500);
}

function getNotifications() {
    try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch { return []; }
}

function saveNotifications(notifications) {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications));
}

function getUserDownloads() {
    try { return parseInt(localStorage.getItem('ishare_user_downloads') || '0', 10); } catch { return 0; }
}

function getUserNotes() {
    const notes = getNotes();
    const userId = localStorage.getItem('ishare_user_id');
    return notes.filter(function(n) { return n.authorId === userId; });
}

function updateBadge() {
    const notifications = getNotifications();
    const unreadCount = notifications.filter(n => !n.read).length;
    const badge = document.getElementById('notificationBadge');
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

function renderNotifications() {
    const notifications = getNotifications();
    const listEl = document.getElementById('notificationList');
    if (notifications.length === 0) {
        listEl.innerHTML = '<div class="notification-empty">No notifications yet.</div>';
        return;
    }
    const iconMap = { system: '&#9881;', user: '&#128100;', alert: '&#9888;', info: '&#8505;' };
    listEl.innerHTML = notifications.slice(0, 20).map(n => {
        return '<div class="notification-item ' + (n.read ? '' : 'unread') + '" data-id="' + n.id + '">' +
            '<div class="notification-icon ' + (n.type || 'system') + '">' + (iconMap[n.type] || '&#128276;') + '</div>' +
            '<div class="notification-body">' +
                '<div class="notification-title">' + escapeHtml(n.title) + '</div>' +
                '<div class="notification-message">' + escapeHtml(n.message) + '</div>' +
                '<div class="notification-time">' + formatTime(n.time) + '</div>' +
            '</div>' +
            '<button class="notification-delete" data-id="' + n.id + '" title="Delete notification">' +
                '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>' +
        '</div>';
    }).join('');

    listEl.querySelectorAll('.notification-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            if (e.target.closest('.notification-delete')) return;
            const id = this.getAttribute('data-id');
            const notifs = getNotifications();
            const target = notifs.find(n => n.id === id);
            if (target && !target.read) {
                target.read = true;
                saveNotifications(notifs);
                updateBadge();
                this.classList.remove('unread');
            }
        });
    });

    listEl.querySelectorAll('.notification-delete').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            const notifs = getNotifications().filter(n => n.id !== id);
            saveNotifications(notifs);
            updateBadge();
            renderNotifications();
        });
    });
}

function ensureNotifications() {
    const currentUserId = localStorage.getItem('ishare_user_id');
    const currentUserDept = localStorage.getItem('ishare_user_department');
    const notes = getNotes();
    const announcements = getAnnouncements();
    const existingNotifications = getNotifications();
    const notifications = [];
    const now = Date.now();

    const existingMap = {};
    existingNotifications.forEach(function(n) {
        existingMap[n.id] = n;
    });

    announcements.forEach(function(a) {
        const id = 'announcement-' + a.id;
        const existing = existingMap[id];
        notifications.push({
            id: id,
            title: a.title || 'New Announcement',
            message: a.body || '',
            type: 'info',
            time: a.createdAt || now,
            read: existing ? existing.read : false
        });
    });

    notes.forEach(function(note) {
        if (note.authorId !== currentUserId && note.department === currentUserDept) {
            const id = 'note-' + note.id;
            const existing = existingMap[id];
            notifications.push({
                id: id,
                title: 'New note: ' + (note.title || 'Untitled'),
                message: note.author + ' posted a note in ' + (note.courseCode || 'General'),
                type: 'user',
                time: note.createdAt || now,
                read: existing ? existing.read : false
            });
        }
    });

    notifications.sort(function(a, b) { return b.time - a.time; });
    saveNotifications(notifications);
    return notifications;
}

let allPeople = [];
let filteredPeople = [];
let currentPage = 1;
const pageSize = 6;

function getAccounts() {
    try { return JSON.parse(localStorage.getItem('ishare_accounts') || '[]'); } catch { return []; }
}

function getInitials(name) {
    return (name || 'U').split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
}

function renderPeople(people) {
    const grid = document.getElementById('peopleGrid');
    if (!grid) return;
    const start = (currentPage - 1) * pageSize;
    const pageItems = people.slice(start, start + pageSize);

    if (pageItems.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><div class="empty-state-title">No people found</div><div class="empty-state-desc">Try adjusting your search or filters.</div></div>';
        document.getElementById('peoplePagination').style.display = 'none';
        return;
    }

    document.getElementById('peoplePagination').style.display = 'flex';
    grid.innerHTML = pageItems.map(function(p, index) {
        const roleClass = (p.accountType || 'student').toLowerCase();
        const roleLabel = roleClass.charAt(0).toUpperCase() + roleClass.slice(1);
        const initials = getInitials(p.fullname);
        const desc = p.research || p.skills || p.bio || '';
        const cardId = 'peopleCard_' + (currentPage - 1) * pageSize + '_' + index;
        return '<div class="people-card" data-student-id="' + escapeHtml(p.studentId || '') + '" data-fullname="' + escapeHtml(p.fullname || '') + '" data-department="' + escapeHtml(p.department || '') + '" data-account-type="' + escapeHtml(p.accountType || '') + '" data-email="' + escapeHtml(p.email || '') + '" data-research="' + escapeHtml(p.research || '') + '" data-skills="' + escapeHtml(p.skills || '') + '" data-bio="' + escapeHtml(p.bio || '') + '">' +
            '<div class="people-avatar-placeholder">' + initials + '</div>' +
            '<div class="people-info">' +
                '<div class="people-header">' +
                    '<div class="people-name">' + escapeHtml(p.fullname || 'Unknown') + '</div>' +
                    '<span class="people-role ' + escapeHtml(roleClass) + '">' + escapeHtml(roleLabel) + '</span>' +
                '</div>' +
                '<div class="people-meta">' + escapeHtml(p.department || 'N/A') + (p.accountType ? ' · ' + escapeHtml(p.accountType) : '') + '</div>' +
                (desc ? '<div class="people-desc">' + escapeHtml(desc) + '</div>' : '') +
                '<div class="people-actions">' +
                    '<button class="people-link people-view-profile-btn" type="button" data-student-id="' + escapeHtml(p.studentId || '') + '">View Profile</button>' +
                    '<button class="people-msg" type="button" title="Message">' +
                        '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');

    grid.querySelectorAll('.people-view-profile-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const card = this.closest('.people-card');
            if (!card) return;
            openProfileModal({
                studentId: card.getAttribute('data-student-id') || '',
                fullname: card.getAttribute('data-fullname') || 'Student',
                department: card.getAttribute('data-department') || '',
                accountType: card.getAttribute('data-account-type') || 'Student',
                email: card.getAttribute('data-email') || '',
                research: card.getAttribute('data-research') || '',
                skills: card.getAttribute('data-skills') || '',
                bio: card.getAttribute('data-bio') || ''
            });
        });
    });

    grid.querySelectorAll('.people-msg').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const card = this.closest('.people-card');
            if (!card) return;
            const studentId = card.getAttribute('data-student-id') || '';
            const fullname = card.getAttribute('data-fullname') || '';
            if (studentId) {
                localStorage.setItem('ishare_open_chat_with', studentId);
                localStorage.setItem('ishare_open_chat_name', fullname);
                window.location.href = 'student-messaging.html';
            }
        });
    });

    renderPagination(people.length);
}

function renderPagination(total) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const container = document.getElementById('peoplePagination');
    container.innerHTML = '';

    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.type = 'button';
    prev.innerHTML = '&lt;';
    prev.disabled = currentPage === 1;
    prev.addEventListener('click', function() {
        if (currentPage > 1) { currentPage--; applyFilters(); }
    });
    container.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
        if (totalPages > 7 && i > 3 && i < totalPages - 2 && Math.abs(i - currentPage) > 1) {
            if (i === 4 || i === totalPages - 3) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                container.appendChild(ellipsis);
            }
            continue;
        }
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
        btn.type = 'button';
        btn.textContent = i;
        btn.addEventListener('click', function() {
            currentPage = i;
            applyFilters();
        });
        container.appendChild(btn);
    }

    const next = document.createElement('button');
    next.className = 'page-btn';
    next.type = 'button';
    next.innerHTML = '&gt;';
    next.disabled = currentPage === totalPages;
    next.addEventListener('click', function() {
        if (currentPage < totalPages) { currentPage++; applyFilters(); }
    });
    container.appendChild(next);
}

function applyFilters() {
    const query = (document.getElementById('peopleSearch').value || '').toLowerCase();
    const currentUserDept = localStorage.getItem('ishare_user_department') || '';

    filteredPeople = allPeople.filter(function(p) {
        const isStudent = (p.accountType || '').toLowerCase() === 'student';
        const sameDept = !currentUserDept || (p.department || '').toLowerCase() === currentUserDept.toLowerCase();
        const matchQuery = !query ||
            (p.fullname || '').toLowerCase().indexOf(query) !== -1 ||
            (p.department || '').toLowerCase().indexOf(query) !== -1 ||
            (p.research || '').toLowerCase().indexOf(query) !== -1 ||
            (p.skills || '').toLowerCase().indexOf(query) !== -1;
        return isStudent && sameDept && matchQuery;
    });

    currentPage = 1;
    renderPeople(filteredPeople);
}

function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.remove('show');
}

function openProfileModal(person) {
    const modal = document.getElementById('profileModal');
    if (!modal) return;

    const currentUserName = localStorage.getItem('ishare_user_name') || 'Student';
    const currentUserDept = localStorage.getItem('ishare_user_department') || '';
    const currentUserId = localStorage.getItem('ishare_user_id') || '';
    const currentUserType = localStorage.getItem('ishare_user_type') || 'Student';

    const target = person || {};
    const userName = target.fullname || currentUserName;
    const userDept = target.department || currentUserDept;
    const userId = target.studentId || currentUserId;
    const userType = target.accountType || currentUserType;
    const userEmail = target.email || '';

    const accounts = JSON.parse(localStorage.getItem('ishare_accounts') || '[]');
    const account = accounts.find(function(a) { return a.studentId === userId; });
    const emailFromAccount = account ? account.email : '';
    const finalEmail = userEmail || emailFromAccount;

    const initials = getInitials(userName);

    const avatarEl = document.getElementById('profileModalAvatar');
    if (avatarEl) avatarEl.textContent = initials || 'S';

    const nameEl = document.getElementById('profileModalName');
    if (nameEl) nameEl.textContent = userName;

    const deptEl = document.getElementById('profileModalDept');
    if (deptEl) deptEl.textContent = (userDept || 'Student').slice(0, 30);

    const studentIdEl = document.getElementById('profileModalStudentId');
    if (studentIdEl) studentIdEl.textContent = userId || '-';

    const deptDetailEl = document.getElementById('profileModalDeptDetail');
    if (deptDetailEl) deptDetailEl.textContent = userDept || '-';

    const typeEl = document.getElementById('profileModalType');
    if (typeEl) typeEl.textContent = userType || '-';

    const emailEl = document.getElementById('profileModalEmail');
    if (emailEl) emailEl.textContent = finalEmail || '-';

    const notesEl = document.getElementById('profileModalNotes');
    if (notesEl) {
        const allNotes = getNotes();
        const targetNotes = allNotes.filter(function(n) { return n.authorId === userId; });
        notesEl.textContent = targetNotes.length;
    }

    const downloadsEl = document.getElementById('profileModalDownloads');
    if (downloadsEl) {
        const allNotes = getNotes();
        const targetNotes = allNotes.filter(function(n) { return n.authorId === userId; });
        const totalDownloads = targetNotes.reduce(function(sum, n) { return sum + (n.downloads || 0); }, 0);
        downloadsEl.textContent = totalDownloads;
    }

    modal.classList.add('show');
}

document.addEventListener('DOMContentLoaded', function() {
    const userId = localStorage.getItem('ishare_user_id');
    const userName = localStorage.getItem('ishare_user_name');
    const userType = localStorage.getItem('ishare_user_type');
    const userDept = localStorage.getItem('ishare_user_department');

    if (!userId || userType !== 'Student') {
        window.location.href = 'index.html';
        return;
    }

    if (userName) {
        const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const avatar = document.getElementById('studentAvatar');
        if (avatar) avatar.textContent = initials || 'S';
        const sidebarAvatar = document.getElementById('sidebarAvatar');
        if (sidebarAvatar) sidebarAvatar.textContent = initials || 'S';
        const sidebarName = document.getElementById('sidebarName');
        if (sidebarName) sidebarName.textContent = userName;
        const sidebarDept = document.getElementById('sidebarDept');
        if (sidebarDept) sidebarDept.textContent = (userDept || 'Student').slice(0, 25) + (userDept && userDept.length > 25 ? '..' : '');

        const deptNameEl = document.getElementById('deptName');
        if (deptNameEl) deptNameEl.textContent = userDept || 'Department';
    }

    const notificationWrapper = document.getElementById('notificationWrapper');
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const markAllReadBtn = document.getElementById('markAllRead');
    const deleteAllBtn = document.getElementById('deleteAllNotifications');

    if (notificationBtn) {
        notificationBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const isShown = notificationDropdown.classList.contains('show');
            if (isShown) {
                notificationDropdown.classList.remove('show');
            } else {
                renderNotifications();
                notificationDropdown.classList.add('show');
            }
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const notifs = getNotifications();
            let changed = false;
            notifs.forEach(n => { if (!n.read) { n.read = true; changed = true; } });
            if (changed) {
                saveNotifications(notifs);
                updateBadge();
                renderNotifications();
            }
        });
    }

    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm('Delete all notifications? This cannot be undone.')) {
                saveNotifications([]);
                updateBadge();
                renderNotifications();
            }
        });
    }

    document.addEventListener('click', function(e) {
        if (notificationWrapper && !notificationWrapper.contains(e.target)) {
            notificationDropdown.classList.remove('show');
        }
    });

    const closeProfileModalBtn = document.getElementById('closeProfileModal');
    if (closeProfileModalBtn) {
        closeProfileModalBtn.addEventListener('click', closeProfileModal);
    }

    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        profileModal.addEventListener('click', function(e) {
            if (e.target === profileModal) closeProfileModal();
        });
    }

    const studentAvatar = document.getElementById('studentAvatar');
    if (studentAvatar) {
        studentAvatar.addEventListener('click', function(e) {
            e.stopPropagation();
            openProfileModal();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeProfileModal();
    });

    const searchInput = document.getElementById('peopleSearch');

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            currentPage = 1;
            applyFilters();
        });
    }

    allPeople = getAccounts();
    applyFilters();

    ensureNotifications();
    updateBadge();

    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm('Are you sure you want to log out?')) {
                localStorage.removeItem('ishare_user_id');
                localStorage.removeItem('ishare_user_password');
                localStorage.removeItem('ishare_user_type');
                localStorage.removeItem('ishare_user_name');
                localStorage.removeItem('ishare_user_department');
                localStorage.removeItem('ishare_user_email');
                localStorage.removeItem('ishare_user_downloads');
                window.location.href = 'index.html';
            }
        });
    }
});
