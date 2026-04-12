// 考试练习工具 - 核心逻辑（增强版：即时反馈）
class ExamApp {
    constructor() {
        this.questions = [];
        this.currentExam = null;
        this.userAnswers = {};
        this.userAnswerStatus = {};
        this.wrongQuestions = JSON.parse(localStorage.getItem('wrongQuestions') || '[]');
        this.difficultQuestions = JSON.parse(localStorage.getItem('difficultQuestions') || '[]');
        this.settings = JSON.parse(localStorage.getItem('examSettings') || '{}');
        this.currentWrongPracticeIndex = 0;
        this.isWrongPracticeMode = false;
        this.multipleConfirmShown = false;
        this.initSettings();
        this.init();
    }

    initSettings() {
        const defaultSettings = {
            timePerQuestion: 120,
            questionsPerSession: 20,
            darkMode: false,
            vibration: false,
            autoNext: true,
            categories: []
        };
        this.settings = { ...defaultSettings, ...this.settings };
        this.saveSettings();
    }

    saveSettings() {
        localStorage.setItem('examSettings', JSON.stringify(this.settings));
    }

    async init() {
        await this.loadQuestions();
        this.setupEventListeners();
        this.setupTouchEvents();
        this.updateStats();
        this.updateRecentSessions();
        this.applyTheme();
        this.registerServiceWorker();
        this.setupHideNavOnScroll();
        
        if (this.questions.length === 0) {
            this.showToast('请导入Excel题库开始使用', 'info');
        }
    }

    async loadQuestions() {
        try {
            const localQuestions = localStorage.getItem('questions');
            if(localQuestions){
                this.questions = JSON.parse(localQuestions);
            } else{
                const response = await fetch('./questions.json?t=' + Date.now());
                if(!response.ok){
                    throw new Error(`网络响应失败: ${response.status} ${response.statusText}`);
                }
                const data = await response.json();
                this.questions = Array.isArray(data) ? data : (data.questions || []);
                localStorage.setItem('questions', JSON.stringify(this.questions));
            }         
            this.updateQuestionCount();
            this.extractCategories();
            console.log(`✅ 成功加载 ${this.questions.length} 道题目`);

        } catch (error) {
            console.log('未找到题库文件，请先导入Excel文件', error);
            this.questions = [];
        }
    }

    extractCategories() {
        const categories = new Set();
        this.questions.forEach(q => {
            if (q.category) categories.add(q.category);
        });
        this.settings.categories = Array.from(categories);
        this.updateCategoryFilter();
    }

    updateCategoryFilter() {
        const filter = document.getElementById('categoryFilter');
        if (!filter) return;
        
        filter.innerHTML = '<option value="">全部分类</option>';
        this.settings.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            filter.appendChild(option);
        });

        const wrongFilter = document.getElementById('wrongCategoryFilter');
        if (wrongFilter) {
            wrongFilter.innerHTML = '<option value="">全部分类</option>';
            this.settings.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                wrongFilter.appendChild(option);
            });
        }

        const difficultFilter = document.getElementById('difficultCategoryFilter');
        if (difficultFilter) {
            difficultFilter.innerHTML = '<option value="">全部分类</option>';
            this.settings.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                difficultFilter.appendChild(option);
            });
        }
    }

    updateQuestionCount() {
        const elem = document.getElementById('totalQuestions');
        if(elem) elem.textContent = this.questions.length;
    }

    setupEventListeners() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.handleNavClick(e);
            });
        });

        this.addMultiEventListener('startExamBtn', ['click', 'touchend'], () => {
            this.isWrongPracticeMode = false;
            this.startNewExam();
        });

        this.addMultiEventListener('practiceWrongBtn', ['click', 'touchend'], () => {
            this.startWrongPractice();
        });

        this.addMultiEventListener('wrongQuestionsBtn', ['click', 'touchend'], () => {
            this.loadWrongQuestions();
            this.switchPage('wrongPage');
        });

        this.addMultiEventListener('difficultBtn', ['click', 'touchend'], () => {
            this.loadDifficultQuestions();
            this.switchPage('difficultPage');
        });

        this.addMultiEventListener('settingsBtn', ['click', 'touchend'], () => {
            this.switchPage('settingsPage')
        });

        this.addMultiEventListener('backToHome', ['click', 'touchend'], () => {
            this.switchPage('homePage');
            document.querySelector('.nav-item[data-page="homePage"]').click();
        });

        this.addMultiEventListener('backFromWrong', ['click', 'touchend'], () => {
            this.switchPage('homePage');
            document.querySelector('.nav-item[data-page="homePage"]').click();
        });

        this.addMultiEventListener('backFromDifficult', ['click', 'touchend'], () => {
            this.switchPage('homePage');
            document.querySelector('.nav-item[data-page="homePage"]').click();
        });

        this.addMultiEventListener('backFromSettings', ['click', 'touchend'], () => {
            this.switchPage('homePage');
            document.querySelector('.nav-item[data-page="homePage"]').click();
        });

        this.addMultiEventListener('prevQuestion', ['click', 'touchend'], () => {
            this.prevQuestion();
        });
        
        this.addMultiEventListener('nextQuestion', ['click', 'touchend'], () => {
            this.nextQuestion();
        });

        this.addMultiEventListener('continueBtn', ['click', 'touchend'], () => {
            this.continueToNext();
        });

        this.addMultiEventListener('confirmMultipleBtn', ['click', 'touchend'], () => {
            this.confirmMultipleAnswer();
        });

        this.addMultiEventListener('showExplanationBtn', ['click', 'touchend'], () => {
            this.toggleExplanation();
        });

        this.addMultiEventListener('markQuestionBtn', ['click', 'touchend'], () => {
            this.markQuestion();
        });
        
        if (document.getElementById('markQuestionBtn')) {
            document.getElementById('markQuestionBtn').addEventListener('long-press', () => {
                this.markQuestion();
                this.showToast('长按标记题目', 'info');
            });
        }

        const timePerQuestion = document.getElementById('timePerQuestion');
        if (timePerQuestion) {
            timePerQuestion.addEventListener('change', (e) => {
                this.settings.timePerQuestion = parseInt(e.target.value);
                this.saveSettings();
            });
        }

        const questionsPerSession = document.getElementById('questionsPerSession');
        if (questionsPerSession) {
            questionsPerSession.addEventListener('change', (e) => {
                this.settings.questionsPerSession = parseInt(e.target.value);
                this.saveSettings();
            });
        }

        const autoNextToggle = document.getElementById('autoNextToggle');
        if (autoNextToggle) {
            autoNextToggle.addEventListener('change', (e) => {
                this.settings.autoNext = e.target.checked;
                this.saveSettings();
            });
        }

        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('change', (e) => {
                this.settings.darkMode = e.target.checked;
                this.saveSettings();
                this.applyTheme();
            });
        }

        const vibrationToggle = document.getElementById('vibrationToggle');
        if (vibrationToggle) {
            vibrationToggle.addEventListener('change', (e) => {
                this.settings.vibration = e.target.checked;
                this.saveSettings();
            });
        }

        this.addMultiEventListener('importExcelBtn', ['click', 'touchend'], () => {
            const fileInput = document.getElementById('excelFile');
            if (fileInput) fileInput.click();
        });

        const excelFile = document.getElementById('excelFile');
        if (excelFile) {
            excelFile.addEventListener('change', (e) => {
                this.importExcel(e.target.files[0]);
            });
        }

        this.addMultiEventListener('exportWrongBtn', ['click', 'touchend'], () => {
            this.exportWrongQuestions();
        });

        this.addMultiEventListener('clearWrongBtn', ['click', 'touchend'], () => {
            this.showConfirm('确定要清空所有错题吗？', (confirmed) => {
                if (confirmed) {
                    this.wrongQuestions = [];
                    localStorage.setItem('wrongQuestions', JSON.stringify([]));
                    this.loadWrongQuestions();
                    this.updateStats();
                    this.showToast('已清空错题本', 'success');
                }
            });
        });

        this.addMultiEventListener('clearDifficultBtn', ['click', 'touchend'], () => {
            this.showConfirm('确定要清空易错题库吗？', (confirmed) => {
                if (confirmed) {
                    this.difficultQuestions = [];
                    localStorage.setItem('difficultQuestions', JSON.stringify([]));
                    this.loadDifficultQuestions();
                    this.updateStats();
                    this.showToast('已清空易错本', 'success');
                }
            });
        });

        this.addMultiEventListener('themeToggle', ['click', 'touchend'], () => {
            this.settings.darkMode = !this.settings.darkMode;
            this.saveSettings();
            this.applyTheme();
        });

        this.addMultiEventListener('exportBtn', ['click', 'touchend'], () => {
            this.exportAllData();
        });

        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                this.loadWrongQuestions();
            });
        }

        const wrongCategoryFilter = document.getElementById('wrongCategoryFilter');
        if (wrongCategoryFilter) {
            wrongCategoryFilter.addEventListener('change', () => {
                this.loadWrongQuestions();
            });
        }

        const difficultCategoryFilter = document.getElementById('difficultCategoryFilter');
        if (difficultCategoryFilter) {
            difficultCategoryFilter.addEventListener('change', () => {
                this.loadDifficultQuestions();
            });
        }
    }

    addMultiEventListener(elementId, events, handler) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const targetEvents = isTouchDevice ? ['touchend'] : ['click'];
        
        targetEvents.forEach(event => {
            element.addEventListener(event, (e) => {
                if (event === 'touchend') e.preventDefault();
                if (element.disabled || element.classList.contains('no-click')){
                    return;
                }
                element.classList.add('no-click');
                setTimeout(() => {
                    element.classList.remove('no-click');
                }, 300);
                handler(e);
            });
        });
    }

    handleNavClick(e) {
        const page = e.currentTarget.dataset.page;
        this.switchPage(page);
        
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        e.currentTarget.classList.add('active');
    }

    setupTouchEvents() {
        const examContainer = document.getElementById('examPage');
        if (!examContainer) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let isSwiping = false;

        examContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = true;
            if (this.timerInterval) {
                this.timerPaused = true;
            }
        });

        examContainer.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const diffX = touchStartX - touchX;
            const diffY = touchStartY - touchY;

            if (Math.abs(diffX) > Math.abs(diffY)) {
                e.preventDefault();
            }
        });

        examContainer.addEventListener('touchend', (e) => {
            if (!isSwiping) return;
            isSwiping = false;
            
            this.timerPaused = false;

            const touchEndX = e.changedTouches[0].clientX;
            const diffX = touchStartX - touchEndX;

            if (Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    this.nextQuestion();
                } else {
                    this.prevQuestion();
                }
            }
        });

        this.setupLongPressEvent();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerPaused = true;
            } else if (!document.hidden && this.timerPaused && this.currentExam) {
                this.startTimer();
            }
        });
    }

    setupLongPressEvent() {
        let longPressTimer;
        const longPressThreshold = 500;

        document.addEventListener('touchstart', (e) => {
            if (e.target.closest('.option-item') || e.target.closest('#markQuestionBtn')) {
                longPressTimer = setTimeout(() => {
                    e.target.dispatchEvent(new CustomEvent('long-press'));
                }, longPressThreshold);
            }
        });

        document.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        });

        document.addEventListener('touchmove', () => {
            clearTimeout(longPressTimer);
        });
    }

    switchPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        const targetPage = document.getElementById(pageId);
        if (targetPage) targetPage.classList.add('active');
        window.scrollTo(0, 0);
    }

    startWrongPractice() {
        if (this.wrongQuestions.length === 0) {
            this.showToast('暂无错题，继续练习吧！', 'warning');
            return;
        }

        this.isWrongPracticeMode = true;
        this.currentWrongPracticeIndex = 0;
        this.currentExam = this.wrongQuestions.map(item => ({ ...item.question }));
        this.userAnswers = {};
        this.userAnswerStatus = {};
        
        this.switchPage('examPage');
        this.showQuestionWithFeedback(0);
        this.updateProgress();
        
        const timer = document.getElementById('timer');
        const timerLabel = document.getElementById('timerLabel');
        if (timer) timer.style.display = 'none';
        if (timerLabel) timerLabel.style.display = 'none';
        
        this.showToast(`开始练习 ${this.currentExam.length} 道错题`, 'info');
    }

    startNewExam() {
        if (this.questions.length === 0) {
            this.showToast('请先导入题库', 'warning');
            this.switchPage('settingsPage');
            return;
        }

        const count = this.settings.questionsPerSession || 20;
        this.currentExam = this.generateRandomPaper(count);
        this.userAnswers = {};
        this.userAnswerStatus = {};
        this.currentQuestionIndex = 0;
        this.examStartTime = new Date();
        this.timeLimit = (this.settings.timePerQuestion || 120) * count;

        this.switchPage('examPage');
        
        const timer = document.getElementById('timer');
        const timerLabel = document.getElementById('timerLabel');
        if (timer) timer.style.display = 'inline';
        if (timerLabel) timerLabel.style.display = 'inline';
        
        this.showQuestionWithFeedback(0);
        this.startTimer();
        this.updateProgress();
    }

    generateRandomPaper(count) {
        const shuffled = [...this.questions].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    showQuestionWithFeedback(index) {
        if (!this.currentExam || index < 0 || index >= this.currentExam.length) {
            return;
        }

        this.currentQuestionIndex = index;
        const question = this.currentExam[index];
        const isAnswered = this.userAnswers[index] !== undefined;
        const isCorrect = this.userAnswerStatus[index];

        const questionType = document.getElementById('questionType');
        const questionDifficulty = document.getElementById('questionDifficulty');
        const questionText = document.getElementById('questionText');
        const currentQuestionNum = document.getElementById('currentQuestionNum');
        const totalQuestionsNum = document.getElementById('totalQuestionsNum');
        const prevBtn = document.getElementById('prevQuestion');
        const nextBtn = document.getElementById('nextQuestion');
        
        if (questionType) questionType.textContent = this.getQuestionTypeText(question.type);
        if (questionDifficulty) questionDifficulty.textContent = this.getDifficultyText(question.difficulty);
        if (questionText) questionText.textContent = question.question;
        if (currentQuestionNum) currentQuestionNum.textContent = index + 1;
        if (totalQuestionsNum) totalQuestionsNum.textContent = this.currentExam.length;

        this.renderOptionsWithFeedback(question, isAnswered);

        if (prevBtn) prevBtn.disabled = index === 0;
        if (nextBtn) {
            if (isAnswered) {
                nextBtn.textContent = index === this.currentExam.length - 1 ? '完成' : '下一题';
                nextBtn.disabled = false;
            } else {
                nextBtn.textContent = '下一题';
                nextBtn.disabled = true;
            }
        }

        const feedbackBox = document.getElementById('feedbackBox');
        const continueBtn = document.getElementById('continueBtn');
        const confirmMultipleBtn = document.getElementById('confirmMultipleBtn');
        
        if (confirmMultipleBtn) confirmMultipleBtn.style.display = 'none';
        this.multipleConfirmShown = false;
        
        if (isAnswered) {
            if (feedbackBox) feedbackBox.style.display = 'block';
            if (continueBtn) continueBtn.style.display = this.settings.autoNext ? 'none' : 'block';
            
            const resultIcon = document.getElementById('resultIcon');
            const resultTitle = document.getElementById('resultTitle');
            const resultMessage = document.getElementById('resultMessage');
            const feedbackExplanation = document.getElementById('feedbackExplanation');
            
            if (isCorrect) {
                if (resultIcon) resultIcon.innerHTML = '<i class="fas fa-check-circle" style="font-size: 48px; color: #4CAF50;"></i>';
                if (resultTitle) {
                    resultTitle.textContent = '✓ 回答正确';
                    resultTitle.style.color = '#4CAF50';
                }
                if (resultMessage) resultMessage.textContent = '恭喜你答对了！';
            } else {
                if (resultIcon) resultIcon.innerHTML = '<i class="fas fa-times-circle" style="font-size: 48px; color: #f44336;"></i>';
                if (resultTitle) {
                    resultTitle.textContent = '✗ 回答错误';
                    resultTitle.style.color = '#f44336';
                }
                
                const currentQuestion = this.currentExam[index];
                const userAnswerText = this.formatAnswer(this.userAnswers[index], currentQuestion.type);
                const correctAnswerText = this.formatAnswer(question.answer, currentQuestion.type);
                if (resultMessage) resultMessage.textContent = `你的答案：${userAnswerText} | 正确答案：${correctAnswerText}`;
            }
            
            if (feedbackExplanation) feedbackExplanation.textContent = question.explanation || '暂无解析';
            
            if (this.settings.autoNext && index < this.currentExam.length - 1) {
                setTimeout(() => {
                    this.nextQuestion();
                }, 2000);
            }
        } else {
            if (feedbackBox) feedbackBox.style.display = 'none';
        }

        const userAnswer = this.userAnswers[index];
        if (userAnswer) {
            this.selectAnswerVisual(userAnswer, question.type);
        }

        this.updateProgress();
    }

    formatAnswer(answer, questionType = 'single') {
        if (!answer) return '未作答';

        if (Array.isArray(answer)) {
            return answer.join(', ');
        }

        const str = String(answer).toUpperCase();
        if (questionType === 'judge'){
        if (str === 'A') return '正确';
        if (str === 'B') return '错误';
        return str;
        }
        // 多选题：ABC -> A, B, C
        if (str.length > 1 && /^[A-F]+$/i.test(str)) {
            return str.split('').join(', ');
        }
        return str;
    }

    renderOptionsWithFeedback(question, isAnswered) {
        const container = document.getElementById('optionsContainer');
        if (!container) return;
        
        container.innerHTML = '';

        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        
        let options = [];
        if (question.type === 'judge') {
            options = [
                { letter: 'A', text: '正确' },
                { letter: 'B', text: '错误' }
            ];
        } else {
            options = question.options.map((opt, idx) => ({
                letter: letters[idx],
                text: opt
            }));
        }

        const correctAnswer = question.answer;
        const userAnswer = this.userAnswers[this.currentQuestionIndex];

        options.forEach(opt => {
            const optionDiv = this.createOptionElementWithFeedback(
                opt.letter, 
                opt.text, 
                isAnswered,
                correctAnswer,
                userAnswer,
                question.type
            );
            container.appendChild(optionDiv);
        });
    }

    createOptionElementWithFeedback(letter, text, isAnswered, correctAnswer, userAnswer, questionType) {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option-item';
        optionDiv.dataset.value = letter;
        optionDiv.style.touchAction = 'manipulation';

        const isCorrectOption = this.isOptionCorrect(letter, correctAnswer, questionType);
        const isUserSelected = this.isOptionSelected(letter, userAnswer);
        
        optionDiv.classList.remove('correct-option', 'wrong-option');

        if(isAnswered){
            if(isCorrectOption && isUserSelected){
                optionDiv.classList.add('correct-option');
            } else if (!isCorrectOption && isUserSelected){
                optionDiv.classList.add('wrong-option');
            }
        }

        let markHtml = '';
        if (!isAnswered) {
            if (isCorrectOption && isUserSelected) {
                markHtml = '<div class="option-mark" style="color: #4CAF50;">✅</div>';
            }
            else if (isUserSelected && !isCorrectOption) {
                markHtml = '<div class="option-mark" style="color: #f44336;">❌</div>';
            }
        }
      

        optionDiv.innerHTML = ` 
            <div class="option-letter">${letter}</div> 
            <div class="option-text">${text}</div> 
            ${markHtml} 
            `;

        if (!isAnswered) {
            const isMultiple = questionType === 'multiple';

            optionDiv.addEventListener('click', () => {
                if (isMultiple) {
                    this.toggleMultipleAnswerWithCheck(letter);
                } else {
                    this.checkAndAnswer(letter);
                }
            });

        }

        return optionDiv;
        
    }

    isOptionCorrect(letter, correctAnswer, questionType = 'single') {
        if(questionType === 'judge'){
           const correctMap = { 
            '正确': 'A', '对': 'A', '√': 'A', 'true': 'A', '是': 'A',
            '错误': 'B', '错': 'B', '×': 'B', 'false': 'B', '否': 'B'
        };
           const normalizedCorrect = correctMap[String(correctAnswer).toLowerCase()] || String(correctAnswer).toUpperCase();
           return letter === normalizedCorrect;
        }

        if (Array.isArray(correctAnswer)) {
            return correctAnswer.includes(letter);
        }
        return letter === correctAnswer;
    }

    isOptionSelected(letter, userAnswer) {
        if (!userAnswer) return false;
        if (Array.isArray(userAnswer)) {
            return userAnswer.includes(letter);
        }
        const answerStr = String(userAnswer).toUpperCase();
        return answerStr.includes(letter);
    }

    isAnswerCorrect(userAnswer, question) {
        const correctAnswer = question.answer;
        
        let normalizedUserAnswer;
        if(Array.isArray(userAnswer)){
            normalizedUserAnswer = userAnswer.sort().join('');
        } else {
            normalizedUserAnswer = String(userAnswer).replace(/[^A-F]/g,'').split('').sort().join('');
        }

        let normalizedCorrectAnswer;
        if(Array.isArray(correctAnswer)){
            normalizedCorrectAnswer = correctAnswer.sort().join('');
        } else {
            normalizedCorrectAnswer = String(correctAnswer).replace(/[^A-F]/g, '').split('').sort().join('');
        }

        if (question.type === 'multiple') {
            return normalizedUserAnswer === normalizedCorrectAnswer;
        }
        
        if (question.type === 'judge') {
            const userMap = { '正确': 'A', '对': 'A', '√': 'A', 'true': 'A', '是': 'A', '错误': 'B', '错': 'B', '×': 'B', 'false': 'B', '否': 'B' };
            const userNorm = userMap[String(userAnswer).toLowerCase()] || String(userAnswer).toUpperCase();
            const correctNorm = userMap[String(correctAnswer).toLowerCase()] || String(correctAnswer).toUpperCase();
            return userNorm === correctNorm;
        }
        
        // 单选题
        const userNorm = String(userAnswer).toUpperCase().trim();
        const correctNorm = String(correctAnswer).toUpperCase().trim();
        if(userNorm === 'B' && correctNorm === '错误') return false;
        if(userNorm === 'A' && correctNorm === '正确') return false;

        return userNorm  === correctNorm;
    }

    normalizeAnswer(answer) {
        if (!answer) return '';
        if (Array.isArray(answer)) {
            return answer
            .map(a => String(a).trim().toUpperCase())
            .filter(a => a.length > 0)
            .sort()
            .join('');
        }

        if (typeof answer === 'string') {
        // 去除所有空格、逗号、分号、顿号等分隔符
        let cleaned = answer.replace(/[\s,;、]+/g, '');
        cleaned = cleaned.toUpperCase();
        
        // 处理像 "ABC" 这样的连续字母
        if (cleaned.length > 1 && /^[A-F]+$/i.test(cleaned)) {
            return cleaned.split('').sort().join('');
        }
        
        // 处理像 "A,B,C" 这样的（上面已经去掉了逗号，但以防万一）
        if (cleaned.includes(',')) {
            return cleaned.split(',').map(s => s.trim()).sort().join('');
        }
        
        return cleaned;
        }

        return String(answer).toUpperCase().trim();
    }

    checkAndAnswer(answer) {
        const question = this.currentExam[this.currentQuestionIndex];
        
        this.userAnswers[this.currentQuestionIndex] = answer;
        
        const isCorrect = this.isAnswerCorrect(answer, question);
        this.userAnswerStatus[this.currentQuestionIndex] = isCorrect;
        
        if (!isCorrect) {
            this.addWrongQuestion(question, answer);
        } else if (this.isWrongPracticeMode) {
            this.removeFromWrongQuestions(question.id);
        }

        if (this.settings.vibration && navigator.vibrate) {
            navigator.vibrate(isCorrect ? 50 : 100);
        }
        
        this.showQuestionWithFeedback(this.currentQuestionIndex);
    }

    toggleMultipleAnswerWithCheck(answer) {
        const question = this.currentExam[this.currentQuestionIndex];
        const optionElement = document.querySelector(`.option-item[data-value="${answer}"]`);

        let currentAnswer = this.userAnswers[this.currentQuestionIndex];
        if (!Array.isArray(currentAnswer)) {
            currentAnswer = [];
        }

        const index = currentAnswer.indexOf(answer);
        if (index === -1) {
            currentAnswer.push(answer);
            if (optionElement) optionElement.classList.add('selected');
        } else {
            currentAnswer.splice(index, 1);
            if (optionElement) optionElement.classList.remove('selected');
        }
        
        this.userAnswers[this.currentQuestionIndex] = currentAnswer;
        
        if (!this.multipleConfirmShown) {
            this.showToast('多选题请点击下方"确认答案"按钮', 'info');
            this.multipleConfirmShown = true;
        }
        
        const confirmBtn = document.getElementById('confirmMultipleBtn');
        if (confirmBtn) confirmBtn.style.display = 'block';
    }

    confirmMultipleAnswer() {
        const question = this.currentExam[this.currentQuestionIndex];
        const userAnswer = this.userAnswers[this.currentQuestionIndex];
        
        if (!userAnswer || (Array.isArray(userAnswer) && userAnswer.length === 0)) {
            this.showToast('请先选择答案', 'warning');
            return;
        }
        
        const isCorrect = this.isAnswerCorrect(userAnswer, question);
        this.userAnswerStatus[this.currentQuestionIndex] = isCorrect;
        
        if (this.settings.vibration && navigator.vibrate) {
            navigator.vibrate(isCorrect ? 50 : 100);
        }
        
        if (!isCorrect) {
            this.addWrongQuestion(question, userAnswer);
        } else if (this.isWrongPracticeMode) {
            this.removeFromWrongQuestions(question.id);
        }
        
        const confirmBtn = document.getElementById('confirmMultipleBtn');
        if (confirmBtn) confirmBtn.style.display = 'none';
        
        this.showQuestionWithFeedback(this.currentQuestionIndex);
    }

    continueToNext() {
        this.nextQuestion();
    }

    selectAnswerVisual(answer, questionType) {
        if (questionType === 'multiple') {
            const answers = Array.isArray(answer) ? answer : [answer];
            answers.forEach(ans => {
                const el = document.querySelector(`.option-item[data-value="${ans}"]`);
                if (el) el.classList.add('selected');
            });
        } else {
            const el = document.querySelector(`.option-item[data-value="${answer}"]`);
            if (el) el.classList.add('selected');
        }
    }

    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.showQuestionWithFeedback(this.currentQuestionIndex - 1);
            this.showToast('上一题', 'info');
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.currentExam.length - 1) {
            this.showQuestionWithFeedback(this.currentQuestionIndex + 1);
            this.showToast('下一题', 'info');
        } else {
            this.finishSession();
        }
    }

    finishSession() {
        let correctCount = 0;
        for (let i = 0; i < this.currentExam.length; i++) {
            if (this.userAnswerStatus[i]) correctCount++;
        }
        
        const accuracy = Math.round((correctCount / this.currentExam.length) * 100);
        const message = this.isWrongPracticeMode ? 
            `错题练习完成！\n正确率：${accuracy}% (${correctCount}/${this.currentExam.length})\n答对的题目已从错题库移除` :
            `练习完成！\n正确率：${accuracy}% (${correctCount}/${this.currentExam.length})`;
        
        this.showModal({
            title: this.isWrongPracticeMode ? '错题练习结果' : '练习结果',
            content: message,
            confirmText: '确定',
            onConfirm: () => {
                this.switchPage('homePage');
                const homeNav = document.querySelector('.nav-item[data-page="homePage"]');
                if (homeNav) homeNav.click();
                this.updateStats();
                if (!this.isWrongPracticeMode) {
                    this.updateRecentSessions(correctCount, this.currentExam.length);
                }
            }
        });
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }

    addWrongQuestion(question, userAnswer) {
        const existingIndex = this.wrongQuestions.findIndex(wrong => 
            wrong.question.id === question.id
        );
        
        if (existingIndex !== -1) {
            this.wrongQuestions[existingIndex].wrongCount = (this.wrongQuestions[existingIndex].wrongCount || 1) + 1;
            this.wrongQuestions[existingIndex].lastWrongTime = new Date().toISOString();
            this.wrongQuestions[existingIndex].userAnswer = userAnswer;
            
            if (this.wrongQuestions[existingIndex].wrongCount >= 3) {
                this.addToDifficultQuestions(question, this.wrongQuestions[existingIndex].wrongCount);
                this.wrongQuestions.splice(existingIndex, 1);
            }
        } else {
            this.wrongQuestions.unshift({
                question,
                userAnswer,
                wrongCount: 1,
                timestamp: new Date().toISOString(),
                lastWrongTime: new Date().toISOString()
            });
        }
        
        if (this.wrongQuestions.length > 500) {
            this.wrongQuestions = this.wrongQuestions.slice(0, 500);
        }
        
        setTimeout(() => {
            localStorage.setItem('wrongQuestions', JSON.stringify(this.wrongQuestions));
            this.updateStats();
        }, 0);
    }

    removeFromWrongQuestions(questionId) {
        const index = this.wrongQuestions.findIndex(wrong => wrong.question.id === questionId);
        if (index !== -1) {
            this.wrongQuestions.splice(index, 1);
            localStorage.setItem('wrongQuestions', JSON.stringify(this.wrongQuestions));
            this.updateStats();
            this.showToast('答对了！已从错题库移除', 'success');
        }
    }

    addToDifficultQuestions(question, wrongCount) {
        const exists = this.difficultQuestions.some(diff => diff.question.id === question.id);
        
        if (!exists) {
            this.difficultQuestions.push({
                question,
                wrongCount: wrongCount,
                addedTime: new Date().toISOString()
            });
            
            localStorage.setItem('difficultQuestions', JSON.stringify(this.difficultQuestions));
            this.showToast('该题已加入易错题库', 'warning');
        }
    }

    loadDifficultQuestions() {
        const container = document.getElementById('difficultList');
        if (!container) return;

        const categoryFilter = document.getElementById('difficultCategoryFilter');
        const category = categoryFilter ? categoryFilter.value : '';
        
        let filtered = this.difficultQuestions;
        
        if (category) {
            filtered = filtered.filter(item => item.question.category === category);
        }
        
        const difficultCount = document.getElementById('difficultCount');
        if (difficultCount) difficultCount.textContent = filtered.length;
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px; text-align: center;">
                    <i class="fas fa-star" style="font-size: 3rem; color: #ff9800;"></i>
                    <p style="margin-top: 10px; font-size: 16px;">暂无易错题，继续加油！</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        filtered.forEach((item, index) => {
            const question = item.question;
            const diffItem = document.createElement('div');
            diffItem.className = 'wrong-item';
            diffItem.style.padding = '15px';
            diffItem.style.marginBottom = '10px';
            diffItem.style.backgroundColor = this.settings.darkMode ? '#333' : '#fff';
            diffItem.style.borderRadius = '8px';
            diffItem.style.borderLeft = '4px solid #ff9800';
            
            const correctAnswerText = Array.isArray(question.answer)
                ? question.answer.join(', ')
                : question.answer;
            
            diffItem.innerHTML = `
                <div class="wrong-question" style="font-size: 15px; margin-bottom: 8px;">${index + 1}. ${question.question}</div>
                <div class="correct-answer" style="font-size: 14px; color: #4CAF50; margin-bottom: 8px;">正确答案：${correctAnswerText}</div>
                ${question.explanation ? `
                    <div class="wrong-explanation" style="font-size: 14px; color: #666; margin-bottom: 8px;">
                        <strong>解析：</strong>${question.explanation}
                    </div>
                ` : ''}
                <div style="font-size: 0.8rem; color: #888;">
                    已错 ${item.wrongCount} 次 | ${new Date(item.addedTime).toLocaleDateString()}
                </div>
                <button class="practice-difficult-btn" data-id="${question.id}" style="margin-top: 10px; padding: 8px 16px; background: #ff9800; color: white; border: none; border-radius: 6px; font-size: 14px;">练习本题</button>
            `;
            
            const practiceBtn = diffItem.querySelector('.practice-difficult-btn');
            practiceBtn.addEventListener('click', () => {
                this.practiceSingleQuestion(question);
            });
            
            container.appendChild(diffItem);
        });
    }

    practiceSingleQuestion(question) {
        this.currentExam = [question];
        this.userAnswers = {};
        this.userAnswerStatus = {};
        this.currentQuestionIndex = 0;
        this.isWrongPracticeMode = true;
        
        this.switchPage('examPage');
        const timer = document.getElementById('timer');
        const timerLabel = document.getElementById('timerLabel');
        if (timer) timer.style.display = 'none';
        if (timerLabel) timerLabel.style.display = 'none';
        
        this.showQuestionWithFeedback(0);
    }

    loadWrongQuestions() {
        const container = document.getElementById('wrongList');
        if (!container) return;

        const categoryFilter = document.getElementById('wrongCategoryFilter');
        const category = categoryFilter ? categoryFilter.value : '';
        
        let filtered = this.wrongQuestions;
        
        if (category) {
            filtered = filtered.filter(item => item.question.category === category);
        }
        
        const wrongCount = document.getElementById('wrongCount');
        if (wrongCount) wrongCount.textContent = filtered.length;
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px; text-align: center;">
                    <i class="fas fa-check-circle" style="font-size: 3rem; color: #4CAF50;"></i>
                    <p style="margin-top: 10px; font-size: 16px;">暂时没有错题，继续保持！</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        const batchSize = 20;
        let currentBatch = 0;

        const renderBatch = () => {
            const start = currentBatch * batchSize;
            const end = start + batchSize;
            const batch = filtered.slice(start, end);

            batch.forEach((item, index) => {
                const question = item.question;
                const wrongItem = document.createElement('div');
                wrongItem.className = 'wrong-item';
                wrongItem.style.padding = '15px';
                wrongItem.style.marginBottom = '10px';
                wrongItem.style.backgroundColor = this.settings.darkMode ? '#333' : '#fff';
                wrongItem.style.borderRadius = '8px';

                let answerText;
                if(Array.isArray(item.userAnswer)){
                    answerText = item.userAnswer.join(', ');
                } else {
                    const ans = String(item.userAnswer).toUpperCase();
                    if(ans === 'A') answerText = '正确';
                    else if (ans === 'B') answerText = '错误';
                    else answerText = ans;
                }
                
                const correctAnswerText = Array.isArray(question.answer)
                    ? question.answer.join(', ')
                    : question.answer;

                wrongItem.innerHTML = `
                    <div class="wrong-question" style="font-size: 15px; margin-bottom: 8px;">${start + index + 1}. ${question.question}</div>
                    <div class="wrong-answer" style="font-size: 14px; color: #f44336; margin-bottom: 4px;">你的答案：${answerText || '未作答'}</div>
                    <div class="correct-answer" style="font-size: 14px; color: #4CAF50; margin-bottom: 8px;">正确答案：${correctAnswerText}</div>
                    ${question.explanation ? `
                        <div class="wrong-explanation" style="font-size: 14px; color: #666; margin-bottom: 8px;">
                            <strong>解析：</strong>${question.explanation}
                        </div>
                    ` : ''}
                    <div style="font-size: 0.8rem; color: #888;">
                        错误次数: ${item.wrongCount || 1} | ${new Date(item.timestamp).toLocaleDateString()} 
                        | ${question.category || '未分类'}
                    </div>
                    <button class="practice-wrong-btn" data-id="${question.id}" style="margin-top: 10px; padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 6px; font-size: 14px;">练习本题</button>
                `;

                const practiceBtn = wrongItem.querySelector('.practice-wrong-btn');
                practiceBtn.addEventListener('click', () => {
                    this.practiceSingleQuestion(question);
                });

                container.appendChild(wrongItem);
            });

            currentBatch++;
            if (end < filtered.length) {
                setTimeout(renderBatch, 100);
            }
        };

        renderBatch();
    }

    updateStats() {
        const wrongCountElem = document.getElementById('wrongCount');
        if (wrongCountElem) wrongCountElem.textContent = this.wrongQuestions.length;
        
        const difficultCountElem = document.getElementById('difficultCount');
        if (difficultCountElem) difficultCountElem.textContent = this.difficultQuestions.length;
        
        const recentSessions = JSON.parse(localStorage.getItem('recentSessions') || '[]');
        if (recentSessions.length > 0) {
            const totalQuestions = recentSessions.reduce((sum, session) => sum + session.total, 0);
            const correctAnswers = recentSessions.reduce((sum, session) => sum + session.score, 0);
            const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
            const accuracyRate = document.getElementById('accuracyRate');
            if (accuracyRate) accuracyRate.textContent = `${accuracy}%`;
        }
    }

    updateRecentSessions(score, total) {
        if (score !== undefined && total !== undefined) {
            let sessions = JSON.parse(localStorage.getItem('recentSessions') || '[]');
            sessions.unshift({
                score,
                total,
                timestamp: new Date().toISOString()
            });

            if (sessions.length > 10) {
                sessions = sessions.slice(0, 10);
            }

            localStorage.setItem('recentSessions', JSON.stringify(sessions));
        }

        const container = document.getElementById('recentSessions');
        if (!container) return;

        const sessions = JSON.parse(localStorage.getItem('recentSessions') || '[]');
        
        if (sessions.length === 0) {
            container.innerHTML = '<p class="empty-text">暂无练习记录</p>';
            return;
        }

        container.innerHTML = sessions.map(session => {
            const date = new Date(session.timestamp).toLocaleString();
            const accuracy = Math.round((session.score / session.total) * 100);
            return `
                <div class="session-item" style="padding: 10px; margin-bottom: 8px; border-radius: 6px; background: ${this.settings.darkMode ? '#444' : '#f5f5f5'};">
                    <div style="font-size: 14px;">${date}</div>
                    <div style="font-size: 14px; color: #4CAF50;">${session.score}/${session.total} (${accuracy}%)</div>
                </div>
            `;
        }).join('');
    }

    toggleExplanation() {
        const box = document.getElementById('explanationBox');
        const question = this.currentExam[this.currentQuestionIndex];
        
        if (box && box.style.display === 'none') {
            const explanationText = document.getElementById('explanationText');
            if (explanationText) explanationText.textContent = question.explanation || '暂无解析';
            box.style.display = 'block';
            box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (box) {
            box.style.display = 'none';
        }
    }

    markQuestion() {
        const btn = document.getElementById('markQuestionBtn');
        if (!btn) return;
        
        btn.classList.toggle('marked');
        btn.innerHTML = btn.classList.contains('marked') 
            ? '<i class="fas fa-bookmark"></i>' 
            : '<i class="far fa-bookmark"></i>';
        
        this.showToast(btn.classList.contains('marked') ? '题目已标记' : '取消标记', 'info');
        if (this.settings.vibration && navigator.vibrate) {
            navigator.vibrate(100);
        }
    }

    startTimer() {
        clearInterval(this.timerInterval);
        
        const endTime = this.examStartTime.getTime() + (this.timeLimit * 1000);
        
        this.timerInterval = setInterval(() => {
            if (this.timerPaused) return;
            const now = new Date().getTime();
            const timeLeft = endTime - now;
            
            if (timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.finishSession();
                return;
            }
            
            const minutes = Math.floor(timeLeft / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
            
            const timerElem = document.getElementById('timer');
            if (timerElem) timerElem.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft < 60 * 1000 && !this.timeWarning) {
                this.timeWarning = true;
                this.showToast('剩余时间不足1分钟！', 'warning');
                if (this.settings.vibration) {
                    navigator.vibrate([100, 50, 100]);
                }
            }
        }, 1000);
    }

    updateProgress() {
        if (!this.currentExam) return;
        
        const progress = ((this.currentQuestionIndex + 1) / this.currentExam.length) * 100;
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.width = `${progress}%`;
    }

    async importExcel(file) {
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            this.questions = jsonData.map((row, index) => {
                return {
                    id: index + 1,
                    type: this.detectQuestionType(row),
                    question: row['题目'] || row['question'] || '',
                    options: this.parseOptions(row),
                    answer: this.parseAnswer(row),
                    explanation: row['解析'] || row['explanation'] || '',
                    category: row['题型'] || row['category'] || '未分类',
                    difficulty: parseInt(row['难度']) || 1
                };
            });

            localStorage.setItem('questions', JSON.stringify(this.questions));  // 先存入本地存储
            
            this.updateQuestionCount();
            this.extractCategories();
            
            this.showToast(`成功导入 ${this.questions.length} 道题目`, 'success');
            //this.downloadJSON(this.questions, 'questions.json');
            
        } catch (error) {
            console.error('导入失败:', error);
            this.showToast('导入失败，请检查Excel格式', 'error');
        }
    }

    detectQuestionType(row) {

        let type = row['题型'] || row['type'] || '';
        if (type) {
            if (type.includes('多选')) return 'multiple';
            if (type.includes('判断')) return 'judge';
            if (type.includes('单选')) return 'single';
            return 'single';
        }

        const answer = row['答案'] || row['answer'] || '';
        if (typeof answer === 'string' && answer.length > 0) {
            const hasMultipleLetters = /^[A-F,]+$/i.test(answer) && answer.length > 1 && !/^[A-F]$/i.test(answer);
            if(hasMultipleLetters){
                return 'multiple';
            }
        }

        const options = this.parseOptions(row);
        const isJudgeByOptions = (
            options.length === 2 && (
                (options[0] === '正确' && options[1] === '错误') ||
                (options[0] === '错误' && options[1] === '正确') ||
                (options[0] === '对' && options[1] === '错') ||
                (options[0] === '错' && options[1] === '对') ||
                (options[0] === '√' && options[1] === '×') ||
                (options[0] === '×' && options[1] === '√')));
        const notSepcifiedAsSingle = !type || (!type.includes('单选'));
        if (isJudgeByOptions && notSepcifiedAsSingle){
            return 'judge';
        }      
       
        return 'single';
    }

    parseOptions(row) {
        const optionKeys = ['选项A', '选项B', '选项C', '选项D', '选项E', '选项F'];
        const options = [];
        
        optionKeys.forEach(key => {
            if (row[key]) {
                options.push(row[key]);
            }
        });
        
        if (options.length === 0 && row['选项']) {
            const optionStr = row['选项'];
            return optionStr.split('|').filter(opt => opt.trim());
        }
        
        return options;
    }

    parseAnswer(row) {
        const answer = row['答案'] || row['answer'] || '';

        if (answer === '正确' || answer === '对' || answer === '√') {
        return 'A';
        }

        if (answer === '错误' || answer === '错' || answer === '×') {
        return 'B';
        }
        
        if (Array.isArray(answer)) {
            return answer;
        }
        
        if (typeof answer === 'string') {
            if (answer.length > 1 && /^[A-F]+$/i.test(answer)) {
                return answer.toUpperCase().split('').sort();
            }
            if (answer.includes(',')) {
            return answer.split(',').map(s => s.trim().toUpperCase()).sort();
            }
            return answer.toUpperCase();
        }
        
        return '';
    }

    exportWrongQuestions() {
        if (this.wrongQuestions.length === 0) {
            this.showToast('没有错题可以导出', 'warning');
            return;
        }
        
        const dataStr = JSON.stringify(this.wrongQuestions, null, 2);
        this.downloadJSON(dataStr, `错题本_${new Date().toISOString().split('T')[0]}.json`);
        this.showToast('错题本导出成功', 'success');
    }

    exportAllData() {
        const data = {
            questions: this.questions,
            wrongQuestions: this.wrongQuestions,
            difficultQuestions: this.difficultQuestions,
            settings: this.settings,
            exportDate: new Date().toISOString()
        };
        
        this.downloadJSON(data, `考试数据备份_${new Date().toISOString().split('T')[0]}.json`);
        this.showToast('数据备份成功', 'success');
    }

    downloadJSON(data, filename) {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.touchAction = 'manipulation';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    applyTheme() {
        if (this.settings.darkMode) {
            document.body.classList.add('dark-mode');
            const darkModeToggle = document.getElementById('darkModeToggle');
            if (darkModeToggle) darkModeToggle.checked = true;
            const themeColor = document.querySelector('meta[name="theme-color"]');
            if (themeColor) themeColor.setAttribute('content', '#121212');
        } else {
            document.body.classList.remove('dark-mode');
            const darkModeToggle = document.getElementById('darkModeToggle');
            if (darkModeToggle) darkModeToggle.checked = false;
            const themeColor = document.querySelector('meta[name="theme-color"]');
            if (themeColor) themeColor.setAttribute('content', '#ffffff');
        }
    }

    showToast(message, type = 'info') {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.padding = '12px 20px';
            toast.style.borderRadius = '24px';
            toast.style.color = 'white';
            toast.style.fontSize = '14px';
            toast.style.zIndex = '9999';
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        
        const typeColors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        
        toast.style.background = typeColors[type] || '#333';
        toast.style.opacity = '1';

        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }

    showConfirm(message, callback) {
        const confirmBox = document.createElement('div');
        confirmBox.style.position = 'fixed';
        confirmBox.style.top = '50%';
        confirmBox.style.left = '50%';
        confirmBox.style.transform = 'translate(-50%, -50%)';
        confirmBox.style.padding = '20px';
        confirmBox.style.backgroundColor = this.settings.darkMode ? '#333' : '#fff';
        confirmBox.style.borderRadius = '12px';
        confirmBox.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
        confirmBox.style.zIndex = '10000';
        confirmBox.style.maxWidth = '80%';
        confirmBox.style.width = '300px';

        confirmBox.innerHTML = `
            <div style="font-size: 16px; margin-bottom: 20px; text-align: center;">${message}</div>
            <div style="display: flex; gap: 10px;">
                <button id="confirmCancel" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: #eee; color: #333;">取消</button>
                <button id="confirmOk" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: #2196F3; color: white;">确定</button>
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '9999';

        document.body.appendChild(overlay);
        document.body.appendChild(confirmBox);

        const cancelBtn = document.getElementById('confirmCancel');
        const okBtn = document.getElementById('confirmOk');
        
        const cleanup = () => {
            if (confirmBox.parentNode) document.body.removeChild(confirmBox);
            if (overlay.parentNode) document.body.removeChild(overlay);
        };
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                cleanup();
                callback(false);
            });
            cancelBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                cleanup();
                callback(false);
            });
        }
        
        if (okBtn) {
            okBtn.addEventListener('click', () => {
                cleanup();
                callback(true);
            });
            okBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                cleanup();
                callback(true);
            });
        }
    }

    showModal(options) {
        const { title, content, confirmText = '确定', onConfirm = () => {} } = options;

        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.padding = '20px';
        modal.style.backgroundColor = this.settings.darkMode ? '#333' : '#fff';
        modal.style.borderRadius = '12px';
        modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
        modal.style.zIndex = '10000';
        modal.style.maxWidth = '80%';
        modal.style.width = '300px';

        modal.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; text-align: center;">${title}</div>
            <div style="font-size: 16px; margin-bottom: 20px; white-space: pre-line; text-align: center;">${content}</div>
            <button id="modalConfirm" style="width: 100%; padding: 12px; border: none; border-radius: 8px; background: #2196F3; color: white; font-size: 16px;">${confirmText}</button>
        `;

        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '9999';

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        const confirmBtn = document.getElementById('modalConfirm');
        
        const cleanup = () => {
            if (modal.parentNode) document.body.removeChild(modal);
            if (overlay.parentNode) document.body.removeChild(overlay);
        };
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                cleanup();
                onConfirm();
            });
            confirmBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                cleanup();
                onConfirm();
            });
        }
    }

    getQuestionTypeText(type) {
        const types = {
            single: '单选题',
            multiple: '多选题',
            judge: '判断题'
        };
        return types[type] || '单选题';
    }

    getDifficultyText(difficulty) {
        if (difficulty >= 4) return '困难';
        if (difficulty >= 3) return '中等';
        return '简单';
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js')
                    .then(registration => {
                        console.log('ServiceWorker注册成功:', registration.scope);
                    })
                    .catch(error => {
                        console.log('ServiceWorker注册失败:', error);
                    });
            });
        }
    }

    setupHideNavOnScroll() {
        let lastScrollY = 0;
        let ticking = false;

        window.addEventListener('scroll', () => {
            if(!ticking){
                requestAnimationFrame(() => {
                    const nav = document.querySelector('.bottom-nav');
                    const currentScrollY = window.scrollY;

                    if(currentScrollY > lastScrollY && currentScrollY > 100){
                        if (nav) nav.classList.add('hide');
                    } else if (currentScrollY < lastScrollY) {
                        if (nav) nav.classList.remove('hide');
                    }

                    lastScrollY = currentScrollY;
                    ticking = false;
                });
                ticking = true;
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
        const now = Date.now();
        if (now - lastTouchEnd < 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });

    document.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    window.examApp = new ExamApp();
});