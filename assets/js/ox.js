let oxData = [];
let currentQuiz = [];
let userAnswers = {};
let isGraded = false;
let currentQuestionIndex = 0;
let correctCount = 0;

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
    
    // Filter out dummy empty entries
    pool = pool.filter(q => q.question && q.question.trim() !== "");
    
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
    currentQuestionIndex = 0;
    correctCount = 0;

    UIElem.setup.classList.add('hidden');
    UIElem.test.classList.remove('hidden');
    UIElem.result.classList.add('hidden');
    
    renderCurrentQuestion();
    window.scrollTo(0, 0);
}

function renderCurrentQuestion() {
    isGraded = false;
    document.getElementById('ox-controls').classList.add('hidden');
    
    const q = currentQuiz[currentQuestionIndex];
    
    let html = `
        <div style="font-size: 0.8rem; color: var(--primary-light); font-weight: 600; margin-bottom: 0.5rem; display: flex; justify-content: space-between;">
            <span>[${q.category || 'OX 퀴즈'}]</span>
            <span>${currentQuestionIndex + 1} / ${currentQuiz.length}</span>
        </div>
        <h4 class="text-primary mt-3" style="font-size: 1.2rem; line-height: 1.6; min-height: 80px;">${q.question}</h4>
        <div class="ox-btn-group mt-4 mb-2">
            <button class="ox-btn" id="btn-O" onclick="selectAnswer('O')">O</button>
            <button class="ox-btn" id="btn-X" onclick="selectAnswer('X')">X</button>
        </div>
        <div id="feedback-area" class="feedback hidden mt-4 p-3" style="border-radius: 8px;"></div>
    `;
    
    UIElem.qContainer.innerHTML = html;
}

window.selectAnswer = function selectAnswer(ans) {
    if (isGraded) return;
    isGraded = true;
    
    const q = currentQuiz[currentQuestionIndex];
    userAnswers[currentQuestionIndex] = ans;
    const correctAns = q.answer.toUpperCase();
    
    const feedback = document.getElementById('feedback-area');
    feedback.classList.remove('hidden');
    
    // Disable buttons
    document.getElementById('btn-O').style.pointerEvents = 'none';
    document.getElementById('btn-X').style.pointerEvents = 'none';
    
    if (ans === correctAns) {
        correctCount++;
        feedback.style.backgroundColor = 'var(--bg-gradient-1)';
        feedback.style.color = 'var(--primary-dark)';
        feedback.innerHTML = `<strong><i class="fas fa-check-circle" style="color: var(--success)"></i> 정답입니다!</strong>`;
        
        document.getElementById(`btn-${correctAns}`).style.backgroundColor = 'var(--bg-gradient-1)';
        document.getElementById(`btn-${correctAns}`).style.color = 'var(--primary-dark)';
        document.getElementById(`btn-${correctAns}`).style.borderColor = 'var(--primary-dark)';
        
        document.getElementById('add-note-btn').classList.add('hidden');
    } else {
        feedback.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
        feedback.style.color = 'var(--danger)';
        feedback.innerHTML = `<strong><i class="fas fa-times-circle"></i> 오답입니다. (정답: ${correctAns})</strong>`;
        
        const correctBtn = document.getElementById(`btn-${correctAns}`);
        if(correctBtn) {
            correctBtn.style.backgroundColor = 'var(--bg-gradient-1)';
            correctBtn.style.color = 'var(--primary-dark)';
            correctBtn.style.borderColor = 'var(--primary-dark)';
        }
        
        const wrongBtn = document.getElementById(`btn-${ans}`);
        if(wrongBtn) {
            wrongBtn.style.backgroundColor = 'var(--danger)';
            wrongBtn.style.color = '#fff';
            wrongBtn.style.borderColor = 'var(--danger)';
        }
        
        document.getElementById('add-note-btn').classList.remove('hidden');
    }
    
    if (q.explanation) {
        feedback.innerHTML += `<div class="mt-2 text-sm" style="color: var(--text-dark);"><i class="fas fa-info-circle"></i> ${q.explanation}</div>`;
    }
    
    const nextBtn = document.getElementById('next-q-btn');
    if (currentQuestionIndex === currentQuiz.length - 1) {
        nextBtn.innerHTML = '결과 보기 <i class="fas fa-chart-bar"></i>';
    } else {
        nextBtn.innerHTML = '다음 문제 <i class="fas fa-arrow-right"></i>';
    }
    
    document.getElementById('ox-controls').classList.remove('hidden');
}

window.nextQuestion = function nextQuestion() {
    if (currentQuestionIndex < currentQuiz.length - 1) {
        currentQuestionIndex++;
        renderCurrentQuestion();
    } else {
        showResult();
    }
}

window.addCurrentToNotes = function addCurrentToNotes() {
    const q = currentQuiz[currentQuestionIndex];
    DB.saveIncorrect('ox', q);
    showToast('오답노트에 추가되었습니다.');
    document.getElementById('add-note-btn').classList.add('hidden');
}

function showResult() {
    UIElem.test.classList.add('hidden');
    UIElem.result.classList.remove('hidden');
    UIElem.scoreText.innerText = `총 ${currentQuiz.length}문제 중 ${correctCount}문제 정답! (${Math.round((correctCount/currentQuiz.length)*100)}점)`;
    window.scrollTo(0, 0);
    
    // Save Score to Backend
    const wrongIds = Object.keys(userAnswers).filter(idx => userAnswers[idx] !== currentQuiz[idx].answer.toUpperCase());
    DB.saveScore('OX 퀴즈', UIElem.subjectSelect.value || '랜덤 연습', correctCount, currentQuiz.length, wrongIds);
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
