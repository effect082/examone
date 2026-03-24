let examData = [];
let currentExam = [];
let userAnswers = {};
let isGraded = false;

const UIElem = {
    setup: document.getElementById('exam-setup'),
    test: document.getElementById('exam-test'),
    result: document.getElementById('exam-result'),
    scoreText: document.getElementById('score-text'),
    qContainer: document.getElementById('question-container'),
    subjectSelect: document.getElementById('subject-select')
};

async function loadData() {
    showLoader();
    try {
        const res = await fetch('data/exam_data.json');
        examData = await res.json();
        
        // We no longer dynamically populate the dropdown from json. 
        // We use the static <optgroup> in exam.html to ensure the 8 subjects are always present.

    } catch (e) {
        console.error('Failed to load exam data', e);
        showToast('데이터를 불러오는데 실패했습니다.');
    }
    hideLoader();
}

function generateExam(type) {
    let pool = [];
    if (type === 'subject') {
        const sub = UIElem.subjectSelect.value;
        if (!sub) return showToast('과목을 선택해주세요.');

        examData.forEach(sec => {
            // Find if the selected subject is in this section's subjects array
            const subIndex = sec.subjects.indexOf(sub);
            if (subIndex > -1) {
                // The actual exam divides questions by 25 per subject exactly.
                const startIndex = subIndex * 25;
                const endIndex = startIndex + 25;
                const subjectQuestions = sec.questions.slice(startIndex, endIndex);

                // Add the specific subject as a property to each question for later saving
                const taggedQuestions = subjectQuestions.map(q => ({
                    ...q,
                    subject: sub
                }));

                pool = pool.concat(taggedQuestions);
            } else if (sec.section_subject === sub) {
               // Fallback if user somehow selects a whole section (though our new UI won't allow it, good for safety)
               pool = pool.concat(sec.questions);
            }
        });
        
        if (pool.length < 25) {
            showToast(`해당 과목 문제가 부족합니다 (${pool.length}개). 모든 문제를 출제합니다.`);
            currentExam = shuffleArray(pool);
        } else {
            currentExam = Object.assign([], pool).slice(0, 25);
            currentExam = shuffleArray(currentExam); // Shuffle after precise slicing
        }
    } else if (type === 'random') {
        const count = parseInt(document.getElementById('random-count-select').value) || 80;
        examData.forEach(sec => {
            pool = pool.concat(sec.questions);
        });
        currentExam = shuffleArray(pool).slice(0, count);
    }
    
    // Filter out test instruction dummy questions
    currentExam = currentExam.filter(q => q.question && !q.question.replace(/\s/g, '').includes('답은각문제마다요구하는가장적합하거나가까운답1개만선택하고'));
    
    if (currentExam.length === 0) {
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
    currentExam.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'glass-card mb-4';
        card.id = `q-card-${idx}`;
        
        let html = `
            <h4 class="text-primary"><span class="qnum">${idx + 1}.</span> ${q.question}</h4>
            <div class="qopts-container">
        `;
        
        q.options.forEach((opt, optIdx) => {
            const optNum = optIdx + 1;
            html += `
                <label class="q-opt-label" id="label-${idx}-${optNum}">
                    <input type="radio" name="q-${idx}" value="${optNum}" onchange="selectAnswer(${idx}, ${optNum})">
                    <span>${opt}</span>
                </label>
            `;
        });
        
        html += `</div>
            <div id="feedback-${idx}" class="feedback hidden mt-4 p-2" style="border-radius: 8px; font-weight: 600;"></div>
        `;
        
        card.innerHTML = html;
        UIElem.qContainer.appendChild(card);
    });
}

function selectAnswer(qIdx, ans) {
    if (isGraded) return;
    userAnswers[qIdx] = ans;
}

function submitExam() {
    // Check if all answered
    if (Object.keys(userAnswers).length < currentExam.length) {
        if (!confirm('풀지 않은 문제가 있습니다. 제출하시겠습니까?')) return;
    }
    
    isGraded = true;
    let correctCount = 0;
    
    currentExam.forEach((q, idx) => {
        const userAns = userAnswers[idx];
        const correctAns = parseInt(q.correct_answer);
        
        const feedback = document.getElementById(`feedback-${idx}`);
        feedback.classList.remove('hidden');
        
        const labels = document.querySelectorAll(`#q-card-${idx} .q-opt-label`);
        labels.forEach(l => l.style.pointerEvents = 'none'); // disable clicks
        
        if (!isNaN(correctAns) && userAns === correctAns) {
            correctCount++;
            feedback.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
            feedback.style.color = 'var(--primary-dark)';
            feedback.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success)"></i> 정답입니다!`;
        } else {
            feedback.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            feedback.style.color = 'var(--danger)';
            
            if (isNaN(correctAns)) {
                feedback.innerHTML = `<i class="fas fa-exclamation-triangle"></i> 오답입니다. (정답 정보가 아직 데이터에 없습니다.)`;
            } else {
                feedback.innerHTML = `<i class="fas fa-times-circle"></i> 오답입니다. (정답: ${correctAns}번)`;
            }
            
            if (q.explanation) {
                feedback.innerHTML += `<div class="mt-2 text-sm pt-2" style="color: var(--text-secondary); border-top: 1px dashed rgba(0,0,0,0.1);"><i class="fas fa-info-circle"></i> <strong>해설:</strong> ${q.explanation}</div>`;
            }
            
            // Mark correct answer visually if it exists
            if (!isNaN(correctAns)) {
                const correctLabel = document.getElementById(`label-${idx}-${correctAns}`);
                if(correctLabel) {
                    correctLabel.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                    correctLabel.style.border = '1px solid var(--success)';
                }
            }
            
            // Mark wrong answer
            if (userAns) {
                const wrongLabel = document.getElementById(`label-${idx}-${userAns}`);
                if(wrongLabel) {
                    wrongLabel.style.border = '1px solid var(--danger)';
                    wrongLabel.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
                }
            }

            // Save to notebook if incorrect
            DB.saveIncorrect('exam', { ...q, user_answer: userAns });
        }
    });
    
    UIElem.result.classList.remove('hidden');
    UIElem.scoreText.innerText = `총 ${currentExam.length}문제 중 ${correctCount}문제 정답! (${Math.round((correctCount/currentExam.length)*100)}점)`;
    window.scrollTo(0, document.body.scrollHeight);
    
    // Save Score to Backend
    const wrongIds = Object.keys(userAnswers).filter(idx => userAnswers[idx] !== parseInt(currentExam[idx].correct_answer));
    DB.saveScore('exam', UIElem.subjectSelect.value || 'Random', Math.round((correctCount/currentExam.length)*100), currentExam.length, wrongIds);
    
    showToast('채점이 완료되었습니다. 오답은 오답노트에 자동 저장됩니다.');
}

function resetExam() {
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
