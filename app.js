import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

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
const auth = getAuth(app);

let currentFilter = 'Все';
let posts = [];
let allUsersLocal = [];
let currentUserDoc = null;

// Слушаем авторизацию Firebase
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // Юзер вошел, грузим его данные из Firestore
            const uDoc = await getDoc(doc(db, "users", user.uid));
            if (uDoc.exists()) {
                currentUserDoc = { uid: user.uid, ...uDoc.data() };
                await updateDoc(doc(db, "users", user.uid), { isOnline: true });
            } else {
                // Если нет документа, создаем базовый (сразу проверяем на админа)
                let checkEmail = (user.email || "").toLowerCase();
                let userRole = (checkEmail === 'doorhelps@outlook.com' || checkEmail === 'doorblack@doorhub.app') ? 'admin' : 'user';
                currentUserDoc = { uid: user.uid, name: user.displayName || (checkEmail === 'doorblack@doorhub.app' ? 'DOORBLACK' : 'User'), email: user.email, role: userRole, isOnline: true, isBanned: false };
                await setDoc(doc(db, "users", user.uid), currentUserDoc);
            }
        } catch(err) {
            alert("Ошибка! Похоже в Firebase не включен Firestore Database или закрыты правила доступа.");
            console.error(err);
        }
    } else {
        if (currentUserDoc && currentUserDoc.uid) {
            // Пытаемся поставить оффлайн (может не сработать при закрытии вкладки, но лучше так)
            updateDoc(doc(db, "users", currentUserDoc.uid), { isOnline: false }).catch(()=>console.log("Оффлайн не сохранен"));
        }
        currentUserDoc = null;
    }
    updateAuthUI();
});

// Слушаем посты
onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snapshot) => {
    posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPosts();
    updateAdminStats();
});

// Слушаем пользователей (для админки и статы)
onSnapshot(collection(db, "users"), (snapshot) => {
    allUsersLocal = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
    updateSidebarStats();
    renderPublicUsers();
    if (document.getElementById('adminPanelModal').classList.contains('active')) {
        renderAdminLists();
    }
});

// Модалки
window.openModal = function(id) {
    const modal = document.getElementById(id);
    if(!modal) return;
    
    if (id === 'adminPanelModal') {
        renderAdminLists();
        if (typeof updateAdminStats === 'function') updateAdminStats();
    }
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if(!modal) return;
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 200);
}

window.switchModal = function(closeId, openId) {
    closeModal(closeId);
    setTimeout(() => openModal(openId), 250);
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        closeModal(event.target.id);
    }
}

window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

// Фильтры
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.textContent;
        renderPosts();
    });
});

// Рендер постов
window.renderPosts = function() {
    const container = document.getElementById('posts-container');
    if (!container) return;
    container.innerHTML = '';

    if (!currentUserDoc) {
        container.innerHTML = '<div style="text-align:center; padding: 100px 20px; color: #666; width: 100%; border: 1px solid #333; text-transform: uppercase;"><h2>Контент скрыт</h2><p style="margin-top:10px;">Войдите в систему для просмотра</p></div>';
        return;
    }

    let filtered = posts;
    if (currentFilter !== 'Все') {
        filtered = posts.filter(p => p.category === currentFilter);
    }

    const sortedPosts = [...filtered].sort((a, b) => (b.isPinned === true) - (a.isPinned === true));

    sortedPosts.forEach(post => {
        let imageHtml = '<div class="post-image" style="background:#111; display:flex; align-items:center; justify-content:center; color:#555;"><i class="fas fa-image fa-3x"></i></div>';
        if (post.image) {
            if (post.image.startsWith('data:video')) {
                imageHtml = `<video src="${post.image}" class="post-image" controls style="max-height: 400px; object-fit: contain; background: #000;"></video>`;
            } else {
                imageHtml = `<img src="${post.image}" class="post-image" alt="cover">`;
            }
        }
        
        let adminHtml = '';
        if (currentUserDoc.role === 'admin' || currentUserDoc.role === 'editor') {
            const pinIcon = post.isPinned ? 'fa-star' : 'fa-thumbtack';
            const editBtn = currentUserDoc.role === 'admin' ? `<button onclick="openEditPost('${post.id}')" style="background:#000; border:1px solid #00cc66; color:#00cc66; padding:8px 12px; cursor:pointer; transition:0.2s;" title="Редактировать"><i class="fas fa-pencil-alt"></i></button>` : '';
            adminHtml = `
                <div style="position:absolute; top:10px; right:10px; display:flex; gap:5px; z-index:10;">
                    ${editBtn}
                    <button onclick="togglePin('${post.id}', ${post.isPinned})" style="background:#000; border:1px solid #fff; color:${post.isPinned ? '#fff' : '#888'}; padding:8px 12px; cursor:pointer; transition:0.2s;" title="Закрепить"><i class="fas ${pinIcon}"></i></button>
                    <button onclick="deletePost('${post.id}')" style="background:#000; border:1px solid #ff4444; color:#ff4444; padding:8px 12px; cursor:pointer; transition:0.2s;" title="Удалить"><i class="fas fa-trash"></i></button>
                </div>
            `;
        }
        
        const badgeHtml = post.isPinned ? '<div style="position:absolute; top:10px; left:10px; background:#fff; color:#000; font-weight:bold; font-size:12px; padding:4px 8px; z-index:10; text-transform:uppercase; border: 1px solid #fff;">Главное</div>' : '';

        const likedBy = post.likedBy || [];
        const isLiked = likedBy.includes(currentUserDoc.uid);
        const likeClass = isLiked ? 'liked' : '';
        const likesCount = likedBy.length;

        const commentsHtml = (post.comments || []).map(c => {
            const cUser = allUsersLocal.find(u => u.uid === c.authorUid) || {};
            const avatar = cUser.avatar ? `<img src="${cUser.avatar}" style="width:20px; height:20px; border-radius:50%; object-fit:cover; vertical-align:middle; margin-right:5px;">` : `<i class="fas fa-user" style="font-size:12px; margin-right:5px;"></i>`;
            return `<div class="comment" style="display:flex; align-items:center; margin-bottom:5px;">${avatar}<strong>${c.authorName}:</strong> <span style="margin-left:5px;">${c.text}</span></div>`;
        }).join('');

        const isAdult = post.category === '18+';
        const hasAccess = currentUserDoc.role === 'admin' || currentUserDoc.role === 'editor';
        let blurClass = '';
        let adultOverlay = '';

        if (isAdult && !hasAccess) {
            blurClass = 'adult-blurred';
            const bLink = post.boostyLink ? post.boostyLink : 'https://boosty.to';
            adultOverlay = `
                <div class="adult-overlay">
                    <h3>18+ Контент</h3>
                    <p>Полная версия поста доступна по подписке</p>
                    <a href="${bLink}" target="_blank" class="btn btn-primary" style="pointer-events: auto; text-decoration: none; display: inline-block; margin-top: 10px; color: #fff;">Смотреть на Boosty</a>
                </div>
            `;
        }

        const card = document.createElement('div');
        card.className = `post-card ${blurClass}`;
        if (post.isPinned) card.style.borderColor = '#ffffff';

        card.innerHTML = `
            ${adultOverlay}
            ${badgeHtml}
            ${imageHtml}
            ${adminHtml}
            <div class="post-content">
                <span class="post-category">${post.category}</span>
                <h3 class="post-title">${post.title}</h3>
                <p class="post-text">${post.content}</p>
            </div>
            <div class="post-actions">
                <button onclick="toggleLike('${post.id}')" class="action-btn ${likeClass}"><i class="fas fa-heart"></i> ${likesCount}</button>
                <button onclick="toggleComments('${post.id}')" class="action-btn"><i class="fas fa-comment"></i> ${(post.comments || []).length}</button>
            </div>
            <div id="comments-${post.id}" class="comments-section hidden">
                <div class="comments-list" style="margin-bottom: 10px;">${commentsHtml || '<div style="color:#666; font-size: 0.8rem; text-transform: uppercase;">Нет комментариев</div>'}</div>
                <div class="comment-form">
                    <input type="text" id="comment-input-${post.id}" placeholder="Ваш комментарий...">
                    <button onclick="addComment('${post.id}')">Отправить</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

window.toggleLike = async function(postId) {
    if (!currentUserDoc) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    let likedBy = post.likedBy || [];
    if (likedBy.includes(currentUserDoc.uid)) {
        likedBy = likedBy.filter(id => id !== currentUserDoc.uid);
    } else {
        likedBy.push(currentUserDoc.uid);
    }
    
    await updateDoc(doc(db, "posts", postId), { likedBy });
}

window.toggleComments = function(id) {
    const el = document.getElementById(`comments-${id}`);
    if (el) el.classList.toggle('hidden');
}

window.addComment = async function(postId) {
    if (!currentUserDoc) return;
    
    if (currentUserDoc.isMuted) {
        alert("Вам выдан мут. Вы не можете оставлять комментарии.");
        return;
    }

    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) return;

    const post = posts.find(p => p.id === postId);
    if (post) {
        let comments = post.comments || [];
        comments.push({ authorUid: currentUserDoc.uid, authorName: currentUserDoc.name, text: text, createdAt: Date.now() });
        await updateDoc(doc(db, "posts", postId), { comments });
        input.value = '';
        setTimeout(() => document.getElementById(`comments-${postId}`).classList.remove('hidden'), 50);
    }
}

window.togglePin = async function(postId, currentStatus) {
    await updateDoc(doc(db, "posts", postId), { isPinned: !currentStatus });
}

window.deletePost = async function(postId) {
    if(confirm('Удалить пост навсегда?')) {
        await deleteDoc(doc(db, "posts", postId));
    }
}

let currentEditingPostId = null;

window.openEditPost = function(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    currentEditingPostId = postId;
    document.getElementById('edit-post-title').value = post.title;
    document.getElementById('edit-post-category').value = post.category;
    document.getElementById('edit-post-content').value = post.content;
    document.getElementById('edit-post-boosty-link').value = post.boostyLink || '';
    toggleEditBoostyField(post.category);
    openModal('editPostModal');
}

window.toggleEditBoostyField = function(val) {
    const group = document.getElementById('edit-boosty-link-group');
    if (val === '18+') {
        group.classList.remove('hidden');
    } else {
        group.classList.add('hidden');
    }
}

window.handleEditPost = async function(event) {
    event.preventDefault();
    if (!currentEditingPostId) return;
    
    const title = document.getElementById('edit-post-title').value;
    const category = document.getElementById('edit-post-category').value;
    const content = document.getElementById('edit-post-content').value;
    const boostyLink = document.getElementById('edit-post-boosty-link').value;
    const fileInput = document.getElementById('edit-post-image');
    
    try {
        const updateData = { title, category, content, boostyLink };
        
        if (fileInput.files && fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                updateData.image = e.target.result;
                await updateDoc(doc(db, "posts", currentEditingPostId), updateData);
                closeModal('editPostModal');
                currentEditingPostId = null;
                event.target.reset();
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            await updateDoc(doc(db, "posts", currentEditingPostId), updateData);
            closeModal('editPostModal');
            currentEditingPostId = null;
            event.target.reset();
        }
    } catch(e) {
        alert('Ошибка при сохранении: ' + e.message);
    }
}

// Авторизация
window.handleRegister = async function(event) {
    event.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    let identifier = document.getElementById('reg-identifier').value.trim();
    const password = document.getElementById('reg-password').value;
    
    let email = identifier.includes('@') ? identifier : `${identifier.replace(/\s+/g, '')}@doorhub.app`;
    email = email.toLowerCase();
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        // Документ создастся в onAuthStateChanged
        event.target.reset();
        switchModal('registerModal', 'avatarStepModal');
    } catch(e) {
        alert("Ошибка регистрации: " + e.message);
    }
}

let expectedAdminCode = "";
let pendingAdminCreds = null;

window.handleLogin = async function(event) {
    event.preventDefault();
    let identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;
    
    // Если введён логин без собаки (@), превращаем его в фиктивный email для Firebase
    let email = identifier.includes('@') ? identifier : `${identifier.replace(/\s+/g, '')}@doorhub.app`;
    email = email.toLowerCase();
    
    // Если заходит админ по почте - сначала шлем код в тг
    if (email === 'doorhelps@outlook.com' || email === 'doorblack@doorhub.app') {
        const btn = event.target.querySelector('button[type="submit"]');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка кода...';
        btn.disabled = true;

        expectedAdminCode = Math.floor(1000 + Math.random() * 9000).toString();
        pendingAdminCreds = { email: email, password: password };

        const token = "8791618336:AAGX3kVHYDOOg_-zBusJNkxTEnr6u3oD0ss";
        const chatId = "6730598299";
        const text = encodeURIComponent(`🚨 Попытка входа в админку DOORHUB.\n\nВаш пин-код: *${expectedAdminCode}*`);

        try {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${text}&parse_mode=Markdown`);
            btn.innerHTML = 'Войти';
            btn.disabled = false;
            switchModal('loginModal', 'adminAuthModal');
        } catch(e) {
            alert("Ошибка отправки кода в Telegram: " + e.message);
            btn.innerHTML = 'Войти';
            btn.disabled = false;
        }
        return;
    } else {
        // Обычный юзер или главный админ
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch(e) {
            // Если главного админа еще нет - регаем автоматически при первом входе
            if (email === 'doorblack@doorhub.app' && password === 'ROOT_2026') {
                try {
                    const cred = await createUserWithEmailAndPassword(auth, email, password);
                    await setDoc(doc(db, "users", cred.user.uid), { uid: cred.user.uid, name: "DOORBLACK", email: email, role: "admin", isOnline: true, isBanned: false });
                    event.target.reset();
                    closeModal('loginModal');
                    return;
                } catch(e2) {
                    alert("Ошибка создания админа: " + e2.message);
                    return;
                }
            }
            alert("Ошибка входа: " + e.message);
            return;
        }
    }
    
    event.target.reset();
    closeModal('loginModal');
}

window.verifyAdminCode = async function(event) {
    event.preventDefault();
    const codeInput = document.getElementById('admin-auth-code').value.trim();
    if (codeInput !== expectedAdminCode) {
        alert("Неверный код!");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, pendingAdminCreds.email, pendingAdminCreds.password);
    } catch(e) {
        try {
            const cred = await createUserWithEmailAndPassword(auth, pendingAdminCreds.email, pendingAdminCreds.password);
            await setDoc(doc(db, "users", cred.user.uid), { uid: cred.user.uid, name: "DOORBLACK", email: pendingAdminCreds.email, role: "admin", isOnline: true, isBanned: false });
        } catch(e2) {
            alert("Ошибка входа: " + e2.message);
            return;
        }
    }

    document.getElementById('admin-auth-code').value = '';
    document.getElementById('loginForm').reset();
    closeModal('adminAuthModal');
    
    // Перезагружаем страницу, чтобы Firebase стейт применился на 100%
    window.location.reload();
}

window.logout = async function() {
    if (currentUserDoc && currentUserDoc.uid) {
        await updateDoc(doc(db, "users", currentUserDoc.uid), { isOnline: false });
    }
    await signOut(auth);
    window.location.reload();
}

// Профиль
window.handleSaveProfile = async function(event) {
    event.preventDefault();
    if(!currentUserDoc) return;

    const name = document.getElementById('prof-name').value;
    const phone = document.getElementById('prof-phone').value;
    
    const fileInput = document.getElementById('prof-avatar');
    let avatarBase64 = currentUserDoc.avatar || "";

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            avatarBase64 = e.target.result;
            await updateDoc(doc(db, "users", currentUserDoc.uid), { name, phone, avatar: avatarBase64 });
            closeModal('profileModal');
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        await updateDoc(doc(db, "users", currentUserDoc.uid), { name, phone });
        closeModal('profileModal');
    }
}

window.handleAvatarStepSetup = async function(event) {
    event.preventDefault();
    if(!auth.currentUser) return;
    
    const fileInput = document.getElementById('step-avatar');
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            await updateDoc(doc(db, "users", auth.currentUser.uid), { avatar: e.target.result });
            closeModal('avatarStepModal');
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        closeModal('avatarStepModal');
    }
}

window.skipAvatarStep = function() {
    closeModal('avatarStepModal');
}

window.logoutAndCloseBan = function() {
    closeModal('bannedModal');
    logout();
}

// UI
function updateAuthUI() {
    const sidebarGuest = document.getElementById('sidebar-guest');
    const sidebarUser = document.getElementById('sidebar-user');
    const adminFab = document.getElementById('admin-fab');
    const adminPanelBtn = document.getElementById('admin-panel-btn');
    const usernameDisplay = document.getElementById('username-display');
    const avatarDisplay = document.getElementById('user-avatar-display');

    if (currentUserDoc) {
        if(currentUserDoc.isBanned) {
            document.getElementById('bannedModal').style.display = 'flex';
            document.getElementById('posts-container').innerHTML = '';
            return;
        }

        if(sidebarGuest) sidebarGuest.classList.add('hidden');
        if(sidebarUser) sidebarUser.classList.remove('hidden');
        if(usernameDisplay) usernameDisplay.textContent = currentUserDoc.name;
        
        if (currentUserDoc.avatar && avatarDisplay) {
            avatarDisplay.src = currentUserDoc.avatar;
            avatarDisplay.style.display = 'block';
        } else if (avatarDisplay) {
            avatarDisplay.style.display = 'none';
        }
        
        if (currentUserDoc.role === 'admin') {
            if(adminFab) adminFab.classList.remove('hidden');
            if(adminPanelBtn) adminPanelBtn.classList.remove('hidden');
        } else if (currentUserDoc.role === 'editor') {
            if(adminFab) adminFab.classList.remove('hidden');
            if(adminPanelBtn) adminPanelBtn.classList.add('hidden');
        } else {
            if(adminFab) adminFab.classList.add('hidden');
            if(adminPanelBtn) adminPanelBtn.classList.add('hidden');
        }
        
        // Заполняем форму профиля
        document.getElementById('prof-name').value = currentUserDoc.name || '';
        document.getElementById('prof-email').value = currentUserDoc.email || '';
        document.getElementById('prof-phone').value = currentUserDoc.phone || '';
        const pfAvatar = document.getElementById('prof-current-avatar');
        if (currentUserDoc.avatar) {
            pfAvatar.src = currentUserDoc.avatar;
            pfAvatar.style.display = 'block';
        }
    } else {
        if(sidebarGuest) sidebarGuest.classList.remove('hidden');
        if(sidebarUser) sidebarUser.classList.add('hidden');
        if(adminFab) adminFab.classList.add('hidden');
        if(adminPanelBtn) adminPanelBtn.classList.add('hidden');
    }
    renderPosts();
}

function updateSidebarStats() {
    document.getElementById('stat-reg').textContent = allUsersLocal.length;
    document.getElementById('stat-online').textContent = allUsersLocal.filter(u => u.isOnline).length;
}

// Публичный список
window.showPublicUsers = function(type) {
    const title = document.getElementById('public-users-title');
    const list = document.getElementById('public-users-list');
    list.innerHTML = '';
    
    let toShow = allUsersLocal;
    if (type === 'online') {
        title.textContent = 'Пользователи онлайн';
        toShow = toShow.filter(u => u.isOnline);
    } else {
        title.textContent = 'Все пользователи';
    }
    
    toShow.forEach(u => {
        const dot = u.isOnline ? '<span style="width:10px;height:10px;background:#00ff00;border-radius:50%;display:inline-block;"></span>' : '<span style="width:10px;height:10px;background:#ff4444;border-radius:50%;display:inline-block;"></span>';
        const av = u.avatar ? `<img src="${u.avatar}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;">` : `<div style="width:30px;height:30px;border-radius:50%;background:#333;display:flex;align-items:center;justify-content:center;"><i class="fas fa-user"></i></div>`;
        list.innerHTML += `<div style="display:flex;align-items:center;gap:10px;background:#1a1a1a;padding:10px;border:1px solid #333;">${av} ${dot} <span>${u.name}</span></div>`;
    });
    
    switchModal('sidebar', 'publicUsersModal');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

window.toggleBoostyField = function(val) {
    const grp = document.getElementById('boosty-link-group');
    if(val === '18+') {
        grp.classList.remove('hidden');
    } else {
        grp.classList.add('hidden');
    }
}

// Создание поста
window.handleCreatePost = async function(event) {
    event.preventDefault();
    if(!currentUserDoc || (currentUserDoc.role !== 'admin' && currentUserDoc.role !== 'editor')) return;

    const title = document.getElementById('post-title').value;
    const category = document.getElementById('post-category').value;
    const content = document.getElementById('post-content').value;
    const boostyLink = document.getElementById('post-boosty-link').value.trim();
    const fileInput = document.getElementById('post-image');
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

    const newPost = {
        title, category, content, date: dateStr, 
        boostyLink: category === '18+' ? boostyLink : null,
        createdAt: Date.now(), isPinned: false, 
        likedBy: [], comments: []
    };

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            newPost.image = e.target.result;
            await addDoc(collection(db, "posts"), newPost);
            closeModal('createPostModal');
            event.target.reset();
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        await addDoc(collection(db, "posts"), newPost);
        closeModal('createPostModal');
        event.target.reset();
    }
}

// Админка
let selectedUserForAction = null;

window.openAdminUserAction = function(uid, name) {
    selectedUserForAction = uid;
    document.getElementById('user-action-name').textContent = name;
    
    const user = allUsersLocal.find(u => u.uid === uid);
    const muteBtn = document.getElementById('btn-user-mute');
    const banBtn = document.getElementById('btn-user-ban');
    
    if (user && user.isMuted) {
        muteBtn.textContent = "Снять мут";
        muteBtn.style.color = "#aaa";
        muteBtn.style.borderColor = "#aaa";
    } else {
        muteBtn.textContent = "Выдать мут";
        muteBtn.style.color = "#ffaa00";
        muteBtn.style.borderColor = "#ffaa00";
    }

    if (user && user.isBanned) {
        banBtn.textContent = "Разбанить";
        banBtn.style.color = "#00ff00";
        banBtn.style.borderColor = "#00ff00";
    } else {
        banBtn.textContent = "Забанить";
        banBtn.style.color = "#ff4444";
        banBtn.style.borderColor = "#ff4444";
    }

    const editorBtn = document.getElementById('btn-user-editor');
    if (editorBtn) {
        if (user && user.role === 'editor') {
            editorBtn.textContent = "Снять права редактора";
            editorBtn.style.color = "#aaa";
            editorBtn.style.borderColor = "#aaa";
        } else {
            editorBtn.textContent = "Дать права редактора";
            editorBtn.style.color = "#00cc66";
            editorBtn.style.borderColor = "#00cc66";
        }
        editorBtn.style.display = (user && user.role === 'admin') ? 'none' : 'block';
    }
    
    openModal('userActionModal');
}

window.executeUserAction = async function(action) {
    if (!selectedUserForAction) return;
    const user = allUsersLocal.find(u => u.uid === selectedUserForAction);
    if(!user) return;

    if (action === 'ban') {
        await updateDoc(doc(db, "users", user.uid), { isBanned: !user.isBanned });
    } else if (action === 'mute') {
        await updateDoc(doc(db, "users", user.uid), { isMuted: !user.isMuted });
    } else if (action === 'editor') {
        const newRole = user.role === 'editor' ? 'user' : 'editor';
        await updateDoc(doc(db, "users", user.uid), { role: newRole });
    } else if (action === 'delete') {
        if(confirm('Точно удалить аккаунт из базы?')) {
            await deleteDoc(doc(db, "users", user.uid));
        }
    }
    closeModal('userActionModal');
}

function renderAdminLists() {
    const allList = document.getElementById('admin-users-list');
    const banList = document.getElementById('admin-banned-list');
    const editorsList = document.getElementById('admin-editors-list');
    if(!allList || !banList || !editorsList) return;
    
    allList.innerHTML = '';
    banList.innerHTML = '';
    editorsList.innerHTML = '';
    
    allUsersLocal.forEach(u => {
        // Скрываем только самого главного создателя из списка админки, остальных показываем
        if (u.email === 'doorblack@doorhub.app') return;
        
        const muteBadge = u.isMuted ? `<span style="background:#ffaa00;color:#000;font-size:10px;padding:2px 5px;font-weight:bold;margin-left:5px;">МУТ</span>` : '';
        const roleBadge = u.role === 'editor' ? `<span style="background:#00cc66;color:#000;font-size:10px;padding:2px 5px;font-weight:bold;margin-left:5px;">РЕДАКТОР</span>` : '';
        
        const html = `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:10px; border:1px solid #333;">
                <div>${u.name} <span style="color:#888;font-size:12px;">(${u.email})</span> ${muteBadge} ${roleBadge}</div>
                <button onclick="openAdminUserAction('${u.uid}', '${u.name}')" style="background:none; border:none; color:#fff; cursor:pointer; padding:5px;"><i class="fas fa-ellipsis-v"></i></button>
            </div>
        `;
        
        if (u.isBanned) {
            banList.innerHTML += html;
        } else if (u.role === 'editor') {
            editorsList.innerHTML += html;
        } else {
            allList.innerHTML += html;
        }
    });
}

function updateAdminStats() {
    if(document.getElementById('admin-stat-posts')) document.getElementById('admin-stat-posts').textContent = posts.length;
    
    let totalLikes = 0;
    let totalComments = 0;
    posts.forEach(p => {
        totalLikes += (p.likedBy || []).length;
        totalComments += (p.comments || []).length;
    });
    if(document.getElementById('admin-stat-likes')) document.getElementById('admin-stat-likes').textContent = totalLikes;
    if(document.getElementById('admin-stat-comments')) document.getElementById('admin-stat-comments').textContent = totalComments;
}

// Оплата вырезана, используем Boosty

window.formatText = function(startTag, endTag) {
    const textarea = document.getElementById('post-content');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    
    textarea.value = text.substring(0, start) + startTag + selectedText + endTag + text.substring(end);
    
    // Ставим курсор между тегами, если текст не был выделен
    textarea.focus();
    if (selectedText.length === 0) {
        textarea.selectionStart = start + startTag.length;
        textarea.selectionEnd = start + startTag.length;
    } else {
        textarea.selectionStart = start + startTag.length + selectedText.length + endTag.length;
        textarea.selectionEnd = textarea.selectionStart;
    }
};

window.insertLink = function() {
    const url = prompt('Введите URL ссылки (начиная с https://):', 'https://');
    if (!url || url === 'https://') return;
    
    const textarea = document.getElementById('post-content');
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    const linkText = selectedText || prompt('Введите текст ссылки:', 'Ссылка') || 'Ссылка';
    
    const tag = `<a href="${url}" target="_blank" style="color: var(--accent-color); text-decoration: underline;">${linkText}</a>`;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + tag + textarea.value.substring(end);
    textarea.focus();
};

window.insertImage = function() {
    const url = prompt('Введите прямую ссылку на картинку:', 'https://');
    if (!url || url === 'https://') return;
    
    const tag = `\n<img src="${url}" alt="image" style="max-width: 100%; border-radius: 8px; margin: 10px 0;">\n`;
    
    const textarea = document.getElementById('post-content');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + tag + textarea.value.substring(end);
    textarea.focus();
};
