const socket = io();
let currentUser = null;
let currentConversation = null;
let currentConversationType = null; // 'private' or 'group'
let typingTimeout = null;

// DOM elements
const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const conversationsList = document.getElementById('conversations-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const searchInput = document.getElementById('search-input');
const newChatBtn = document.getElementById('new-chat-btn');
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');
const currentUserSpan = document.getElementById('current-user');
const logoutBtn = document.getElementById('logout-btn');
const adminPanel = document.getElementById('admin-panel');
const manageUsersBtn = document.getElementById('manage-users-btn');
const manageGroupsBtn = document.getElementById('manage-groups-btn');
const chatTitle = document.getElementById('chat-title');
const onlineStatus = document.getElementById('online-status');
const typingIndicator = document.getElementById('typing-indicator');

// Theme elements
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Modal elements
const newChatModal = document.getElementById('new-chat-modal');
const manageUsersModal = document.getElementById('manage-users-modal');
const addUserModal = document.getElementById('add-user-modal');
const manageGroupsModal = document.getElementById('manage-groups-modal');
const addGroupModal = document.getElementById('add-group-modal');
const addUserForm = document.getElementById('add-user-form');
const addGroupForm = document.getElementById('add-group-form');
const usersList = document.getElementById('users-list');
const groupsList = document.getElementById('groups-list');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    initializeTheme();
});

// Check if user is already logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        currentUser = JSON.parse(localStorage.getItem('user'));
        showChat();
        loadConversations();
        socket.emit('join', currentUser.id);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login
    loginForm.addEventListener('submit', handleLogin);

    // Chat
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    messageInput.addEventListener('input', handleTyping);

    // Search
    searchInput.addEventListener('input', handleSearch);

    // Buttons
    newChatBtn.addEventListener('click', openNewChatModal);
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    logoutBtn.addEventListener('click', handleLogout);

    // Admin buttons
    if (manageUsersBtn) manageUsersBtn.addEventListener('click', openManageUsersModal);
    if (manageGroupsBtn) manageGroupsBtn.addEventListener('click', openManageGroupsModal);

    // Modal buttons
    document.getElementById('add-user-btn').addEventListener('click', () => {
        addUserModal.classList.remove('hidden');
    });
    document.getElementById('add-group-btn').addEventListener('click', () => {
        addGroupModal.classList.remove('hidden');
    });

    // Modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModals);
    });

    // Forms
    addUserForm.addEventListener('submit', handleAddUser);
    addGroupForm.addEventListener('submit', handleAddGroup);

    // Theme toggle
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Socket events
    socket.on('newMessage', handleNewMessage);
    socket.on('typingIndicator', handleTypingIndicator);
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            showChat();
            loadConversations();
            socket.emit('join', currentUser.id);
        } else {
            loginError.textContent = data.error;
        }
    } catch (error) {
        loginError.textContent = 'Erro de conexão';
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    showLogin();
}

// UI functions
function showLogin() {
    loginContainer.classList.remove('hidden');
    chatContainer.classList.add('hidden');
}

function showChat() {
    loginContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    currentUserSpan.textContent = currentUser.full_name;
    if (currentUser.role === 'admin') {
        adminPanel.classList.remove('hidden');
    }
}

// Conversations
async function loadConversations() {
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': localStorage.getItem('token') }
        });
        const users = await response.json();

        const response2 = await fetch('/api/groups', {
            headers: { 'Authorization': localStorage.getItem('token') }
        });
        const groups = await response2.json();

        displayConversations(users, groups);
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

function displayConversations(users, groups) {
    conversationsList.innerHTML = '';

    // Add users
    users.forEach(user => {
        if (user.id !== currentUser.id) {
            const item = createConversationItem(user, 'user');
            conversationsList.appendChild(item);
        }
    });

    // Add groups
    groups.forEach(group => {
        const item = createConversationItem(group, 'group');
        conversationsList.appendChild(item);
    });
}

function createConversationItem(item, type) {
    const div = document.createElement('div');
    div.className = 'conversation-item';
    div.dataset.id = item.id;
    div.dataset.type = type;

    const avatar = document.createElement('div');
    avatar.className = 'conversation-avatar';
    avatar.textContent = type === 'user' ? item.full_name.charAt(0).toUpperCase() : item.name.charAt(0).toUpperCase();

    const info = document.createElement('div');
    info.className = 'conversation-info';

    const name = document.createElement('div');
    name.className = 'conversation-name';
    name.textContent = type === 'user' ? item.full_name : item.name;

    const lastMessage = document.createElement('div');
    lastMessage.className = 'conversation-last-message';
    lastMessage.textContent = 'Nenhuma mensagem ainda';

    const time = document.createElement('div');
    time.className = 'conversation-time';
    time.textContent = '';

    info.appendChild(name);
    info.appendChild(lastMessage);

    div.appendChild(avatar);
    div.appendChild(info);
    div.appendChild(time);

    div.addEventListener('click', () => selectConversation(item, type));

    return div;
}

function selectConversation(item, type) {
    currentConversation = item;
    currentConversationType = type;

    // Update UI
    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    chatTitle.textContent = type === 'user' ? item.full_name : item.name;
    onlineStatus.textContent = 'Online'; // TODO: Implement online status

    // Load messages
    loadMessages();
}

// Messages
async function loadMessages() {
    if (!currentConversation) return;

    try {
        const response = await fetch(`/api/messages/${currentConversation.id}?type=${currentConversationType}`, {
            headers: { 'Authorization': localStorage.getItem('token') }
        });
        const messages = await response.json();
        displayMessages(messages);
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function displayMessages(messages) {
    messagesContainer.innerHTML = '';
    messages.forEach(message => {
        const messageEl = createMessageElement(message);
        messagesContainer.appendChild(messageEl);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.sender_id === currentUser.id ? 'own' : ''}`;

    if (message.sender_id !== currentUser.id) {
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = message.full_name.charAt(0).toUpperCase();
        div.appendChild(avatar);
    }

    const content = document.createElement('div');
    content.className = 'message-content';

    if (message.message_type === 'image') {
        const img = document.createElement('img');
        img.className = 'message-image';
        img.src = message.file_path;
        img.onclick = () => window.open(message.file_path, '_blank');
        content.appendChild(img);
    } else if (message.message_type === 'file') {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'message-file';
        fileDiv.innerHTML = `
            <i class="fas fa-file"></i>
            <a href="${message.file_path}" download>${message.content}</a>
        `;
        content.appendChild(fileDiv);
    } else {
        const text = document.createElement('div');
        text.className = 'message-text';
        text.textContent = message.content;
        content.appendChild(text);
    }

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    content.appendChild(time);

    if (message.sender_id === currentUser.id) {
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        actions.innerHTML = `
            <button onclick="editMessage(${message.id}, '${message.content}')"><i class="fas fa-edit"></i></button>
            <button onclick="deleteMessage(${message.id})"><i class="fas fa-trash"></i></button>
        `;
        div.appendChild(actions);
    }

    div.appendChild(content);

    if (message.sender_id === currentUser.id) {
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = currentUser.full_name.charAt(0).toUpperCase();
        div.appendChild(avatar);
    }

    return div;
}

async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !currentConversation) return;

    const messageData = {
        senderId: currentUser.id,
        receiverId: currentConversationType === 'user' ? currentConversation.id : null,
        groupId: currentConversationType === 'group' ? currentConversation.id : null,
        content,
        messageType: 'text'
    };

    socket.emit('sendMessage', messageData);
    messageInput.value = '';
}

function handleNewMessage(message) {
    if ((currentConversationType === 'user' &&
         ((message.sender_id === currentUser.id && message.receiver_id === currentConversation.id) ||
          (message.sender_id === currentConversation.id && message.receiver_id === currentUser.id))) ||
        (currentConversationType === 'group' && message.group_id === currentConversation.id)) {
        const messageEl = createMessageElement(message);
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Update conversation list
    updateConversationLastMessage(message);
}

function updateConversationLastMessage(message) {
    // TODO: Update the last message in conversation list
}

// Typing indicator
function handleTyping() {
    if (!currentConversation) return;

    socket.emit('typing', {
        userId: currentUser.id,
        conversationId: currentConversation.id,
        isTyping: messageInput.value.length > 0
    });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', {
            userId: currentUser.id,
            conversationId: currentConversation.id,
            isTyping: false
        });
    }, 1000);
}

function handleTypingIndicator(data) {
    if (data.userId !== currentUser.id) {
        typingIndicator.classList.toggle('hidden', !data.isTyping);
    }
}

// File upload
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !currentConversation) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': localStorage.getItem('token') },
            body: formData
        });

        const data = await response.json();
        if (response.ok) {
            const messageData = {
                senderId: currentUser.id,
                receiverId: currentConversationType === 'user' ? currentConversation.id : null,
                groupId: currentConversationType === 'group' ? currentConversation.id : null,
                content: file.name,
                messageType: file.type.startsWith('image/') ? 'image' : 'file',
                filePath: data.filePath
            };

            socket.emit('sendMessage', messageData);
        }
    } catch (error) {
        console.error('Error uploading file:', error);
    }
}

// Search
function handleSearch() {
    const query = searchInput.value.toLowerCase();
    document.querySelectorAll('.conversation-item').forEach(item => {
        const name = item.querySelector('.conversation-name').textContent.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

// Modals
function openNewChatModal() {
    loadUsersForNewChat();
    newChatModal.classList.remove('hidden');
}

async function loadUsersForNewChat() {
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': localStorage.getItem('token') }
        });
        const users = await response.json();

        const userList = newChatModal.querySelector('.user-list');
        userList.innerHTML = '';

        users.forEach(user => {
            if (user.id !== currentUser.id) {
                const div = document.createElement('div');
                div.className = 'user-item';
                div.textContent = user.full_name;
                div.addEventListener('click', () => {
                    selectConversation(user, 'user');
                    closeModals();
                });
                userList.appendChild(div);
            }
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function openManageUsersModal() {
    loadUsersForManagement();
    manageUsersModal.classList.remove('hidden');
}

async function loadUsersForManagement() {
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': localStorage.getItem('token') }
        });
        const users = await response.json();

        usersList.innerHTML = '';
        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-item';
            div.innerHTML = `
                <span>${user.full_name} (${user.username}) - ${user.role}</span>
                <button onclick="deleteUser(${user.id})">Excluir</button>
            `;
            usersList.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function openManageGroupsModal() {
    loadGroupsForManagement();
    manageGroupsModal.classList.remove('hidden');
}

async function loadGroupsForManagement() {
    try {
        const response = await fetch('/api/groups', {
            headers: { 'Authorization': localStorage.getItem('token') }
        });
        const groups = await response.json();

        groupsList.innerHTML = '';
        groups.forEach(group => {
            const div = document.createElement('div');
            div.className = 'group-item';
            div.innerHTML = `
                <span>${group.name}</span>
                <button onclick="manageGroupMembers(${group.id})">Gerenciar Membros</button>
            `;
            groupsList.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading groups:', error);
    }
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
}

// User management
async function handleAddUser(e) {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const full_name = document.getElementById('new-fullname').value;
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('token')
            },
            body: JSON.stringify({ username, full_name, password, role })
        });

        if (response.ok) {
            closeModals();
            loadUsersForManagement();
        } else {
            alert('Erro ao adicionar usuário');
        }
    } catch (error) {
        console.error('Error adding user:', error);
    }
}

async function deleteUser(userId) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': localStorage.getItem('token') }
        });

        if (response.ok) {
            loadUsersForManagement();
        }
    } catch (error) {
        console.error('Error deleting user:', error);
    }
}

// Group management
async function handleAddGroup(e) {
    e.preventDefault();
    const name = document.getElementById('group-name').value;

    try {
        const response = await fetch('/api/groups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('token')
            },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            closeModals();
            loadGroupsForManagement();
            loadConversations();
        } else {
            alert('Erro ao criar grupo');
        }
    } catch (error) {
        console.error('Error creating group:', error);
    }
}

// Message actions
async function editMessage(messageId, currentContent) {
    const newContent = prompt('Editar mensagem:', currentContent);
    if (newContent && newContent !== currentContent) {
        try {
            const response = await fetch(`/api/messages/${messageId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': localStorage.getItem('token')
                },
                body: JSON.stringify({ content: newContent })
            });

            if (response.ok) {
                loadMessages();
            }
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Tem certeza que deseja excluir esta mensagem?')) return;

    try {
        const response = await fetch(`/api/messages/${messageId}`, {
            method: 'DELETE',
            headers: { 'Authorization': localStorage.getItem('token') }
        });

        if (response.ok) {
            loadMessages();
        }
    } catch (error) {
        console.error('Error deleting message:', error);
    }
}

// Utility functions
function manageGroupMembers(groupId) {
    // TODO: Implement group member management
    alert('Funcionalidade de gerenciamento de membros do grupo em desenvolvimento');
}

// Theme functions
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
}

function updateThemeButton(theme) {
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-moon';
    }
}