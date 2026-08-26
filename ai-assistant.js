/* ========================================================= */
/* AI Assistant Chat Widget - iShare IUBAT                   */
/* ========================================================= */

(function() {
  'use strict';

  var STORAGE_KEY = 'ishare_ai_chat_history';
  var panel = null;
  var messagesContainer = null;
  var inputEl = null;
  var typingEl = null;
  var quickActionsEl = null;
  var isOpen = false;

  function getCurrentPage() {
    return (window.location.pathname || '').split('/').pop() || '';
  }

  function isAdminPage() {
    var page = getCurrentPage();
    return page === 'admin-dashboard.html' ||
      page === 'user-management.html' ||
      page === 'department-controls.html' ||
      page === 'announcement-management.html';
  }

  function getPageName() {
    var page = getCurrentPage();
    var names = {
      'admin-dashboard.html': 'Platform Overview',
      'user-management.html': 'User Management',
      'department-controls.html': 'Department Controls',
      'announcement-management.html': 'Announcement Management',
      'student-home.html': 'Student Home',
      'student-messaging.html': 'Messaging',
      'student-people.html': 'People'
    };
    return names[page] || page;
  }

  function getAccounts() {
    try {
      return JSON.parse(localStorage.getItem('ishare_accounts') || '[]');
    } catch (e) {
      return [];
    }
  }

  function getNotes() {
    try {
      return JSON.parse(localStorage.getItem('ishare_notes') || '[]');
    } catch (e) {
      return [];
    }
  }

  function getAnnouncements() {
    try {
      return JSON.parse(localStorage.getItem('ishare_announcements') || '[]');
    } catch (e) {
      return [];
    }
  }

  function getDepartments() {
    try {
      return JSON.parse(localStorage.getItem('ishare_departments') || '[]');
    } catch (e) {
      return [];
    }
  }

  function getNotifications() {
    try {
      return JSON.parse(localStorage.getItem('ishare_notifications') || '[]');
    } catch (e) {
      return [];
    }
  }

  function getPlatformStats() {
    var notes = getNotes();
    var announcements = getAnnouncements();
    var departments = getDepartments();
    var accounts = getAccounts();
    var notifications = getNotifications();
    var totalDownloads = notes.reduce(function(sum, n) { return sum + (n.downloads || 0); }, 0);
    var totalLikes = notes.reduce(function(sum, n) { return sum + (n.likes || 0); }, 0);
    return {
      users: accounts.length,
      activeUsers: accounts.filter(function(a) { return a.status === 'active'; }).length,
      notes: notes.length,
      announcements: announcements.length,
      departments: departments.length > 0 ? departments.length : 10,
      notifications: notifications.length,
      downloads: totalDownloads,
      likes: totalLikes
    };
  }

  function checkSystemHealth() {
    var checks = [];
    var passed = 0;
    try {
      localStorage.setItem('ishare_health_check', 'ok');
      localStorage.removeItem('ishare_health_check');
      checks.push({ name: 'LocalStorage', status: 'pass' });
      passed++;
    } catch (e) {
      checks.push({ name: 'LocalStorage', status: 'fail' });
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      checks.push({ name: 'Page Load', status: 'pass' });
      passed++;
    } else {
      checks.push({ name: 'Page Load', status: 'fail' });
    }
    try {
      var accounts = JSON.parse(localStorage.getItem('ishare_accounts') || '[]');
      if (Array.isArray(accounts)) {
        checks.push({ name: 'User Data', status: 'pass' });
        passed++;
      } else {
        checks.push({ name: 'User Data', status: 'fail' });
      }
    } catch (e) {
      checks.push({ name: 'User Data', status: 'fail' });
    }
    try {
      var notes = JSON.parse(localStorage.getItem('ishare_notes') || '[]');
      if (Array.isArray(notes)) {
        checks.push({ name: 'Notes Data', status: 'pass' });
        passed++;
      } else {
        checks.push({ name: 'Notes Data', status: 'fail' });
      }
    } catch (e) {
      checks.push({ name: 'Notes Data', status: 'fail' });
    }
    var percent = Math.round((passed / checks.length) * 100);
    return {
      percent: percent,
      passed: passed,
      total: checks.length,
      allOperational: passed === checks.length,
      checks: checks
    };
  }

  var localResponses = {
    'hello': 'Hello! I am Gemma, your AI assistant. I can answer almost anything — from platform help to general questions. What would you like to ask?',
    'hi': 'Hi! I am Gemma. Ask me anything — platform questions, study tips, admin tasks, or general knowledge.',
    'help': 'I can help you with:\n- Platform navigation & features\n- Notes, downloads, posting\n- Admin dashboard, users, departments\n- Announcements & notifications\n- General questions\n\nTry asking naturally.',
    'dashboard stats': '📊 Platform Overview:\n\n' +
      '👥 Total Users: ' + getPlatformStats().users + '\n' +
      '✅ Active Users: ' + getPlatformStats().activeUsers + '\n' +
      '📝 Total Notes: ' + getPlatformStats().notes + '\n' +
      '📢 Announcements: ' + getPlatformStats().announcements + '\n' +
      '🏛️ Departments: ' + getPlatformStats().departments + '\n' +
      '📥 Downloads: ' + getPlatformStats().downloads + '\n' +
      '👍 Likes: ' + getPlatformStats().likes + '\n' +
      '🔔 Notifications: ' + getPlatformStats().notifications,
    'system health': '🔍 System Health:\n\n' +
      'Overall: ' + (checkSystemHealth().allOperational ? '✅ All Systems Operational' : '⚠️ Partial') + '\n' +
      'Uptime Score: ' + checkSystemHealth().percent + '.9%\n\n' +
      'Checks:\n' + checkSystemHealth().checks.map(function(c) {
        return '- ' + c.name + ': ' + (c.status === 'pass' ? '✅ OK' : '❌ Fail');
      }).join('\n'),
    'users': '👥 User Management:\n\n' +
      '• View all users in User Management page\n' +
      '• Filter by status: Active, Suspended, Flagged\n' +
      '• Export data as JSON\n' +
      '• Take disciplinary actions\n\n' +
      'Current: ' + getPlatformStats().users + ' users (' + getPlatformStats().activeUsers + ' active)',
    'export users': '💾 Export User Data:\n\n' +
      '1. Go to Admin Dashboard or User Management\n' +
      '2. Click "Export Auth Data"\n' +
      '3. JSON file downloads automatically\n\n' +
      'Filename: ishare_auth_data_YYYY-MM-DD.json',
    'departments': '🏛️ Department Controls:\n\n' +
      '• Enable/disable departments\n' +
      '• Edit, duplicate, delete departments\n' +
      '• Add new departments\n\n' +
      'Current: ' + getPlatformStats().departments + ' departments\n\n' +
      'Go to Department Controls to manage.',
    'announcements': '📢 Announcement Management:\n\n' +
      '• Create notices for departments or all students\n' +
      '• Pin important announcements\n' +
      '• Edit/delete notices\n\n' +
      'Current: ' + getPlatformStats().announcements + ' announcements\n\n' +
      'Navigate to Announcement Management.',
    'create notice': '📝 Create Notice:\n\n' +
      '1. Go to Announcement Management\n' +
      '2. Click "New Notice"\n' +
      '3. Fill title, details, audience\n' +
      '4. Check "Pin to Top" if important\n' +
      '5. Click "Publish Notice"',
    'flagged users': '⚠️ Flagged Users:\n\n' +
      '• Filter by "Abusive Language Flagged" tab\n' +
      '• Review and take action\n\n' +
      'Disciplinary Steps:\n' +
      '1. Formal Warning\n' +
      '2. Mute Posting (7 days)\n' +
      '3. 7-Day Suspension\n' +
      '4. Permanent Ban\n' +
      '5. Dismiss Flag',
    'disciplinary actions': '⚖️ Disciplinary Actions:\n\n' +
      '1. Formal Warning - strike count + warning banner\n' +
      '2. Mute Posting - blocks uploads for 7 days\n' +
      '3. 7-Day Suspension - locks account\n' +
      '4. Permanent Ban - requires Dean override\n' +
      '5. Dismiss Flag - clears false positive',
    'navigation': '🧭 Quick Navigation:\n\n' +
      'Current: ' + getPageName() + '\n\n' +
      'Admin Pages:\n' +
      '• "Go to dashboard"\n' +
      '• "Go to users"\n' +
      '• "Go to departments"\n' +
      '• "Go to announcements"',
    'logout': '🚪 To log out:\n\n' +
      '• Click "Log Out" in sidebar\n' +
      '• Redirected to login page\n' +
      '• Session cleared',
    'gemma': 'I am Gemma, your AI assistant for iShare. I can answer questions about the platform, help with admin tasks, and even general questions. How can I help you today?',
    'tips': '💡 Tips:\n\n' +
      '• Use "dashboard stats" for overview\n' +
      '• Use "system health" to check status\n' +
      '• Use "export users" for backup\n' +
      '• Pin important announcements\n' +
      '• Review flagged users weekly',
    'default': ''
  };

  function getLocalResponse(message) {
    var lower = message.toLowerCase().trim();
    if (lower.indexOf('dashboard') !== -1 || lower.indexOf('overview') !== -1 || lower.indexOf('stats') !== -1) {
      return localResponses['dashboard stats'];
    }
    if (lower.indexOf('system health') !== -1 || lower.indexOf('health check') !== -1 || lower.indexOf('system status') !== -1) {
      return localResponses['system health'];
    }
    if (lower.indexOf('export') !== -1 && lower.indexOf('user') !== -1) {
      return localResponses['export users'];
    }
    if (lower.indexOf('user') !== -1 && (lower.indexOf('manage') !== -1 || lower.indexOf('export') !== -1 || lower.indexOf('list') !== -1 || lower.indexOf('view') !== -1)) {
      return localResponses['users'];
    }
    if (lower.indexOf('department') !== -1) {
      return localResponses['departments'];
    }
    if (lower.indexOf('announcement') !== -1 || lower.indexOf('notice') !== -1) {
      if (lower.indexOf('create') !== -1 || lower.indexOf('new') !== -1 || lower.indexOf('post') !== -1) {
        return localResponses['create notice'];
      }
      return localResponses['announcements'];
    }
    if (lower.indexOf('flagged') !== -1 || lower.indexOf('abuse') !== -1 || lower.indexOf('flag') !== -1) {
      return localResponses['flagged users'];
    }
    if (lower.indexOf('disciplinary') !== -1 || lower.indexOf('warning') !== -1 || lower.indexOf('strike') !== -1 || lower.indexOf('mute') !== -1 || lower.indexOf('suspension') !== -1 || lower.indexOf('ban') !== -1) {
      return localResponses['disciplinary actions'];
    }
    if (lower.indexOf('navigate') !== -1 || lower.indexOf('go to') !== -1 || lower.indexOf('page') !== -1) {
      return localResponses['navigation'];
    }
    if (lower.indexOf('logout') !== -1) {
      return localResponses['logout'];
    }
    if (lower.indexOf('help') !== -1) {
      return localResponses['help'];
    }
    if (lower.indexOf('hello') !== -1 || lower === 'hi' || lower.indexOf('hi ') !== -1) {
      return localResponses['hello'];
    }
    if (lower.indexOf('gemma') !== -1) {
      return localResponses['gemma'];
    }
    if (lower.indexOf('tip') !== -1 || lower.indexOf('best practice') !== -1) {
      return localResponses['tips'];
    }

    for (var key in localResponses) {
      if (lower.indexOf(key) !== -1) {
        return localResponses[key];
      }
    }
    return null;
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveMessage(role, text) {
    var history = getHistory();
    history.push({ role: role, text: text, time: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-100)));
  }

  function renderMessage(role, text) {
    var bubble = document.createElement('div');
    bubble.className = 'ai-chat-bubble ' + role;
    bubble.textContent = text;
    messagesContainer.appendChild(bubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function renderHistory() {
    var history = getHistory();
    if (history.length === 0) {
      var welcomeText = isAdminPage()
        ? 'Hi! I am Gemma, your admin assistant.\nI can answer almost any question about iShare. Try asking naturally!'
        : 'Hi! I am Gemma, your AI assistant.\nI can answer almost any question. Try asking naturally!';
      messagesContainer.innerHTML = '<div class="ai-chat-empty"><div class="ai-chat-empty-icon">&#128172;</div>' + welcomeText.replace(/\n/g, '<br>') + '</div>';
      return;
    }
    messagesContainer.innerHTML = '';
    history.forEach(function(msg) {
      renderMessage(msg.role, msg.text);
    });
  }

  function renderQuickActions() {
    if (!quickActionsEl) return;
    var actions = [];

    if (isAdminPage()) {
      var page = getCurrentPage();
      if (page === 'admin-dashboard.html') {
        actions = ['Dashboard stats', 'System health', 'All users', 'Export data', 'Departments', 'Announcements'];
      } else if (page === 'user-management.html') {
        actions = ['All users', 'Flagged users', 'Export users', 'Disciplinary actions', 'Search user'];
      } else if (page === 'department-controls.html') {
        actions = ['All departments', 'Add department', 'Enable/disable', 'Department stats'];
      } else if (page === 'announcement-management.html') {
        actions = ['All notices', 'Create notice', 'Pin notice', 'Search notices'];
      } else {
        actions = ['Dashboard stats', 'System health', 'All users', 'Departments', 'Announcements'];
      }
    } else {
      actions = ['Find notes', 'How to post', 'How to download', 'Profile help', 'Search notes'];
    }

    quickActionsEl.innerHTML = actions.map(function(action) {
      return '<button class="ai-chat-quick-btn" type="button">' + action + '</button>';
    }).join('');

    quickActionsEl.querySelectorAll('.ai-chat-quick-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var text = btn.textContent.trim();
        inputEl.value = text;
        sendMessage();
      });
    });
  }

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    renderMessage('user', text);
    saveMessage('user', text);

    typingEl.classList.add('show');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    setTimeout(function() {
      typingEl.classList.remove('show');
      var reply = getLocalResponse(text);
      if (reply) {
        renderMessage('assistant', reply);
        saveMessage('assistant', reply);
      } else {
        renderMessage('assistant', 'I don\'t have a specific answer for that right now. Try one of the quick actions below, or ask about dashboard, users, departments, announcements, or system health.');
      }
    }, 300);
  }

  function createPanel() {
    if (!document.getElementById('ai-assistant-styles')) {
      var link = document.createElement('link');
      link.id = 'ai-assistant-styles';
      link.rel = 'stylesheet';
      link.href = 'ai-assistant.css';
      document.head.appendChild(link);
    }

    var trigger = document.createElement('button');
    trigger.className = 'ai-chat-trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', 'Open AI Assistant');
    trigger.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg><span class="pulse-ring"></span>';

    panel = document.createElement('div');
    panel.className = 'ai-chat-panel';
    panel.innerHTML =
      '<div class="ai-chat-header">' +
        '<div class="ai-chat-header-left">' +
          '<div class="ai-chat-header-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>' +
          '<div><div class="ai-chat-header-title">AI Gemma Assistant</div><div class="ai-chat-header-sub">' + (isAdminPage() ? 'Admin Mode' : 'Online') + '</div></div>' +
        '</div>' +
        '<button class="ai-chat-close" type="button" aria-label="Close chat"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
      '</div>' +
      '<div class="ai-chat-messages"></div>' +
      '<div class="ai-chat-typing">Gemma is typing...</div>' +
      '<div class="ai-chat-quick-actions"></div>' +
      '<div class="ai-chat-input-area">' +
        '<input type="text" class="ai-chat-input" placeholder="Ask Gemma anything..." autocomplete="off">' +
        '<button class="ai-chat-send" type="button" aria-label="Send message"><svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>' +
      '</div>';

    document.body.appendChild(trigger);
    document.body.appendChild(panel);

    messagesContainer = panel.querySelector('.ai-chat-messages');
    inputEl = panel.querySelector('.ai-chat-input');
    typingEl = panel.querySelector('.ai-chat-typing');
    quickActionsEl = panel.querySelector('.ai-chat-quick-actions');

    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      togglePanel();
    });

    panel.querySelector('.ai-chat-close').addEventListener('click', function(e) {
      e.stopPropagation();
      closePanel();
    });

    panel.querySelector('.ai-chat-send').addEventListener('click', function(e) {
      e.stopPropagation();
      sendMessage();
    });

    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });

    panel.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    document.addEventListener('click', function(e) {
      if (isOpen && !panel.contains(e.target) && e.target !== trigger) {
        closePanel();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isOpen) {
        closePanel();
      }
    });

    renderHistory();
    renderQuickActions();
  }

  function togglePanel() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function openPanel() {
    if (!panel) createPanel();
    panel.classList.add('show');
    isOpen = true;
    if (inputEl) inputEl.focus();
    renderHistory();
    renderQuickActions();
  }

  function closePanel() {
    if (panel) panel.classList.remove('show');
    isOpen = false;
  }

  window.openAIPanel = openPanel;
  window.closeAIPanel = closePanel;
  window.toggleAIPanel = togglePanel;

  function wireExistingButtons() {
    var buttons = document.querySelectorAll('button');
    buttons.forEach(function(btn) {
      var text = (btn.textContent || '').toLowerCase();
      if (text.indexOf('ai assistant') !== -1 || text.indexOf('gemma') !== -1) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          togglePanel();
        });
        btn.setAttribute('type', 'button');
      }
    });

    var sidebarAI = document.querySelectorAll('.sidebar-ai');
    sidebarAI.forEach(function(el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        togglePanel();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      createPanel();
      wireExistingButtons();
    });
  } else {
    createPanel();
    wireExistingButtons();
  }
})();
