let currentTab = 'exam'; // 'exam', 'ox', or 'terms'

const UIElem = {
    tabs: document.querySelectorAll('.auth-tab'),
    contentExam: document.getElementById('content-exam'),
    contentOx: document.getElementById('content-ox'),
    contentTerms: document.getElementById('content-terms'),
    examList: document.getElementById('exam-list'),
    oxList: document.getElementById('ox-list'),
    termList: document.getElementById('term-list')
};

function initTabs() {
    UIElem.tabs.forEach(t => {
        t.addEventListener('click', () => {
            UIElem.tabs.forEach(tab => tab.classList.remove('active'));
            t.classList.add('active');
            
            const target = t.getAttribute('data-target');
            currentTab = target;
            
            UIElem.contentExam.classList.add('hidden');
            UIElem.contentOx.classList.add('hidden');
            UIElem.contentTerms.classList.add('hidden');
            
            if(target === 'exam') UIElem.contentExam.classList.remove('hidden');
            if(target === 'ox') UIElem.contentOx.classList.remove('hidden');
            if(target === 'terms') UIElem.contentTerms.classList.remove('hidden');
            
            renderNotes();
        });
    });
}

function renderNotes() {
    if(currentTab === 'terms') {
        renderTerms();
        return;
    }

    const notes = DB.getNotes().filter(n => n.type === currentTab);
    const container = currentTab === 'exam' ? UIElem.examList : UIElem.oxList;
    
    container.innerHTML = '';
    
    if (notes.length === 0) {
        container.innerHTML = `<div class="text-center p-4 text-muted">저장된 오답이 없습니다.</div>`;
        return;
    }

    notes.sort((a,b) => new Date(b.date) - new Date(a.date)); // latest first

    notes.forEach(note => {
        const card = document.createElement('div');
        card.className = 'glass-card mb-4';
        
        const d = new Date(note.date);
        const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;

        if (currentTab === 'exam') {
            let optsHtml = '';
            note.options.forEach((opt, idx) => {
                const isAns = (idx + 1) == note.correct_answer;
                optsHtml += `
                    <div style="font-size:0.85rem; padding:4px 8px; border-radius:4px; margin-bottom:4px; background:${isAns?'var(--ok-bg)':'transparent'}; color:${isAns?'var(--ok)':'inherit'}; font-weight:${isAns?'700':'400'}">
                        ${idx+1}. ${opt}
                    </div>
                `;
            });
            
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="font-size:0.75rem;color:var(--text-light)">${dateStr}</span>
                    <button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem;color:var(--danger);border-color:var(--danger)" onclick="deleteNote(${note.id})"><i class="fas fa-trash"></i> 삭제</button>
                </div>
                <h4 class="text-primary mb-2" style="font-size:0.9rem">${note.question}</h4>
                <div class="mt-2" style="background:rgba(255,255,255,0.5);border:1px solid rgba(0,0,0,0.05);padding:10px;border-radius:8px">
                    ${optsHtml}
                </div>
            `;
        } else {
            // OX
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="font-size:0.75rem;color:var(--text-light)">${dateStr} | ${note.category}</span>
                    <button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem;color:var(--danger);border-color:var(--danger)" onclick="deleteNote(${note.id})"><i class="fas fa-trash"></i> 삭제</button>
                </div>
                <h4 class="text-primary mb-2" style="font-size:0.9rem">${note.question}</h4>
                <div class="mt-2" style="background:rgba(255,255,255,0.5);border:1px solid rgba(0,0,0,0.05);padding:10px;border-radius:8px;font-size:0.85rem">
                    <strong style="color:var(--ok)">정답: ${note.answer}</strong>
                    ${note.explanation ? `<div class="mt-2" style="color:var(--text-secondary)">${note.explanation}</div>` : ''}
                </div>
            `;
        }
        
        container.appendChild(card);
    });
}

function deleteNote(id) {
    if(confirm('이 항목을 삭제하시겠습니까?')) {
        DB.removeNote(id);
        renderNotes();
    }
}

// Terms functionality
function getTerms() {
    const user = DB.getUser();
    if(!user) return [];
    return JSON.parse(localStorage.getItem(`terms_${user.name}`) || '[]');
}

function saveTerm(term, definition) {
    const user = DB.getUser();
    if(!user) return;
    const terms = getTerms();
    terms.push({ id: Date.now(), term, definition, date: new Date().toISOString() });
    localStorage.setItem(`terms_${user.name}`, JSON.stringify(terms));
}

function removeTerm(id) {
    const user = DB.getUser();
    if(!user) return;
    let terms = getTerms();
    terms = terms.filter(t => t.id !== id);
    localStorage.setItem(`terms_${user.name}`, JSON.stringify(terms));
}

function addTermModal() {
    const term = prompt('추가할 용어를 입력하세요:');
    if(!term) return;
    const def = prompt('용어의 뜻이나 해설을 입력하세요:');
    if(!def) return;
    
    saveTerm(term, def);
    renderTerms();
    showToast('용어가 추가되었습니다.');
}

function renderTerms() {
    const container = UIElem.termList;
    container.innerHTML = '';
    const terms = getTerms();
    
    if (terms.length === 0) {
        container.innerHTML = `<div class="text-center p-4 text-muted">저장된 용어가 없습니다.<br><br><button class="btn btn-primary" onclick="addTermModal()">새 용어 추가</button></div>`;
        return;
    }
    
    container.innerHTML = `<div class="mb-4 text-right"><button class="btn btn-primary" onclick="addTermModal()"><i class="fas fa-plus"></i> 새 용어 추가</button></div>`;
    
    terms.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    terms.forEach(t => {
        const card = document.createElement('div');
        card.className = 'glass-card mb-3';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <h4 class="text-primary mb-1" style="font-size:1.1rem;margin-bottom:0.2rem">${t.term}</h4>
                    <p style="font-size:0.9rem;margin-bottom:0">${t.definition}</p>
                </div>
                <button class="btn" style="background:none;color:var(--danger);padding:4px" onclick="deleteTerm(${t.id})"><i class="fas fa-times"></i></button>
            </div>
        `;
        container.appendChild(card);
    });
}

function deleteTerm(id) {
    if(confirm('이 용어를 삭제하시겠습니까?')) {
        removeTerm(id);
        renderTerms();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if(!DB.init()) {
        window.location.href = 'index.html';
        return;
    }
    initTabs();
    renderNotes();
});
