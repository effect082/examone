let currentTab = 'exam'; // 'exam', 'ox', or 'terms'
let selectedIds = new Set();

const UIElem = {
    tabs: document.querySelectorAll('.auth-tab'),
    contentExam: document.getElementById('content-exam'),
    contentOx: document.getElementById('content-ox'),
    contentTerms: document.getElementById('content-terms'),
    examList: document.getElementById('exam-list'),
    oxList: document.getElementById('ox-list'),
    termList: document.getElementById('term-list'),
    bulkBarExam: document.getElementById('bulk-bar-exam'),
    bulkBarOx: document.getElementById('bulk-bar-ox'),
    selectAllExam: document.getElementById('select-all-exam'),
    selectAllOx: document.getElementById('select-all-ox'),
    selectedCountExam: document.getElementById('selected-count-exam'),
    selectedCountOx: document.getElementById('selected-count-ox')
};

function initTabs() {
    UIElem.tabs.forEach(t => {
        t.addEventListener('click', () => {
            UIElem.tabs.forEach(tab => tab.classList.remove('active'));
            t.classList.add('active');
            
            const target = t.getAttribute('data-target');
            currentTab = target;
            selectedIds.clear(); // Clear selection when switching tabs
            updateBulkBar();
            
            UIElem.contentExam.classList.add('hidden');
            UIElem.contentOx.classList.add('hidden');
            UIElem.contentTerms.classList.add('hidden');
            
            if(target === 'exam') UIElem.contentExam.classList.remove('hidden');
            if(target === 'ox') UIElem.contentOx.classList.remove('hidden');
            if(target === 'terms') UIElem.contentTerms.classList.remove('hidden');
            
            renderNotes();
        });
    });

    if (UIElem.selectAllExam) UIElem.selectAllExam.addEventListener('change', (e) => toggleSelectAll(e.target.checked));
    if (UIElem.selectAllOx) UIElem.selectAllOx.addEventListener('change', (e) => toggleSelectAll(e.target.checked));
}

function renderNotes() {
    if(currentTab === 'terms') {
        renderTerms();
        return;
    }

    const allNotes = DB.getNotes();
    const notes = allNotes.filter(n => n.type === currentTab);
    const container = currentTab === 'exam' ? UIElem.examList : UIElem.oxList;
    
    container.innerHTML = '';
    
    if (notes.length === 0) {
        container.innerHTML = `<div class="text-center p-4 text-muted">저장된 오답이 없습니다.</div>`;
        updateBulkBar(0);
        return;
    }

    updateBulkBar(notes.length);
    notes.sort((a,b) => new Date(b.date) - new Date(a.date));

    notes.forEach(note => {
        const card = document.createElement('div');
        card.className = 'glass-card mb-4 selectable';
        
        const d = new Date(note.date);
        const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;

        const isSelected = selectedIds.has(Number(note.id));

        let contentInner = '';
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
            
            contentInner = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="font-size:0.75rem;color:var(--text-light)">${dateStr}</span>
                    <button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem;color:var(--danger);border-color:var(--danger)" onclick="window.deleteNote('${note.id}')"><i class="fas fa-trash"></i> 삭제</button>
                </div>
                <h4 class="text-primary mb-2" style="font-size:0.9rem">${note.question}</h4>
                <div class="mt-2" style="background:rgba(255,255,255,0.5);border:1px solid rgba(0,0,0,0.05);padding:10px;border-radius:8px">
                    ${optsHtml}
                </div>
            `;
        } else {
            // OX
            const category = note.category || note.subject || 'OX Quiz';
            contentInner = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="font-size:0.75rem;color:var(--text-light)">${dateStr} | ${category}</span>
                    <button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem;color:var(--danger);border-color:var(--danger)" onclick="window.deleteNote('${note.id}')"><i class="fas fa-trash"></i> 삭제</button>
                </div>
                <h4 class="text-primary mb-2" style="font-size:1rem">${note.question}</h4>
                <div style="display:flex;align-items:center;gap:15px;margin:10px 0">
                    <div style="display:flex;align-items:center;gap:5px">
                        <span style="color:var(--text-light);font-size:0.8rem">내 선택:</span>
                        <span class="badge" style="background:${(note.user_answer || '-') === 'O' ? 'var(--primary-light)' : 'var(--danger-light)'}; color:${(note.user_answer || '-') === 'O' ? 'var(--primary-dark)' : 'var(--danger)'}">
                            ${note.user_answer || '-'}
                        </span>
                    </div>
                    <div style="display:flex;align-items:center;gap:5px">
                        <span style="color:var(--text-light);font-size:0.8rem">정답:</span>
                        <span class="badge" style="background:var(--ok-bg);color:var(--ok)">${note.correct_answer || note.answer || '?'}</span>
                    </div>
                </div>
                <div style="background:var(--ok-bg);padding:12px;border-radius:8px;border-left:4px solid var(--ok);margin-top:10px">
                    <p style="font-size:0.9rem;margin-bottom:0;color:var(--ok);line-height:1.5"><strong>해설:</strong> ${note.explanation || '해설이 없습니다.'}</p>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="checkbox-wrapper">
                <input type="checkbox" class="note-checkbox custom-checkbox" data-id="${note.id}" ${isSelected?'checked':''}>
            </div>
            <div class="note-content-area" style="flex:1">
                ${contentInner}
            </div>
        `;

        // Handle card click for selection
        card.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.type === 'checkbox') return;
            const checkbox = card.querySelector('.note-checkbox');
            checkbox.checked = !checkbox.checked;
            handleSelectionChange(note.id, checkbox.checked);
        });

        // Handle checkbox click
        const checkbox = card.querySelector('.note-checkbox');
        checkbox.addEventListener('change', (e) => {
            handleSelectionChange(note.id, e.target.checked);
        });
        
        container.appendChild(card);
    });
}

function handleSelectionChange(id, isChecked) {
    if (isChecked) {
        selectedIds.add(Number(id));
    } else {
        selectedIds.delete(Number(id));
    }
    updateBulkBar();
}

function updateBulkBar(forceTotal) {
    const total = forceTotal !== undefined ? forceTotal : DB.getNotes().filter(n => n.type === currentTab).length;
    
    const bar = currentTab === 'exam' ? UIElem.bulkBarExam : UIElem.bulkBarOx;
    const countLabel = currentTab === 'exam' ? UIElem.selectedCountExam : UIElem.selectedCountOx;
    const selectAll = currentTab === 'exam' ? UIElem.selectAllExam : UIElem.selectAllOx;

    // Hide other bar
    if (UIElem.bulkBarExam) UIElem.bulkBarExam.classList.add('hidden');
    if (UIElem.bulkBarOx) UIElem.bulkBarOx.classList.add('hidden');

    if (total > 0 && bar) {
        bar.classList.remove('hidden');
        if (countLabel) countLabel.innerText = selectedIds.size > 0 ? `(${selectedIds.size}개 선택됨)` : '';
        if (selectAll) selectAll.checked = (selectedIds.size === total && total > 0);
    }
}

function toggleSelectAll(checked) {
    const notes = DB.getNotes().filter(n => n.type === currentTab);
    if (checked) {
        notes.forEach(n => selectedIds.add(Number(n.id)));
    } else {
        selectedIds.clear();
    }
    renderNotes();
}

window.deleteNote = async function(id) {
    if(confirm('이 항목을 삭제하시겠습니까?')) {
        showLoader();
        await DB.removeNote(Number(id));
        selectedIds.delete(Number(id));
        hideLoader();
        renderNotes();
        showToast('삭제되었습니다.');
    }
}

window.deleteSelected = async function() {
    if (selectedIds.size === 0) return;
    
    if(confirm(`선택한 ${selectedIds.size}개의 항목을 모두 삭제하시겠습니까?`)) {
        showLoader();
        await DB.removeNotes(Array.from(selectedIds));
        selectedIds.clear();
        hideLoader();
        renderNotes();
        showToast('선택한 항목들이 삭제되었습니다.');
    }
}

// Terms functionality
function getTerms() {
    const user = DB.getUser();
    if(!user) return [];
    return JSON.parse(localStorage.getItem(`terms_${user.name}`) || '[]');
}

function saveTerm(term, definition) {
    const termObj = { id: Date.now(), type: 'term', term, definition, date: new Date().toISOString() };
    DB.saveTerm(termObj);
}

function removeTerm(id) {
    DB.removeTerm(id);
}

window.addTermModal = function() {
    const term = prompt('추가할 용어를 입력하세요:');
    if(!term) return;
    const def = prompt('용어의 뜻이나 해설을 입력하세요:');
    if(!def) return;
    
    saveTerm(term, def);
    renderTerms();
    showToast('용어가 추가되었습니다.');
}

window.renderTerms = function() {
    const container = UIElem.termList;
    container.innerHTML = '';
    const terms = getTerms();
    
    if (terms.length === 0) {
        container.innerHTML = `<div class="text-center p-4 text-muted">저장된 용어가 없습니다.<br><br><button class="btn btn-primary" onclick="window.addTermModal()">새 용어 추가</button></div>`;
        return;
    }
    
    container.innerHTML = `<div class="mb-4 text-right"><button class="btn btn-primary" onclick="window.addTermModal()"><i class="fas fa-plus"></i> 새 용어 추가</button></div>`;
    
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
                <button class="btn" style="background:none;color:var(--danger);padding:4px" onclick="window.deleteTerm('${t.id}')"><i class="fas fa-times"></i></button>
            </div>
        `;
        container.appendChild(card);
    });
}

window.deleteTerm = function(id) {
    if(confirm('이 용어를 삭제하시겠습니까?')) {
        removeTerm(Number(id));
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
