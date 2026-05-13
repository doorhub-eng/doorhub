const SUPABASE_URL = 'https://ryzaoxategadqatpocli.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emFveGF0ZWdhZHFhdHBvY2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODEwNjksImV4cCI6MjA5NDI1NzA2OX0.letvD-sgCVABNUlMMRZpANn7mitw7_Wk8S5gaZWied4';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Рисуем кнопку меню МОМЕНТАЛЬНО, не дожидаясь ответа от БД
    updateNav();

    try {
        // Получаем текущую сессию
        const { data: { session } } = await supabase.auth.getSession();
    currentUser = session ? session.user : null;
    updateNav();

    // Слушаем изменения авторизации (вход/выход)
    supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session ? session.user : null;
        updateNav();
    });

        const path = window.location.pathname;
        // Определяем на какой мы странице и запускаем нужную логику
        if (path.includes('auth.html')) initAuth();
        else if (path.includes('profile.html')) initProfile();
        else initFeed();
    } catch (e) {
        console.error("Ошибка при инициализации:", e);
        const path = window.location.pathname;
        if (!path.includes('auth.html') && !path.includes('profile.html')) initFeed();
    }
});

function updateNav() {
    const nav = document.getElementById('nav-auth-state');
    if (!nav) return;
    
    let menuHtml = `
      <button class="hamburger-btn" onclick="openSidebar()" title="Меню">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="5" width="20" height="3" rx="0.5"></rect>
          <rect x="2" y="10.5" width="20" height="3" rx="0.5"></rect>
          <rect x="2" y="16" width="20" height="3" rx="0.5"></rect>
        </svg>
      </button>

      <div id="sidebar-overlay" class="sidebar-overlay" onclick="closeSidebar()"></div>

      <div id="sidebar-menu" class="sidebar-menu">
        <button class="close-btn" onclick="closeSidebar()">✕</button>
        <div class="sidebar-links">
    `;
    
    if (currentUser) {
        menuHtml += `
          <a href="profile.html">Личный кабинет</a>
          <a href="#" onclick="supabase.auth.signOut(); window.location.href='index.html'; return false;">Выйти</a>
        `;
    } else {
        menuHtml += `
          <a href="auth.html">Вход / Регистрация</a>
        `;
    }
    
    menuHtml += `</div></div>`;
    nav.innerHTML = menuHtml;
}

window.openSidebar = function() {
    document.getElementById("sidebar-menu").classList.add("active");
    document.getElementById("sidebar-overlay").classList.add("active");
}

window.closeSidebar = function() {
    document.getElementById("sidebar-menu").classList.remove("active");
    document.getElementById("sidebar-overlay").classList.remove("active");
}

// ================= AUTH =================
window.switchAuthTab = function(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
}

function initAuth() {
    if (currentUser) window.location.href = 'profile.html';

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errObj = document.getElementById('login-error');
        errObj.textContent = 'Вход...';
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) errObj.textContent = 'Ошибка: ' + error.message;
        else window.location.href = 'profile.html';
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errObj = document.getElementById('reg-error');
        errObj.textContent = 'Регистрация...';
        const nickname = document.getElementById('reg-nickname').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) { errObj.textContent = 'Ошибка: ' + error.message; return; }

        if (data.user) {
            // Создаем профиль юзеру
            await supabase.from('profiles').insert([{
                id: data.user.id,
                nickname: nickname
            }]);
            window.location.href = 'profile.html';
        }
    });
}

// ================= PROFILE =================
async function initProfile() {
    if (!currentUser) { window.location.href = 'auth.html'; return; }

    // Грузим данные профиля
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile) {
        document.getElementById('prof-nickname').value = profile.nickname || '';
        document.getElementById('prof-phone').value = profile.phone || '';
        if (profile.avatar_url) document.getElementById('prof-avatar-preview').src = profile.avatar_url;
    }

    // Автосохранение аватарки сразу при выборе файла
    document.getElementById('prof-avatar-upload').addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const avatarUrl = await uploadFile('avatars', e.target.files[0]);
            if (avatarUrl) {
                document.getElementById('prof-avatar-preview').src = avatarUrl;
                await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', currentUser.id);
            }
        }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });

    document.getElementById('btn-delete-acc').addEventListener('click', async () => {
        if(confirm('Точно удалить аккаунт? Посты останутся, но профиль сотрется.')){
            await supabase.from('profiles').delete().eq('id', currentUser.id);
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        }
    });

    // Создание поста
    document.getElementById('btn-create-post').addEventListener('click', async () => {
        const btn = document.getElementById('btn-create-post');
        const title = document.getElementById('post-title').value;
        const content = document.getElementById('post-content').value;
        const category = document.getElementById('post-category').value;
        const fileInput = document.getElementById('post-image');

        if (!title || !content) return alert('Заполни заголовок и текст');
        
        btn.textContent = 'Публикация...';
        btn.disabled = true;

        let imageUrl = null;
        if (fileInput.files.length > 0) {
            imageUrl = await uploadFile('post_images', fileInput.files[0]);
        }

        await supabase.from('posts').insert([{
            author_id: currentUser.id,
            title, content, category, image_url: imageUrl
        }]);

        document.getElementById('post-title').value = '';
        document.getElementById('post-content').value = '';
        fileInput.value = '';
        btn.textContent = 'Опубликовать';
        btn.disabled = false;
        
        // Закрываем модалку после публикации
        document.getElementById('post-modal').style.display = 'none';
        
        loadMyPosts();
    });

    loadMyPosts();
}

async function loadMyPosts() {
    const list = document.getElementById('my-posts-list');
    const { data } = await supabase.from('posts').select('*').eq('author_id', currentUser.id).order('created_at', { ascending: false });
    
    if (!data || !data.length) {
        list.innerHTML = '<p style="color:var(--text-muted)">У вас пока нет постов.</p>';
        return;
    }

    list.innerHTML = data.map(p => `
        <div class="post-card" style="margin-bottom: 10px; padding: 15px;">
            <h4>${p.title}</h4>
            <span style="font-size:12px; color:#888">${new Date(p.created_at).toLocaleString()}</span>
            <div class="post-actions">
                <button onclick="deletePost('${p.id}')">Удалить</button>
            </div>
        </div>
    `).join('');
}

window.deletePost = async function(id) {
    if(confirm('Удалить пост?')){
        await supabase.from('posts').delete().eq('id', id);
        loadMyPosts();
    }
}

// ================= FEED =================
async function initFeed() {
    const feed = document.getElementById('posts-feed');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');

    if (!feed) return;

    async function loadFeed() {
        feed.innerHTML = '<p class="loading">Загрузка постов...</p>';
        
        let query = supabase.from('posts').select('*, profiles(nickname, avatar_url)');
        
        // Поиск
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            query = query.ilike('title', `%${searchTerm}%`);
        }

        // Сортировка
        const sortMode = sortSelect.value;
        if (sortMode === 'new') {
            query = query.order('created_at', { ascending: false });
        } else if (sortMode === 'old') {
            query = query.order('created_at', { ascending: true });
        } else if (sortMode === 'popular') {
            query = query.order('views', { ascending: false }).order('created_at', { ascending: false });
        }

        const { data, error } = await query;

        if (error || !data) {
            feed.innerHTML = '<p class="error-msg">Ошибка загрузки постов. База не настроена?</p>';
            return;
        }
        
        if (data.length === 0) {
            feed.innerHTML = '<p style="color: #fff; text-align: center; padding: 2rem; font-size: 1.1rem;">Посты не найдены.</p>';
            return;
        }

        feed.innerHTML = data.map(p => `
            <div class="post-card">
                <div class="post-header">
                    <img src="${p.profiles?.avatar_url || 'https://via.placeholder.com/40'}" class="post-author-ava">
                    <div class="post-meta">
                        <h4>${p.profiles?.nickname || 'Аноним'}</h4>
                        <span>${new Date(p.created_at).toLocaleString()} | ${p.category || 'Без категории'}</span>
                    </div>
                </div>
                <div class="post-body">
                    <h3>${p.title}</h3>
                    <p>${p.content}</p>
                    ${p.image_url ? `<img src="${p.image_url}" class="post-image">` : ''}
                </div>
            </div>
        `).join('');
    }

    // Слушатели событий
    searchInput.addEventListener('input', () => {
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(loadFeed, 500);
    });

    sortSelect.addEventListener('change', loadFeed);

    // Первичная загрузка
    loadFeed();
}

// ================= UTILS =================
async function uploadFile(bucket, file) {
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
    
    const { error } = await supabase.storage.from(bucket).upload(fileName, file);
    if (error) { alert('Ошибка загрузки: ' + error.message); return null; }
    
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
}