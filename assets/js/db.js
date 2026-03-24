const GAS_URL = 'https://script.google.com/macros/s/AKfycbyzIpFKSHV_nJ95yGgD957IfTImo_d3MjSLViC7Z_8wLAYK53RM2BJGd8h4l5bKil_1Aw/exec';

const DB = {
    user: null,

    init: function() {
        const storedUser = localStorage.getItem('social_worker_user');
        if (storedUser) {
            this.user = JSON.parse(storedUser);
            this.syncData(); // Added to keep notes up to date across devices
            return true;
        }
        return false;
    },

    login: async function(name, password) {
        try {
            const url = `${GAS_URL}?action=login&name=${encodeURIComponent(name)}&password=${encodeURIComponent(password)}`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data && data.success) {
                this.user = { name, userId: data.userId, isLogged: true };
                localStorage.setItem('social_worker_user', JSON.stringify(this.user));
                await this.syncData();
                return true;
            } else {
                // If login fails, try to register
                const regUrl = `${GAS_URL}`;
                const regRes = await fetch(regUrl, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'register', name, password }),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                const regData = await regRes.json();
                if(regData && regData.success) {
                    this.user = { name, userId: regData.userId, isLogged: true };
                    localStorage.setItem('social_worker_user', JSON.stringify(this.user));
                    await this.syncData();
                    return true;
                } else {
                    console.error('GAS Login/Register failed', data.error || data.message || regData.message);
                    alert(data.error || data.message || regData.message || '로그인/회원가입 실패');
                    return false;
                }
            }
        } catch (e) {
            console.error('Login error', e);
            alert('인터넷 연결을 확인해주세요.');
            return false;
        }
    },

    logout: function() {
        this.user = null;
        localStorage.removeItem('social_worker_user');
        window.location.href = 'index.html';
    },

    getUser: function() {
        return this.user;
    },

    syncData: async function() {
        if(!this.user) return;
        try {
            const res = await fetch(`${GAS_URL}?action=getWrong&userId=${this.user.userId}`);
            const data = await res.json();
            if(data && data.success) {
                const allFetched = data.data.map(item => {
                    try { return JSON.parse(item.memo); } catch(e) { return null; }
                }).filter(n => n!==null);

                const examOxNotes = allFetched.filter(n => n.type !== 'term');
                const terms = allFetched.filter(n => n.type === 'term');

                if (examOxNotes.length > 0 || data.data.length === 0) {
                     localStorage.setItem(`notes_${this.user.name}`, JSON.stringify(examOxNotes));
                }
                if (terms.length > 0 || data.data.length === 0) {
                     localStorage.setItem(`terms_${this.user.name}`, JSON.stringify(terms));
                }
            }
        } catch(e) {
            console.error('Sync failed', e);
        }
    },

    saveScore: async function(mode, subject, score, total, wrongIds) {
        if (!this.user) return;
        try {
            fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'saveScore',
                    userId: this.user.userId,
                    mode, subject, score, total, wrongIds: JSON.stringify(wrongIds),
                    date: new Date().toISOString()
                }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
        } catch(e) { console.error(e); }
    },

    saveIncorrect: async function(type, questionData) {
        if (!this.user) return;
        
        let notes = JSON.parse(localStorage.getItem(`notes_${this.user.name}`) || '[]');
        const exists = notes.find(n => n.question === questionData.question);
        
        if(!exists) {
            const newItem = {
                id: Date.now(),
                type: type,
                date: new Date().toISOString(),
                ...questionData
            };
            notes.push(newItem);
            localStorage.setItem(`notes_${this.user.name}`, JSON.stringify(notes));

            try {
                fetch(GAS_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'saveWrong',
                        userId: this.user.userId,
                        questionId: newItem.id,
                        questionText: (questionData.question || '').substring(0, 50),
                        subject: questionData.subject || questionData.category || (type === 'ox' ? 'OX Quiz' : 'Exam'),
                        memo: JSON.stringify(newItem) // store full object in memo to sync back easily
                    }),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
            } catch(e) { console.error("GAS sync failed", e); }
        }
    },

    getNotes: function() {
        if (!this.user) return [];
        return JSON.parse(localStorage.getItem(`notes_${this.user.name}`) || '[]');
    },

    removeNote: function(id) {
        if (!this.user) return;
        let notes = this.getNotes();
        notes = notes.filter(n => String(n.id) !== String(id));
        localStorage.setItem(`notes_${this.user.name}`, JSON.stringify(notes));

        try {
            fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'deleteWrong',
                    userId: this.user.userId,
                    questionId: id
                }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
        } catch(e) { console.error(e); }
    },

    saveTerm: async function(termObj) {
        if (!this.user) return;
        
        let terms = JSON.parse(localStorage.getItem(`terms_${this.user.name}`) || '[]');
        terms.push(termObj);
        localStorage.setItem(`terms_${this.user.name}`, JSON.stringify(terms));

        try {
            fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'saveWrong',
                    userId: this.user.userId,
                    questionId: termObj.id,
                    questionText: (termObj.term || '').substring(0, 50),
                    subject: '단어/용어 정리',
                    memo: JSON.stringify(termObj)
                }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
        } catch(e) { console.error("GAS sync failed", e); }
    },

    removeTerm: function(id) {
        if (!this.user) return;
        let terms = JSON.parse(localStorage.getItem(`terms_${this.user.name}`) || '[]');
        terms = terms.filter(t => String(t.id) !== String(id));
        localStorage.setItem(`terms_${this.user.name}`, JSON.stringify(terms));

        try {
            fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'deleteWrong',
                    userId: this.user.userId,
                    questionId: id
                }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
        } catch(e) { console.error(e); }
    },

    removeNotes: async function(ids) {
        if (!this.user || !ids || ids.length === 0) return;
        
        // Local update
        let notes = this.getNotes();
        const idSet = new Set(ids.map(id => String(id)));
        notes = notes.filter(n => !idSet.has(String(n.id)));
        localStorage.setItem(`notes_${this.user.name}`, JSON.stringify(notes));

        // Backend update (Parallel requests for now, as backend doesn't have bulk endpoint)
        // We limit parallel requests to avoid hitting rate limits or crashing the browser
        const CHUNK_SIZE = 5;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(id => {
                return fetch(GAS_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'deleteWrong',
                        userId: this.user.userId,
                        questionId: id
                    }),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                }).catch(e => console.error(`Failed to delete note ${id}`, e));
            }));
        }
    }
};

function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.remove('hidden');
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}
