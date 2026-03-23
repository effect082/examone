let oxData = [];
let currentQuiz = [];
let userAnswers = {};
let isGraded = false;

const UIElem = {
    setup: document.getElementById('ox-setup'),
    test: document.getElementById('ox-test'),
    result: document.getElementById('ox-result'),
    scoreText: document.getElementById('score-text'),
    qContainer: document.getElementById('question-container'),
    subjectSelect: document.getElementById('subject-select')
};

async function loadData() {
    showLoader();
    try {
        const res = await fetch('data/ox_data.json');
        oxData = await res.json();
        
        // Populate subject dropdown (extract unique subjects)
        const categories = new Set();
        oxData.forEach(q => {
            if (q.category) categories.add(q.category);
        });
        
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            UIElem.subjectSelect.appendChild(opt);
        });

    } catch (e) {
        console.error('Failed to load OX data', e);
        showToast('데이터를 불러오는데 실패했습니다.');
    }
    hideLoader();
}

function generateQuiz(type) {
    let pool = [];
    if (type === 'subject') {
        const sub = UIElem.subjectSelect.value;
        if (!sub) return showToast('과목을 선택해주세요.');
        pool = oxData.filter(q => q.category === sub);
    } else if (type === 'random') {
        pool = [...oxData];
    }
    
    // Select 20 random OX questions
    currentQuiz = shuffleArray(pool).slice(0, 20);
    
    if (currentQuiz.length === 0) {
        showToast('문제를 생성할 수 없습니다.');
        return;
    }

    startTest();
}

function startTest() {
    userAnswers = {};
    isGraded = false;
    UIElem.setup.classList.add('hidden');
    UIElem.test.classList.remove('hidden');
    UIElem.result.classList.add('hidden');
    
    renderQuestions();
    window.scrollTo(0,0);
}

function renderQuestions() {
    UIElem.qContainer.innerHTML = '';
    currentQuiz.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'glass-card mb-4';
        card.id = `q-card-${idx}`;
        
        let html = `
            <div style="font-size: 0.8rem; color: var(--primary-light); font-weight: 600; margin-bottom: 0.5rem;">[${q.category}]</div>
            <h4 class="text-primary"><span class="qnum">${idx + 1}.</span> ${q.question}</h4>
            <div class="ox-btn-group mt-4">
                <button class="ox-btn" id="btn-O-${idx}" onclick="selectAnswer(${idx}, 'O')">O</button>
                <button class="ox-btn" id="btn-X-${idx}" onclick="selectAnswer(${idx}, 'X')">X</button>
            </div>
            <div id="feedback-${idx}" class="feedback hidden mt-4 p-2" style="border-radius: 8px;"></div>
        `;
        
        card.innerHTML = html;
        UIElem.qContainer.appendChild(card);
    });
}

function selectAnswer(qIdx, ans) {
    if (isGraded) return;
    userAnswers[qIdx] = ans;
    
    // visual feedback for selection
    document.getElementById(`btn-O-${qIdx}`).classList.remove('selected');
    document.getElementById(`btn-X-${qIdx}`).classList.remove('selected');
    document.getElementById(`btn-${ans}-${qIdx}`).classList.add('selected');
}

function submitQuiz() {
    if (Object.keys(userAnswers).length < currentQuiz.length) {
        if (!confirm('풀지 않은 문제가 있습니다. 제출하시겠습니까?')) return;
    }
    
    isGraded = true;
    let correctCount = 0;
    
    currentQuiz.forEach((q, idx) => {
        const userAns = userAnswers[idx];
        const correctAns = q.answer.toUpperCase(); // 'O' or 'X'
        
        const feedback = document.getElementById(`feedback-${idx}`);
        feedback.classList.remove('hidden');
        
        // Disable buttons
        document.getElementById(`btn-O-${idx}`).style.pointerEvents = 'none';
        document.getElementById(`btn-X-${idx}`).style.pointerEvents = 'none';
        
        if (userAns === correctAns) {
            correctCount++;
            feedback.style.backgroundColor = 'var(--ok-bg)';
            feedback.style.color = 'var(--ok)';
            feedback.innerHTML = `<strong>정답입니다!</strong>`;
            // highlight correct button
            document.getElementById(`btn-${correctAns}-${idx}`).style.backgroundColor = 'var(--ok)';
            document.getElementById(`btn-${correctAns}-${idx}`).style.color = '#fff';
            document.getElementById(`btn-${correctAns}-${idx}`).style.borderColor = 'var(--ok)';
        } else {
            feedback.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            feedback.style.color = 'var(--danger)';
            feedback.innerHTML = `<strong>오답입니다. (정답: ${correctAns})</strong>`;
            if (q.explanation) {
                feedback.innerHTML += `<div class="mt-2 text-sm" style="color: var(--text-secondary);"><i class="fas fa-info-circle"></i> ${q.explanation}</div>`;
            }
            
            // Mark correct answer visually
            const correctBtn = document.getElementById(`btn-${correctAns}-${idx}`);
            if(correctBtn) {
                correctBtn.style.backgroundColor = 'var(--bg-gradient-1)';
                correctBtn.style.color = 'var(--primary-dark)';
                correctBtn.style.borderColor = 'var(--primary-dark)';
            }
            
            // Mark wrong answer
            if (userAns) {
                const wrongBtn = document.getElementById(`btn-${userAns}-${idx}`);
                if(wrongBtn) {
                    wrongBtn.style.backgroundColor = 'var(--danger)';
                    wrongBtn.style.color = '#fff';
                    wrongBtn.style.borderColor = 'var(--danger)';
                }
            }

            // Save to notebook
            DB.saveIncorrect('ox', q);
        }
    });
    
    UIElem.result.classList.remove('hidden');
    UIElem.scoreText.innerText = `총 ${currentQuiz.length}문제 중 ${correctCount}문제 정답! (${Math.round((correctCount/currentQuiz.length)*100)}점)`;
    window.scrollTo(0, document.body.scrollHeight);
    
    // Save Score to Backend
    const wrongIds = Object.keys(userAnswers).filter(idx => userAnswers[idx] !== currentQuiz[idx].answer.toUpperCase());
    DB.saveScore('ox', UIElem.subjectSelect.value || 'Random', Math.round((correctCount/currentQuiz.length)*100), currentQuiz.length, wrongIds);
    
    showToast('채점이 완료되었습니다. 오답은 오답노트에 자동 저장됩니다.');
}

function resetQuiz() {
    UIElem.setup.classList.remove('hidden');
    UIElem.test.classList.add('hidden');
    UIElem.result.classList.add('hidden');
    window.scrollTo(0,0);
}

// Utility
function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

document.addEventListener('DOMContentLoaded', () => {
    if(!DB.init()) {
        window.location.href = 'index.html';
        return;
    }
    loadData();
});
