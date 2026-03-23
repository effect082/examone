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
                // Convert to frontend note format
                const notes = data.data.map(item => ({
                    id: item.questionId,
                    type: item.subject === 'OX Quiz' ? 'ox' : 'exam',
                    date: item.savedAt,
                    question: item.questionText,
                    // Minimal reconstruct, since we just need display
                    options: [], answer: '', correct_answer: 0, category: item.subject
                }));
                // In a real app we'd merge cleanly. For now, just overriding is fine for simplified sync.
                // Or better, let's keep local format if they store full JSON in memo.
                // Wait, if memo stores full JSON, we can parse it!
                const parsedNotes = data.data.map(item => {
                    try { return JSON.parse(item.memo); } catch(e) { return null; }
                }).filter(n => n!==null);

                if (parsedNotes.length > 0) {
                     localStorage.setItem(`notes_${this.user.name}`, JSON.stringify(parsedNotes));
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
                        subject: type === 'ox' ? 'OX Quiz' : 'Exam',
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
        notes = notes.filter(n => n.id !== id);
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
