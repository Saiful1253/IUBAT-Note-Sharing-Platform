/* ============================================ */
/* Student Messaging JS - iShare IUBAT            */
/* মেসেজিং: চ্যাট, কনভারসেশন, মেসেজ সেভ, নোটিফ */
/* ============================================ */

/* localStorage কী */
const STORAGE_KEY = 'ishare_announcements';
const NOTES_KEY = 'ishare_notes';
const DEPT_KEY = 'ishare_departments';
const NOTIF_KEY = 'ishare_notifications';
const MESSAGES_KEY = 'ishare_messages';

/* XSS প্রতিরোধ: HTML এস্কেপ */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* টাইম স্ট্যাম্প থেকে রেডেবল টাইম */
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

/* অ্যানাউন্সমেন্ট লোড */
function getAnnouncements() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

/* নোট লোড */
function getNotes() {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); } catch { return []; }
}

/* ডিপার্টমেন্ট লোড */
function getDepartments() {
    try { return JSON.parse(localStorage.getItem(DEPT_KEY) || '[]'); } catch { return []; }
}

/* টোস্ট মেসেজ */
function showToast(message, type) {
    type = type || 'success';
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() { toast.classList.remove('show'); }, 3500);
}

/* নোটিফিকেশন লোড */
function getNotifications() {
    try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch { return []; }
}

/* নোটিফিকেশন সেভ */
function saveNotifications(notifications) {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications));
}

/* নোটিফিকেশন ব্যেজ আপডেট */
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

/* নোটিফিকেশন রেন্ডার */
function renderNotifications() {
    const notifications = getNotifications();
    const listEl = document.getElementById('notificationList');
    if (notifications.length === 0) {
        listEl.innerHTML = '<div class="notification-empty">No notifications yet.</div>';
        return;
    }
    const iconMap = { system: '⚙', user: '👤', alert: '⚠', info: 'ℹ' };
    listEl.innerHTML = notifications.slice(0, 20).map(n => {
        return '<div class="notification-item ' + (n.read ? '' : 'unread') + '" data-id="' + n.id + '">' +
            '<div class="notification-icon ' + (n.type || 'system') + '">' + (iconMap[n.type] || '🔔') + '</div>' +
            '<div class="notification-body">' +
                '<div class="notification-title">' + escapeHtml(n.title) + '</div>' +
                '<div class="notification-message">' + escapeHtml(n.message) + '</div>' +
                '<div class="notification-time">' + formatTime(n.time) + '</div>' +
            '</div>' +
            '<button class="notification-delete" data-id="' + n.id + '" title="Delete notification">' +
                '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4"/></svg>' +
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

/* নোটিফিকেশন এনশ্যুর */
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

/* ==================== মেসেজিং সিস্টেম ==================== */
/* মেসেজ লোড */
function getMessages() {
    try { return JSON.parse(localStorage.getItem(MESSAGES_KEY) || '{}'); } catch { return {}; }
}

/* মেসেজ সেভ */
function saveMessages(messages) {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

/* দুই ইউজারের কনভারসেশন কী জেনারেট */
function getConversationKey(userId1, userId2) {
    const ids = [userId1, userId2].sort();
    return ids[0] + '_' + ids[1];
}

/* কনভারসেশন মেসেজ লোড */
function getConversationMessages(otherUserId) {
    const currentUserId = localStorage.getItem('ishare_user_id');
    const key = getConversationKey(currentUserId, otherUserId);
    const allMessages = getMessages();
    return allMessages[key] || [];
}

/* মেসেজ পাঠানো */
function sendMessageTo(otherUserId, text) {
    const currentUserId = localStorage.getItem('ishare_user_id');
    const key = getConversationKey(currentUserId, otherUserId);
    const allMessages = getMessages();
    if (!allMessages[key]) allMessages[key] = [];
    allMessages[key].push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        senderId: currentUserId,
        text: text,
        time: Date.now()
    });
    saveMessages(allMessages);
    return allMessages[key];
}

/* মেসেজিং কন্ট্যাক্ট লিস্ট রেন্ডার */
function renderMessagingList() {
    const listEl = document.getElementById('messagingList');
    if (!listEl) return;
    const currentUserId = localStorage.getItem('ishare_user_id');
    const currentUserName = localStorage.getItem('ishare_user_name') || '';
    const currentUserDept = localStorage.getItem('ishare_user_department') || '';
    const accounts = JSON.parse(localStorage.getItem('ishare_accounts') || '[]');
    const allMessages = getMessages();
    
    const students = accounts.filter(function(a) {
        const isNotCurrentUser = a.studentId !== currentUserId && a.fullname !== currentUserName;
        const isStudent = (a.accountType || '').toLowerCase() === 'student';
        const sameDept = !currentUserDept || a.department === currentUserDept;
        return isNotCurrentUser && isStudent && sameDept;
    });

    if (students.length === 0) {
        listEl.innerHTML = '<div class="empty-state" style="padding: 20px;"><div class="empty-state-desc">No students found.</div></div>';
        return;
    }

    listEl.innerHTML = students.map(function(s) {
        const key = getConversationKey(currentUserId, s.studentId);
        const msgs = allMessages[key] || [];
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        const preview = lastMsg ? lastMsg.text : 'No messages yet';
        const initials = (s.fullname || 'U').split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
        return '<div class="messaging-contact" data-student-id="' + escapeHtml(s.studentId || '') + '" data-fullname="' + escapeHtml(s.fullname || '') + '">' +
            '<div class="messaging-contact-avatar">' + initials + '</div>' +
            '<div class="messaging-contact-info">' +
                '<div class="messaging-contact-name">' + escapeHtml(s.fullname || 'Unknown') + '</div>' +
                '<div class="messaging-contact-preview">' + escapeHtml(preview) + '</div>' +
            '</div>' +
        '</div>';
    }).join('');

    listEl.querySelectorAll('.messaging-contact').forEach(function(contact) {
        contact.addEventListener('click', function() {
            listEl.querySelectorAll('.messaging-contact').forEach(function(c) { c.classList.remove('active'); });
            this.classList.add('active');
            const studentId = this.getAttribute('data-student-id');
            const fullname = this.getAttribute('data-fullname');
            openChat(studentId, fullname);
        });
    });
}

/* চ্যাট ওপেন */
function openChat(studentId, fullname) {
    const main = document.getElementById('messagingMain');
    if (!main) return;
    const currentUserId = localStorage.getItem('ishare_user_id');
    const initials = (fullname || 'U').split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
    const messages = getConversationMessages(studentId);

    main.innerHTML = '<div class="messaging-chat-header">' +
        '<div class="messaging-contact-avatar">' + initials + '</div>' +
        '<div class="messaging-chat-header-info">' +
            '<div class="messaging-chat-header-name">' + escapeHtml(fullname || 'Student') + '</div>' +
            '<div class="messaging-chat-header-status">Online</div>' +
        '</div>' +
    '</div>' +
    '<div class="messaging-messages" id="messagingMessages"></div>' +
    '<div class="messaging-input-area">' +
        '<input type="text" class="messaging-input" id="messagingInput" placeholder="Type a message...">' +
        '<button class="messaging-send" id="messagingSend">Send</button>' +
    '</div>';

    const messagesContainer = document.getElementById('messagingMessages');
    const sendBtn = document.getElementById('messagingSend');
    const input = document.getElementById('messagingInput');

    messages.forEach(function(msg) {
        const bubble = document.createElement('div');
        bubble.className = 'messaging-bubble ' + (msg.senderId === currentUserId ? 'sent' : 'received');
        bubble.textContent = msg.text;
        messagesContainer.appendChild(bubble);
    });

    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /* মেসেজ পাঠানোর ফাংশন */
    function sendMessage() {
        const text = input.value.trim();
        if (!text) return;
        sendMessageTo(studentId, text);
        const bubble = document.createElement('div');
        bubble.className = 'messaging-bubble sent';
        bubble.textContent = text;
        messagesContainer.appendChild(bubble);
        input.value = '';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        renderMessagingList();
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            sendMessage();
        });
    }

    if (input) {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }
}

/* প্রোফাইল মোডাল ক্লোজ */
function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.remove('show');
}

/* প্রোফাইল মোডাল ওপেন */
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

    const initials = (userName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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

/* ডমContentLoaded: মেসেজিং পেজ ইনিশিয়ালাইজ */
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

    const messagingSearch = document.getElementById('messagingSearch');
    if (messagingSearch) {
        messagingSearch.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            const contacts = document.querySelectorAll('.messaging-contact');
            contacts.forEach(function(contact) {
                const name = contact.getAttribute('data-fullname') || '';
                contact.style.display = name.toLowerCase().indexOf(query) !== -1 ? 'flex' : 'none';
            });
        });
    }

    renderMessagingList();
    ensureNotifications();
    updateBadge();

    const openChatWith = localStorage.getItem('ishare_open_chat_with');
    const openChatName = localStorage.getItem('ishare_open_chat_name');
    if (openChatWith) {
        localStorage.removeItem('ishare_open_chat_with');
        localStorage.removeItem('ishare_open_chat_name');
        setTimeout(function() {
            const contact = document.querySelector('.messaging-contact[data-student-id="' + openChatWith + '"]');
            if (contact) {
                contact.click();
            } else if (openChatName) {
                openChat(openChatWith, openChatName);
            }
        }, 100);
    }

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
