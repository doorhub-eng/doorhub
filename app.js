import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, setDoc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// Твоя база
const firebaseConfig = {
  apiKey: "AIzaSyBbhj6mVmB5YRV1PdKCDB1-3VDmMzpl7qk",
  authDomain: "doorhub-4ae29.firebaseapp.com",
  projectId: "doorhub-4ae29",
  storageBucket: "doorhub-4ae29.firebasestorage.app",
  messagingSenderId: "539107225343",
  appId: "1:539107225343:web:0798437a828f436da466ca",
  measurementId: "G-X0Y6RCBQZG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Твой Телеграм бот
const tgBotToken = "8791618336:AAGX3kVHYDOOg_-zBusJNkxTEnr6u3oD0ss";
const tgChatId = "6730598299";
let expectedAdminCode = "";

// Управление сайдбаром
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if(sidebar) sidebar.classList.toggle('active');
    if(overlay) overlay.classList.toggle('active');
};

// Управление модалками
window.openModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
};

window.openImage = function(src) {
    const img = document.getElementById('fullscreen-image');
    if(img) img.src = src;
    openModal('imageModal');
};

window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
};

window.switchModal = function(closeId, openId) {
    closeModal(closeId);
    openModal(openId);
};

let posts = [];
let currentCategory = 'Все';
let currentSort = 'new';

// Подтягиваем посты из Firebase
const q = query(collection(db, "posts"), orderBy("id", "desc"));
onSnapshot(q, (snapshot) => {
    posts = [];
    snapshot.forEach((doc) => {
        posts.push({ docId: doc.id, ...doc.data() });
    });
    filterPosts();
}, (error) => {
    console.error("Ошибка Firebase:", error);
});

let allUsers = [];
onSnapshot(query(collection(db, "users")), (snapshot) => {
    allUsers = [];
    snapshot.forEach((doc) => {
        allUsers.push({ id: doc.id, ...doc.data() });
    });
    if (typeof renderAdminUsers === 'function') renderAdminUsers();
});

window.setCategory = function(cat, btn) {
    currentCategory = cat;
    document.querySelectorAll('.filters .filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    filterPosts();
};

window.setSort = function(type, btn) {
    currentSort = type;
    document.querySelectorAll('.sort-bar .filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    filterPosts();
}

window.filterPosts = function() {
    const searchTitle = document.getElementById('search-title') ? document.getElementById('search-title').value.toLowerCase() : '';
    const searchDate = document.getElementById('search-date') ? document.getElementById('search-date').value : '';
    
    let filtered = posts.filter(p => {
        const matchCategory = currentCategory === 'Все' || p.category === currentCategory;
        const matchTitle = (p.title || '').toLowerCase().includes(searchTitle);
        const matchDate = searchDate ? p.date === searchDate : true;
        return matchCategory && matchTitle && matchDate;
    });
    
    if (currentSort === 'new') {
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
    } else if (currentSort === 'popular') {
        filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }
    
    renderPosts(filtered);
};

window.renderPosts = function(postsToRender = posts) {
    const container = document.getElementById('posts-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (postsToRender.length === 0) {
        container.innerHTML = '<p style="color:#777; grid-column: 1/-1; text-align:center;">В базе пока нет постов или ничего не найдено</p>';
        return;
    }
    
    postsToRender.forEach(p => {
        const editedTag = p.edited ? `<span class="post-edited" style="margin-left: 10px; color: #888; font-size: 12px;">(изменено)</span>` : '';
        const imgSrc = p.image || `https://picsum.photos/800/400?random=${p.id}`;
        const html = `
            <div class="post-card" style="border-radius: 8px;">
                <img class="post-image" src="${imgSrc}" style="cursor: pointer;" onclick="openImage('${imgSrc}')" alt="Обложка">
                <div class="post-content">
                <div class="post-meta">
                    <span class="post-category">${p.category || 'Без категории'}</span>
                    <div style="display:flex; align-items:center;">
                        <span class="post-date">${p.date || ''}</span>
                        ${editedTag}
                    </div>
                </div>
                <h3 class="post-title">${p.title || ''}</h3>
                <div class="post-text">${p.content || ''}</div>
            </div>
            <div class="post-actions">
                <button class="action-btn" onclick="alert('Лайк!')"><i class="fas fa-heart"></i> ${p.likes || 0}</button>
                <button class="action-btn" onclick="alert('Комментарии')"><i class="fas fa-comment"></i> ${p.comments ? p.comments.length : 0}</button>
            </div>
        </div>
        `;
        container.innerHTML += html;
    });
    
    if(document.getElementById('admin-stat-posts')) {
        document.getElementById('admin-stat-posts').innerText = posts.length;
        document.getElementById('admin-stat-likes').innerText = posts.reduce((acc, p) => acc + (p.likes || 0), 0);
    }
};

let currentUser = null;

// При загрузке проверяем, был ли юзер авторизован ранее
const savedUser = localStorage.getItem('doorhub_user');
if (savedUser) {
    currentUser = JSON.parse(savedUser);
}

window.handleLogin = async function(e) {
    e.preventDefault();
    const login = document.getElementById('login-identifier').value.toLowerCase();
    const pwd = document.getElementById('login-password').value;
    
    if (login === 'doorblack' || login === 'doorhelps@outlook.com') {
        if (pwd !== 'ROOT_2026') {
            alert("Неверный пароль администратора!");
            return;
        }
        // Генерируем код и шлем в телегу
        expectedAdminCode = Math.floor(1000 + Math.random() * 9000).toString();
        fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: tgChatId,
                text: `🔐 Код подтверждения для входа в панель администратора DOORHUB: ${expectedAdminCode}`
            })
        }).then(() => {
            switchModal('loginModal', 'adminAuthModal');
        }).catch(err => {
            console.error(err);
            alert('Ошибка связи с Telegram ботом. Проверь токен.');
        });
    } else {
        try {
            const userRef = doc(db, "users", login);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists() && userSnap.data().password === pwd) {
                currentUser = userSnap.data();
                localStorage.setItem('doorhub_user', JSON.stringify(currentUser));
                closeModal('loginModal');
                loginAsUser();
            } else {
                alert("Неверный логин или пароль!");
            }
        } catch (err) {
            console.error(err);
            alert("Ошибка при обращении к базе данных!");
        }
    }
};

window.verifyAdminCode = function(e) {
    e.preventDefault();
    const code = document.getElementById('admin-auth-code').value;
    if (code === expectedAdminCode) {
        closeModal('adminAuthModal');
        loginAsAdmin();
    } else {
        alert('Неверный код!');
    }
};

function loginAsAdmin() {
    const sGuest = document.getElementById('sidebar-guest');
    const sUser = document.getElementById('sidebar-user');
    const adminBtn = document.getElementById('admin-panel-btn');
    const adminFab = document.getElementById('admin-fab');
    
    if(sGuest) sGuest.classList.add('hidden');
    if(sUser) sUser.classList.remove('hidden');
    if(adminBtn) adminBtn.classList.remove('hidden');
    if(adminFab) adminFab.classList.remove('hidden');
    
    const userDisplay = document.getElementById('username-display');
    if(userDisplay) userDisplay.innerText = 'Привет, Владелец';
}

function loginAsUser() {
    const sGuest = document.getElementById('sidebar-guest');
    const sUser = document.getElementById('sidebar-user');
    const adminBtn = document.getElementById('admin-panel-btn');
    const adminFab = document.getElementById('admin-fab');
    
    if(sGuest) sGuest.classList.add('hidden');
    if(sUser) sUser.classList.remove('hidden');
    if(adminBtn) adminBtn.classList.add('hidden');
    if(adminFab) adminFab.classList.add('hidden');
    
    const userDisplay = document.getElementById('username-display');
    if(userDisplay && currentUser) userDisplay.innerText = 'Привет, ' + currentUser.name;
    
    // Заполняем профиль
    if (currentUser) {
        document.getElementById('prof-name').value = currentUser.name || '';
        document.getElementById('prof-email').value = currentUser.login || '';
        document.getElementById('prof-phone').value = currentUser.phone || '';
        document.getElementById('prof-password').value = '';
    }
}

window.handleRegister = async function(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const login = document.getElementById('reg-identifier').value.toLowerCase();
    const pwd = document.getElementById('reg-password').value;
    
    try {
        const userRef = doc(db, "users", login);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            alert("Пользователь с таким логином/email уже существует!");
            return;
        }
        
        const userData = {
            name: name,
            login: login,
            password: pwd, // В реальном проекте так не делают, но для нашей БД сойдет
            role: 'user',
            phone: '',
            avatar: ''
        };
        
        await setDoc(userRef, userData);
        currentUser = userData;
        localStorage.setItem('doorhub_user', JSON.stringify(currentUser));
        
        switchModal('registerModal', 'avatarStepModal');
    } catch (err) {
        console.error(err);
        alert("Ошибка регистрации! Проверь доступ к БД.");
    }
};

window.skipAvatarStep = function() {
    closeModal('avatarStepModal');
    loginAsUser();
};

window.handleAvatarStepSetup = function(e) {
    e.preventDefault();
    skipAvatarStep();
};

window.logout = function() {
    currentUser = null;
    localStorage.removeItem('doorhub_user');
    
    const sGuest = document.getElementById('sidebar-guest');
    const sUser = document.getElementById('sidebar-user');
    const adminBtn = document.getElementById('admin-panel-btn');
    const adminFab = document.getElementById('admin-fab');
    
    if(sGuest) sGuest.classList.remove('hidden');
    if(sUser) sUser.classList.add('hidden');
    if(adminBtn) adminBtn.classList.add('hidden');
    if(adminFab) adminFab.classList.add('hidden');
};

window.handleCreatePost = async function(e) {
    e.preventDefault();
    const title = document.getElementById('post-title').value;
    const cat = document.getElementById('post-category').value;
    const content = document.getElementById('post-content').value;
    const today = new Date().toISOString().split('T')[0];
    
    try {
        await addDoc(collection(db, "posts"), {
            id: Date.now(),
            title: title,
            category: cat,
            content: content,
            date: today,
            edited: false,
            likes: 0,
            comments: []
        });
        closeModal('createPostModal');
        e.target.reset();
    } catch (err) {
        console.error(err);
        alert("Ошибка! Проверь правила (Rules) в Firebase. Они должны разрешать запись: allow read, write: if true;");
    }
};

window.handleEditPost = function(e) {
    e.preventDefault();
    closeModal('editPostModal');
};

window.handleSaveProfile = async function(e) {
    e.preventDefault();
    if (!currentUser) return;
    
    const newName = document.getElementById('prof-name').value;
    const newPhone = document.getElementById('prof-phone').value;
    const newPwd = document.getElementById('prof-password').value;
    
    const updates = {
        name: newName,
        phone: newPhone
    };
    
    if (newPwd.trim() !== '') {
        updates.password = newPwd;
    }
    
    try {
        const userRef = doc(db, "users", currentUser.login);
        await updateDoc(userRef, updates);
        
        // Обновляем локально
        currentUser = { ...currentUser, ...updates };
        localStorage.setItem('doorhub_user', JSON.stringify(currentUser));
        
        document.getElementById('username-display').innerText = 'Привет, ' + currentUser.name;
        closeModal('profileModal');
        alert("Профиль успешно обновлен в базе!");
    } catch (err) {
        console.error(err);
        alert("Ошибка при сохранении профиля!");
    }
};
window.toggleBoostyField = function(val) {
    const group = document.getElementById('boosty-link-group');
    if(group) {
        if (val === '18+') group.classList.remove('hidden');
        else group.classList.add('hidden');
    }
};

window.toggleEditBoostyField = function(val) {
    const group = document.getElementById('edit-boosty-link-group');
    if(group) {
        if (val === '18+') group.classList.remove('hidden');
        else group.classList.add('hidden');
    }
};

window.formatText = function(startTag, endTag) {
    alert('Форматирование: ' + startTag + ' ... ' + endTag);
};

window.insertLink = function() {
    alert('Вставка ссылки');
};

window.insertImage = function() {
    alert('Вставка картинки');
};

window.showPublicUsers = function(type) {
    toggleSidebar();
    openModal('publicUsersModal');
};

window.logoutAndCloseBan = function() {
    document.getElementById('bannedModal').style.display = 'none';
    logout();
};

let actionUserId = null;
window.openUserAction = function(id, name) {
    actionUserId = id;
    document.getElementById('user-action-name').innerText = name;
    openModal('userActionModal');
};

window.executeUserAction = async function(action) {
    if (!actionUserId) return;
    const userRef = doc(db, "users", actionUserId);
    try {
        if (action === 'ban') await updateDoc(userRef, { banned: true });
        else if (action === 'mute') await updateDoc(userRef, { muted: true });
        else if (action === 'editor') await updateDoc(userRef, { role: 'editor' });
        else if (action === 'delete') await deleteDoc(userRef);
        
        closeModal('userActionModal');
        alert('Действие успешно применено к пользователю!');
    } catch (err) {
        console.error(err);
        alert('Ошибка при управлении пользователем!');
    }
};

window.renderAdminUsers = function() {
    const uList = document.getElementById('admin-users-list');
    const edList = document.getElementById('admin-editors-list');
    const banList = document.getElementById('admin-banned-list');
    if(!uList || !edList || !banList) return;

    uList.innerHTML = ''; edList.innerHTML = ''; banList.innerHTML = '';
    
    const statReg = document.getElementById('stat-reg');
    if (statReg) statReg.innerText = allUsers.length;

    allUsers.forEach(u => {
        const html = `<div style="display:flex; justify-content:space-between; align-items:center; padding: 5px; border-bottom: 1px solid #333;">
            <span>${u.name} (${u.login})</span>
            <button class="btn btn-outline" style="padding: 2px 8px; font-size: 12px;" onclick="openUserAction('${u.id}', '${u.name}')">Упр.</button>
        </div>`;
        
        if (u.banned) banList.innerHTML += html;
        else if (u.role === 'editor') edList.innerHTML += html;
        else uList.innerHTML += html;
    });
};

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    renderAdminUsers();
    
    if (currentUser) {
        if (currentUser.role === 'admin' || currentUser.login === 'doorblack' || currentUser.login === 'doorhelps@outlook.com') {
            loginAsAdmin();
        } else {
            loginAsUser();
            if (currentUser.banned) {
                document.getElementById('bannedModal').style.display = 'flex';
            }
        }
    }
});