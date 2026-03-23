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
        // Filter by subject and ensure question exists
        pool = oxData.filter(q => q.subject === sub && q.question && q.question.trim() !== "");
    } else if (type === 'random') {
        pool = oxData.filter(q => q.question && q.question.trim() !== "");
    }
    
    // Determine question count based on requirement
    let count = 20;
    if (type === 'subject') {
        count = pool.length; // Use all available (already ensured 20+ per subject)
    } else if (type === 'random') {
        // Random between 20 and 30
        count = Math.floor(Math.random() * 11) + 20;
    }
    
    // Select questions
    currentQuiz = shuffleArray(pool).slice(0, count);
    
    if (currentQuiz.length === 0) {
        showToast('해당 조건의 문제를 찾을 수 없습니다.');
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
        <div class="ox-card">
            <span class="category-badge">${q.subject || '공통'}</span>
            <div class="progress-info">QUESTION ${currentQuestionIndex + 1} / ${currentQuiz.length}</div>
            
            <div class="ox-question-text">
                ${q.question}
            </div>

            <div class="ox-btn-group">
                <button class="ox-big-btn btn-o" onclick="selectAnswer('O')">O</button>
                <button class="ox-big-btn btn-x" onclick="selectAnswer('X')">X</button>
            </div>

            <div id="feedback-area" class="ox-feedback hidden">
                <!-- Feedback text and explanation will appear here -->
            </div>
        </div>
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
    
    // Visual feedback for buttons
    const btns = document.querySelectorAll('.ox-big-btn');
    btns.forEach(btn => btn.style.opacity = '0.3');
    
    const correctBtnClass = correctAns === 'O' ? '.btn-o' : '.btn-x';
    const selectedBtnClass = ans === 'O' ? '.btn-o' : '.btn-x';
    
    const correctBtn = document.querySelector(correctBtnClass);
    const selectedBtn = document.querySelector(selectedBtnClass);
    
    if (correctBtn) {
        correctBtn.style.opacity = '1';
        correctBtn.style.transform = 'scale(1.1)';
        correctBtn.style.boxShadow = '0 0 20px var(--success-color)';
    }

    if (ans === correctAns) {
        correctCount++;
        feedback.className = 'ox-feedback feedback-correct';
        feedback.innerHTML = `
            <div style="font-size: 1.2rem; font-weight: 800;">
                <i class="fas fa-check-circle"></i> 정답입니다!
            </div>
        `;
        document.getElementById('add-note-btn').classList.add('hidden');
    } else {
        if (selectedBtn) {
            selectedBtn.style.opacity = '1';
            selectedBtn.style.transform = 'scale(0.9)';
        }
        feedback.className = 'ox-feedback feedback-incorrect';
        feedback.innerHTML = `
            <div style="font-size: 1.2rem; font-weight: 800;">
                <i class="fas fa-times-circle"></i> 오답입니다. (정답: ${correctAns})
            </div>
        `;
        document.getElementById('add-note-btn').classList.remove('hidden');
    }
    
    if (q.explanation) {
        feedback.innerHTML += `<div class="explanation-text">${q.explanation}</div>`;
    }
    
    const nextBtn = document.getElementById('next-q-btn');
    if (currentQuestionIndex === currentQuiz.length - 1) {
        nextBtn.innerHTML = '결과 확인하기 <i class="fas fa-chart-line"></i>';
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
