// 考试练习工具 - 核心逻辑
class ExamApp {
    constructor() {
        this.questions = [];
        this.currentExam = null;
        this.userAnswers = {};
        this.wrongQuestions = JSON.parse(localStorage.getItem('wrongQuestions') || '[]');
        this.settings = JSON.parse(localStorage.getItem('examSettings') || '{}');
        this.initSettings();
        this.init();
    }

    initSettings() {
        const defaultSettings = {
            timePerQuestion: 120,
            questionsPerSession: 20,
            darkMode: false,
            vibration: false,
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
        this.setupTouchEvents();    // new: touched event init
        this.updateStats();
        this.updateRecentSessions();
        this.applyTheme();
        this.registerServiceWorker();
        this.setupHideNavOnScroll();
        
        // 首次加载显示提示
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
                const response = await fetch('questions.json');
                const data = await response.json();
                this.questions = data.questions || [];
                // 缓存到本地
                localStorage.setItem('questions', JSON.stringify(this.questions));
            }         
            this.updateQuestionCount();
            
            // 提取所有分类
            this.extractCategories();
        } catch (error) {
            console.log('未找到题库文件，请先导入Excel文件');
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
    }

    updateQuestionCount() {
        document.getElementById('totalQuestions').textContent = this.questions.length;
    }

    setupEventListeners() {
        // 底部导航
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                //const page = e.currentTarget.dataset.page;
                //this.switchPage(page);
                this.handleNavClick(e);
                
                // 更新活动状态
                //document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                //e.currentTarget.classList.add('active');
            });
            item.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.handleNavClick(e);
            });
        });

        // 开始练习按钮
        this.addMultiEventListener('startExamBtn', ['click', 'touchend'], () =>{
            this.startNewExam();
        });
        /* document.getElementById('startExamBtn').addEventListener('click', () => {
            this.startNewExam();
        }); */

        // 错题本按钮
        this.addMultiEventListener('wrongQuestionsBtn', ['click', 'touchend'], () =>{
            this.loadWrongQuestions();
            this.switchPage('wrongPage');
        });
        /* document.getElementById('wrongQuestionsBtn').addEventListener('click', () => {
            this.loadWrongQuestions();
            this.switchPage('wrongPage');
        }); */

        // 设置按钮
        this.addMultiEventListener('settingsBtn', ['click', 'touchend'], () =>{
            this.switchPage('settingsPage')
        });
        /* document.getElementById('settingsBtn').addEventListener('click', () => {
            this.switchPage('settingsPage');
        }); */

        // 返回按钮
        this.addMultiEventListener('backToHome', ['click', 'touchend'], () =>{
            this.switchPage('homePage');
            document.querySelector('.nav-item[data-page="homePage"]').click();
        });
        /* document.getElementById('backToHome').addEventListener('click', () => {
            this.switchPage('homePage');
            document.querySelector('.nav-item[data-page="homePage"]').click();
        }); */

        this.addMultiEventListener('backFromWrong', ['click', 'touchend'], () =>{
            this.switchPage('homePage');
            document.querySelector('.nav-item[data-page="homePage"]').click();
        });

        /* document.getElementById('backFromWrong').addEventListener('click', () => {
            this.switchPage('homePage');
            document.querySelector('.nav-item[data-page="homePage"]').click();
        }); */

        this.addMultiEventListener('backFromSettings', ['click', 'touchend'], () =>{
            this.switchPage('homePage');
            document.querySelector('.nav-item[data-page="homePage"]').click();
        });
        /* document.getElementById('backFromSettings').addEventListener('click', () => {
            this.switchPage('homePage');
            document.querySelector('.nav-item[data-page="homePage"]').click();
        }); */

        // 上一题/下一题
        this.addMultiEventListener('prevQuestion', ['click', 'touchend'], () =>{
            this.prevQuestion();
        });
        /* document.getElementById('prevQuestion').addEventListener('click', () => {
            this.prevQuestion();
        }); */
        
        this.addMultiEventListener('nextQuestion', ['click', 'touchend'], () =>{
            this.nextQuestion();
        });
        /* document.getElementById('nextQuestion').addEventListener('click', () => {
            this.nextQuestion();
        }); */

        // 查看解析
        this.addMultiEventListener('showExplanationBtn', ['click', 'touchend'], () =>{
            this.toggleExplanation();
        });
        /* document.getElementById('showExplanationBtn').addEventListener('click', () => {
            this.toggleExplanation();
        }); */

        // 标记题目
        this.addMultiEventListener('markQuestionBtn', ['click', 'touchend'], () =>{
            this.markQuestion();
        });
        document.getElementById('markQuestionBtn').addEventListener('long-press', () => {
            this.markQuestion();
            this.showToast('长按标记题目', 'info');
        });
        /* document.getElementById('markQuestionBtn').addEventListener('click', () => {
            this.markQuestion();
        }); */

        // 设置项变化
        document.getElementById('timePerQuestion').addEventListener('change', (e) => {
            this.settings.timePerQuestion = parseInt(e.target.value);
            this.saveSettings();
        });

        document.getElementById('questionsPerSession').addEventListener('change', (e) => {
            this.settings.questionsPerSession = parseInt(e.target.value);
            this.saveSettings();
        });

        document.getElementById('darkModeToggle').addEventListener('change', (e) => {
            this.settings.darkMode = e.target.checked;
            this.saveSettings();
            this.applyTheme();
        });

        document.getElementById('vibrationToggle').addEventListener('change', (e) => {
            this.settings.vibration = e.target.checked;
            this.saveSettings();
        });

        // 导入Excel
        this.addMultiEventListener('importExcelBtn', ['click', 'touchend'], () => {
            document.getElementById('excelFile').click();
        });
        /* document.getElementById('importExcelBtn').addEventListener('click', () => {
            document.getElementById('excelFile').click();
        }); */

        document.getElementById('excelFile').addEventListener('change', (e) => {
            this.importExcel(e.target.files[0]);
        });

        // 导出错题本
        this.addMultiEventListener('exportWrongBtn', ['click', 'touchend'], () => {
            this.exportWrongQuestions();
        });
        /* document.getElementById('exportWrongBtn').addEventListener('click', () => {
            this.exportWrongQuestions();
        }); */

        // 清空错题
        this.addMultiEventListener('clearWrongBtn', ['click', 'touchend'], () => {
            // 替换confirm为移动端友好的确认框
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
        /* document.getElementById('clearWrongBtn').addEventListener('click', () => {
            if (confirm('确定要清空所有错题吗？')) {
                this.wrongQuestions = [];
                localStorage.setItem('wrongQuestions', JSON.stringify([]));
                this.loadWrongQuestions();
                this.updateStats();
                this.showToast('已清空错题本', 'success');
            }
        }); */

        // 主题切换
        this.addMultiEventListener('themeToggle', ['click', 'touchend'], () => {
            this.settings.darkMode = !this.settings.darkMode;
            this.saveSettings();
            this.applyTheme();
        });
        /* document.getElementById('themeToggle').addEventListener('click', () => {
            this.settings.darkMode = !this.settings.darkMode;
            this.saveSettings();
            this.applyTheme();
        }); */

        // 导出数据
        this.addMultiEventListener('exportBtn', ['click', 'touchend'], () => {
            this.exportAllData();
        });
        /* document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportAllData();
        }); */

        // 筛选器
        document.getElementById('categoryFilter').addEventListener('change', () => {
            this.loadWrongQuestions();
        });

        document.getElementById('difficultyFilter').addEventListener('change', () => {
            this.loadWrongQuestions();
        });
    }

    // 新增：移动端触摸事件初始化（核心）
    setupTouchEvents() {
        const examContainer = document.getElementById('examPage');
        if (!examContainer) return;

        // 1. 滑动切换题目（移动端核心交互）
        let touchStartX = 0;
        let touchStartY = 0;
        let isSwiping = false;

        examContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = true;
            // 暂停定时器（防止滑动时误触）
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

            // 只处理水平滑动（避免垂直滚动误判）
            if (Math.abs(diffX) > Math.abs(diffY)) {
                e.preventDefault(); // 阻止页面滚动
            }
        });

        examContainer.addEventListener('touchend', (e) => {
            if (!isSwiping) return;
            isSwiping = false;
            
            // 恢复定时器
            this.timerPaused = false;

            const touchEndX = e.changedTouches[0].clientX;
            const diffX = touchStartX - touchEndX;

            // 滑动阈值（50px）
            if (Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    // 左滑 → 下一题
                    this.nextQuestion();
                } else {
                    // 右滑 → 上一题
                    this.prevQuestion();
                }
            }
        });

        // 2. 实现长按事件（标记题目）
        this.setupLongPressEvent();

        // 3. 移动端后台时暂停计时
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerPaused = true;
            } else if (!document.hidden && this.timerPaused && this.currentExam) {
                this.startTimer(); // 恢复计时
            }
        });
    }

    // 新增：通用事件绑定方法（支持多事件类型）
    addMultiEventListener(elementId, events, handler) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        events.forEach(event => {
            element.addEventListener(event, (e) => {
                if (event === 'touchend') e.preventDefault();
                handler(e);
            });
        });
    }

    // 新增：处理导航点击（复用逻辑）
    handleNavClick(e) {
        const page = e.currentTarget.dataset.page;
        this.switchPage(page);
        
        // 更新活动状态
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        e.currentTarget.classList.add('active');
    }

    // 新增：实现长按事件
    setupLongPressEvent() {
        let longPressTimer;
        const longPressThreshold = 500; // 长按阈值（500ms）

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
        document.getElementById(pageId).classList.add('active');
        // 移动端：切换页面后滚动到顶部
        window.scrollTo(0, 0);
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
        this.currentQuestionIndex = 0;
        this.examStartTime = new Date();
        this.timeLimit = (this.settings.timePerQuestion || 120) * count;

        this.switchPage('examPage');
        this.showQuestion(0);
        this.startTimer();
        this.updateProgress();
    }

    generateRandomPaper(count) {
        // 随机选择题目
        const shuffled = [...this.questions].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    showQuestion(index) {
        if (!this.currentExam || index < 0 || index >= this.currentExam.length) {
            return;
        }

        this.currentQuestionIndex = index;
        const question = this.currentExam[index];

        // 更新UI
        document.getElementById('questionType').textContent = this.getQuestionTypeText(question.type);
        document.getElementById('questionDifficulty').textContent = this.getDifficultyText(question.difficulty);
        document.getElementById('questionText').textContent = question.question;
        
        // 更新进度
        document.getElementById('currentQuestionNum').textContent = index + 1;
        document.getElementById('totalQuestionsNum').textContent = this.currentExam.length;

        // 渲染选项
        this.renderOptions(question);

        // 更新导航按钮状态
        document.getElementById('prevQuestion').disabled = index === 0;
        document.getElementById('nextQuestion').textContent = 
            index === this.currentExam.length - 1 ? '提交' : '下一题';

        // 隐藏解析
        document.getElementById('explanationBox').style.display = 'none';

        // 恢复已选答案
        const userAnswer = this.userAnswers[index];
        if (userAnswer) {
            this.selectAnswer(userAnswer, false);
        }

        const savedAnswer = this.userAnswers[index];
        if(savedAnswer !== undefined){
            if(Array.isArray(savedAnswer)){
                savedAnswer.forEach(ans => {
                    const el = document.querySelector(`.option-item[data-value="${ans}"]`);
                    if (el) el.classList.add('selected');
                });
            }
            else {
                const el = document.querySelector(`.option-item[data-value="${savedAnswer}"]`);
                if(el) el.classList.add('selected');
            }
        }
        this.updateProgress();
    }

    renderOptions(question) {
        const container = document.getElementById('optionsContainer');
        container.innerHTML = '';

        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

        // 判断题特殊处理（优先）
        if (question.type === 'judge') {
            const judgeOptions = [
                { letter: 'A', text: '正确' },
                { letter: 'B', text: '错误' }
            ];

            judgeOptions.forEach(opt => {
                const optionDiv = this.createOptionElement(opt.letter, opt.text);
                container.appendChild(optionDiv);
            });
            return;
        }

        // 多选题
        if (question.type === 'multiple') {
            question.options.forEach((option, index) =>{
                const optionDiv = this.createOptionElement(letters[index], option);
                container.appendChild(optionDiv);
            });
            return;
        }

        // 单选题
        question.options.forEach((option, index) => {
            const optionDiv = this.createOptionElement(letters[index], option);
            container.appendChild(optionDiv);
        });
    }

    // 新增：创建选项元素（移动端优化）
    createOptionElement(letter, text) {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option-item';
        optionDiv.dataset.value = letter;
        optionDiv.style.touchAction = 'manipulation'; // 消除300ms延迟

        optionDiv.innerHTML = `
            <div class="option-letter">${letter}</div>
            <div class="option-text">${text}</div>
        `;

        const question = this.currentExam[this.currentQuestionIndex];
        const isMultiple = question && question.type === 'multiple';

        // 绑定点击+触摸事件
        optionDiv.addEventListener('click', () => {
            if(isMultiple){
                this.toggleMultipleAnswer(letter);
            } else {
                this.selectSingleAnswer(letter);
            }
        });

        optionDiv.addEventListener('touchend', (e) => {
            e.preventDefault();
            if(isMultiple){
                this.toggleMultipleAnswer(letter);
            } else {
                this.selectSingleAnswer(letter);
            }
        });

        // 长按选中（多选题）
        optionDiv.addEventListener('long-press', () => {
            this.showToast(`选中选项 ${letter}`, 'info');
            if(isMultiple){
                this.toggleMultipleAnswer(letter);
            } else {
                this.selectSingleAnswer(letter);
            }
        });

        return optionDiv;
    }

    selectSingleAnswer(answer){
        document.querySelectorAll('.option-item').forEach(item => {
            item.classList.remove('selected');
        });
        const selectedOption = document.querySelector(`.option-item[data-value="${answer}"]`);
        if(selectedOption){
            selectedOption.classList.add('selected');
        }

        this.userAnswers[this.currentQuestionIndex] = answer;

        if (this.settings.vibration && navigator.vibrate) {
            // 不同平台振动模式
            if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
                navigator.vibrate(30); // iOS短振动
            } else {
                navigator.vibrate(50); // Android标准振动
            }
        }
    }

    toggleMultipleAnswer(answer){
        const optionElement = document.querySelector(`.option-item[data-value="${answer}"]`);

        let currentAnswer = this.userAnswers[this.currentQuestionIndex];
        if(!Array.isArray(currentAnswer)){
            currentAnswer =[];
        }

        const index = currentAnswer.indexOf(answer);
        if(index === -1){
            currentAnswer.push(answer);
            optionElement.classList.add('selected');
        } else {
            currentAnswer.splice(index, 1);
            optionElement.classList.remove('selected');
        }
        
        this.userAnswers[this.currentQuestionIndex] = currentAnswer;

        if (this.settings.vibration && navigator.vibrate) {
            // 不同平台振动模式
            if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
                navigator.vibrate(30); // iOS短振动
            } else {
                navigator.vibrate(50); // Android标准振动
            }
        }

    }

    /* selectAnswer(answer, save = true) {
        const question = this.currentExam[this.currentQuestionIndex];
        
        // 多选题处理
        if (question.type === 'multiple') {
            if (!Array.isArray(this.userAnswers[this.currentQuestionIndex])) {
                this.userAnswers[this.currentQuestionIndex] = [];
            }
            const index = this.userAnswers[this.currentQuestionIndex].indexOf(answer);
            if (index === -1) {
                this.userAnswers[this.currentQuestionIndex].push(answer);
                // 多选时标记选中状态
                document.querySelector(`.option-item[data-value="${answer}"]`).classList.add('selected');
            } else {
                this.userAnswers[this.currentQuestionIndex].splice(index, 1);
                document.querySelector(`.option-item[data-value="${answer}"]`).classList.remove('selected');
            }
        } else {
            // 单选/判断：清除之前的选中状态
            document.querySelectorAll('.option-item').forEach(item => {
                item.classList.remove('selected');
            });
            // 标记选中的选项
            const selectedOption = document.querySelector(`.option-item[data-value="${answer}"]`);
            if (selectedOption) {
                selectedOption.classList.add('selected');
            }
            // 保存答案
            if (save) {
                this.userAnswers[this.currentQuestionIndex] = answer;
            }
        }

        // 振动反馈（移动端优化）
        if (this.settings.vibration && navigator.vibrate) {
            // 不同平台振动模式
            if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
                navigator.vibrate(30); // iOS短振动
            } else {
                navigator.vibrate(50); // Android标准振动
            }
        }
    } */


    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.showQuestion(this.currentQuestionIndex - 1);
            this.showToast('上一题', 'info');
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.currentExam.length - 1) {
            this.showQuestion(this.currentQuestionIndex + 1);
            this.showToast('下一题', 'info');
        } else {
            this.submitExam();
        }
    }

    submitExam() {

        function normalizeAnswer(answer){
            if(Array.isArray(answer)){
                return answer.sort().join('');
            }

            if(typeof answer === 'string'){
                return answer.split(',').map(s => s.trim()).sort().join('');
            }

            return String(answer);
        }

        clearInterval(this.timerInterval);
        
        let score = 0;
        const wrongAnswers = [];

        // 批改试卷
        this.currentExam.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            const correctAnswer = question.answer;
            let isCorrect = false;

            if (question.type === 'multiple') {
                const userKey = normalizeAnswer(userAnswer);
                const correctKey = normalizeAnswer(correctAnswer);
                isCorrect = userKey === correctKey;

                // 多选需要完全匹配
                /* if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
                    const sortedUser = [...userAnswer].sort();
                    const sortedCorrect = [...correctAnswer].sort();
                    isCorrect = JSON.stringify(sortedUser) === JSON.stringify(sortedCorrect);
                } */
            } else {
                if(question.type === 'judge'){
                    const userAns = userAnswer === '正确' ? 'A' : (userAnswer === '错误' ? 'B' : userAnswer);
                    const correctAns = correctAnswer === '正确' ? 'A' : (correctAnswer === '错误' ? 'B' : correctAnswer);
                    isCorrect = userAns === correctAns;
                } else {
                    isCorrect = userAnswer === correctAnswer;
                }
                
            }

            if (isCorrect) {
                score++;
            } else {
                wrongAnswers.push({
                    question,
                    userAnswer,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 保存错题
        wrongAnswers.forEach(wrong => {
            this.addWrongQuestion(wrong.question, wrong.userAnswer);
        });

        // 显示结果
        const accuracy = Math.round((score / this.currentExam.length) * 100);
        const message = `练习完成！\n正确率：${accuracy}% (${score}/${this.currentExam.length})`;
        const subMessage = wrongAnswers.length > 0 ? `\n错题数：${wrongAnswers.length}` : '';

        this.showModal({
            title: '练习结果',
            content: message + subMessage,
            confirmText: '确定',
            onConfirm: () => {
                // 返回首页
                this.switchPage('homePage');
                document.querySelector('.nav-item[data-page="homePage"]').click();
                // 更新统计
                this.updateStats();
                this.updateRecentSessions(score, this.currentExam.length);
            }
        });
        
        
        /* if (wrongAnswers.length > 0) {
            message += `\n错题数：${wrongAnswers.length}`;
        }

        alert(message);

        // 返回首页
        this.switchPage('homePage');
        document.querySelector('.nav-item[data-page="homePage"]').click();
        
        // 更新统计
        this.updateStats();
        this.updateRecentSessions(score, this.currentExam.length); */
    }

    addWrongQuestion(question, userAnswer) {
        // 检查是否已存在
        const exists = this.wrongQuestions.some(wrong => 
            wrong.question.id === question.id && 
            wrong.timestamp > Date.now() - 24 * 60 * 60 * 1000 // 24小时内
        );

        if (!exists) {
            this.wrongQuestions.unshift({
                question,
                userAnswer,
                timestamp: new Date().toISOString()
            });

            // 最多保存500条错题
            if (this.wrongQuestions.length > 500) {
                this.wrongQuestions = this.wrongQuestions.slice(0, 500);
            }

            // 移动端：分批存储避免卡顿
            setTimeout(() => {
                localStorage.setItem('wrongQuestions', JSON.stringify(this.wrongQuestions));
                this.updateStats();
            }, 0);            

            /* localStorage.setItem('wrongQuestions', JSON.stringify(this.wrongQuestions));
            this.updateStats(); */
        }
    }

    loadWrongQuestions() {
        const container = document.getElementById('wrongList');
        if (!container) return;

        const categoryFilter = document.getElementById('categoryFilter').value;
        const difficultyFilter = document.getElementById('difficultyFilter').value;

        let filtered = this.wrongQuestions;

        if (categoryFilter) {
            filtered = filtered.filter(item => item.question.category === categoryFilter);
        }

        if (difficultyFilter) {
            filtered = filtered.filter(item => item.question.difficulty == difficultyFilter);
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px; text-align: center;">
                    <i class="fas fa-check-circle" style="font-size: 3rem; color: #4CAF50;"></i>
                    <p style="margin-top: 10px; font-size: 16px;">暂时没有错题，继续保持！</p>
                </div>
            `;
            return;
        }

        /* if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle" style="font-size: 3rem; color: #4CAF50;"></i>
                    <p>暂时没有错题，继续保持！</p>
                </div>
            `;
            return;
        } */

        container.innerHTML = '';

        // 移动端：分批渲染避免卡顿
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
                    if(ans === 'A') answerText = 'A. 正确';
                    else if (ans === 'B') answerText = 'B. 错误';
                    else answerText = ans;
                }
                /* const answerText = Array.isArray(item.userAnswer) 
                    ? item.userAnswer.join(', ') 
                    : item.userAnswer; */
                
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
                        ${new Date(item.timestamp).toLocaleDateString()} 
                        | ${question.category}
                    </div>
                `;

                // 移动端：点击错题可查看详情
                wrongItem.addEventListener('click', () => {
                    this.showModal({
                        title: '错题详情',
                        content: wrongItem.innerHTML,
                        confirmText: '关闭'
                    });
                });

                container.appendChild(wrongItem);
            });

            currentBatch++;
            if (end < filtered.length) {
                // 延迟渲染下一批（避免卡顿）
                setTimeout(renderBatch, 100);
            }
        };

        renderBatch();

        /* filtered.forEach((item, index) => {
            const question = item.question;
            const wrongItem = document.createElement('div');
            wrongItem.className = 'wrong-item';

            const answerText = Array.isArray(item.userAnswer) 
                ? item.userAnswer.join(', ') 
                : item.userAnswer;
            
            const correctAnswerText = Array.isArray(question.answer)
                ? question.answer.join(', ')
                : question.answer;

            wrongItem.innerHTML = `
                <div class="wrong-question">${index + 1}. ${question.question}</div>
                <div class="wrong-answer">你的答案：${answerText || '未作答'}</div>
                <div class="correct-answer">正确答案：${correctAnswerText}</div>
                ${question.explanation ? `
                    <div class="wrong-explanation">
                        <strong>解析：</strong>${question.explanation}
                    </div>
                ` : ''}
                <div style="margin-top: 10px; font-size: 0.8rem; color: #888;">
                    ${new Date(item.timestamp).toLocaleDateString()} 
                    | ${question.category}
                </div>
            `;

            container.appendChild(wrongItem);
        }); */
    }

    updateStats() {
        document.getElementById('wrongCount').textContent = this.wrongQuestions.length;
        
        // 计算正确率（基于最近的练习）
        const recentSessions = JSON.parse(localStorage.getItem('recentSessions') || '[]');
        if (recentSessions.length > 0) {
            const totalQuestions = recentSessions.reduce((sum, session) => sum + session.total, 0);
            const correctAnswers = recentSessions.reduce((sum, session) => sum + session.score, 0);
            const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
            document.getElementById('accuracyRate').textContent = `${accuracy}%`;
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

            // 最多保存10次记录
            if (sessions.length > 10) {
                sessions = sessions.slice(0, 10);
            }

            localStorage.setItem('recentSessions', JSON.stringify(sessions));
        }

        // 更新显示
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

        /* container.innerHTML = sessions.map(session => {
            const date = new Date(session.timestamp).toLocaleString();
            const accuracy = Math.round((session.score / session.total) * 100);
            return `
                <div class="session-item">
                    <div>${date}</div>
                    <div>${session.score}/${session.total} (${accuracy}%)</div>
                </div>
            `;
        }).join(''); */
    }

    toggleExplanation() {
        const box = document.getElementById('explanationBox');
        const question = this.currentExam[this.currentQuestionIndex];
        
        if (box.style.display === 'none') {
            document.getElementById('explanationText').textContent = 
                question.explanation || '暂无解析';
            box.style.display = 'block';
            // 移动端：滚动到解析区域
            box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            box.style.display = 'none';
        }
    }

    markQuestion() {
        const btn = document.getElementById('markQuestionBtn');
        btn.classList.toggle('marked');
        btn.innerHTML = btn.classList.contains('marked') 
            ? '<i class="fas fa-bookmark"></i>' 
            : '<i class="far fa-bookmark"></i>';
        
        this.showToast(btn.classList.contains('marked') ? '题目已标记' : '取消标记', 'info');
        // 振动反馈
        if (this.settings.vibration && navigator.vibrate) {
            navigator.vibrate(100);
        }
    }

    startTimer() {
        clearInterval(this.timerInterval);
        
        const endTime = this.examStartTime.getTime() + (this.timeLimit * 1000);
        
        this.timerInterval = setInterval(() => {
            if (this.timerPaused) return; // 暂停时不更新
            const now = new Date().getTime();
            const timeLeft = endTime - now;
            
            if (timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.submitExam();
                return;
            }
            
            const minutes = Math.floor(timeLeft / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
            
            document.getElementById('timer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // 移动端：剩余时间少于1分钟时提醒
            if (timeLeft < 60 * 1000 && !this.timeWarning) {
                this.timeWarning = true;
                this.showToast('剩余时间不足1分钟！', 'warning');
                if (this.settings.vibration) {
                    navigator.vibrate([100, 50, 100]); // 振动提醒
                }
            }
        }, 1000);
    }

    updateProgress() {
        if (!this.currentExam) return;
        
        const progress = ((this.currentQuestionIndex + 1) / this.currentExam.length) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
    }

    async importExcel(file) {
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            // 转换Excel数据
            this.questions = jsonData.map((row, index) => {
                // 根据你的Excel列名调整这里的映射
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

            // 保存到本地存储
            localStorage.setItem('questions', JSON.stringify(this.questions));
            
            // 更新UI
            this.updateQuestionCount();
            this.extractCategories();
            
            this.showToast(`成功导入 ${this.questions.length} 道题目`, 'success');
            
            // 也可以导出为questions.json文件
            this.downloadJSON(this.questions, 'questions.json');
            
        } catch (error) {
            console.error('导入失败:', error);
            this.showToast('导入失败，请检查Excel格式', 'error');
        }
    }

    detectQuestionType(row) {
        if (row['题型']) {
            const type = row['题型'].toLowerCase();
            if (type.includes('多选')) return 'multiple';
            if (type.includes('判断')) return 'judge';
            return 'single';
        }
        
        // 根据答案长度判断
        const answer = row['答案'] || row['answer'] || '';
        if (Array.isArray(answer) || (typeof answer === 'string' && answer.length > 1)) {
            return 'multiple';
        }
        
        // 根据选项内容判断
        const options = this.parseOptions(row);
        if (options.length === 2 && options.includes('正确') && options.includes('错误')) {
            return 'judge';
        }
        
        return 'single';
    }

    parseOptions(row) {
        // 尝试从不同列名获取选项
        const optionKeys = ['选项A', '选项B', '选项C', '选项D', '选项E', '选项F'];
        const options = [];
        
        optionKeys.forEach(key => {
            if (row[key]) {
                options.push(row[key]);
            }
        });
        
        // 如果没有找到，尝试其他列名
        if (options.length === 0 && row['选项']) {
            const optionStr = row['选项'];
            // 假设选项用|分隔
            return optionStr.split('|').filter(opt => opt.trim());
        }
        
        return options;
    }

    parseAnswer(row) {
        const answer = row['答案'] || row['answer'] || '';
        
        if (Array.isArray(answer)) {
            return answer;
        }
        
        if (typeof answer === 'string') {
            // 处理多选题答案（如"ACD"）
            if (answer.length > 1) {
                return answer.split('').sort();
            }
            return answer;
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
        // 移动端：添加touch-action
        link.style.touchAction = 'manipulation';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    applyTheme() {
        if (this.settings.darkMode) {
            document.body.classList.add('dark-mode');
            document.getElementById('darkModeToggle').checked = true;
            // 移动端：更新状态栏颜色
            document.querySelector('meta[name="theme-color"]').setAttribute('content', '#121212');
        } else {
            document.body.classList.remove('dark-mode');
            document.getElementById('darkModeToggle').checked = false;
            document.querySelector('meta[name="theme-color"]').setAttribute('content', '#ffffff');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
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
        };

        toast.textContent = message;
        toast.className = 'toast';
        
        // 根据类型设置样式
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

        
        /* toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000); */
    }

    // 新增：移动端友好的确认框
    showConfirm(message, callback) {
        // 创建确认框
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

        // 创建遮罩
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

        // 绑定事件
        document.getElementById('confirmCancel').addEventListener('click', () => {
            document.body.removeChild(confirmBox);
            document.body.removeChild(overlay);
            callback(false);
        });

        document.getElementById('confirmOk').addEventListener('click', () => {
            document.body.removeChild(confirmBox);
            document.body.removeChild(overlay);
            callback(true);
        });

        // 触摸事件
        document.getElementById('confirmCancel').addEventListener('touchend', (e) => {
            e.preventDefault();
            document.body.removeChild(confirmBox);
            document.body.removeChild(overlay);
            callback(false);
        });

        document.getElementById('confirmOk').addEventListener('touchend', (e) => {
            e.preventDefault();
            document.body.removeChild(confirmBox);
            document.body.removeChild(overlay);
            callback(true);
        });
    }

    // 新增：移动端模态框
    showModal(options) {
        const { title, content, confirmText = '确定', onConfirm = () => {} } = options;

        // 创建模态框
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

        // 创建遮罩
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

        // 绑定事件
        const confirmBtn = document.getElementById('modalConfirm');
        confirmBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
            onConfirm();
        });

        confirmBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
            onConfirm();
        });
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

    setupHideNavOnScroll(){
        let lastScrollY = 0;
        let ticking = false;

        window.addEventListener('scroll', () => {
            if(!ticking){
                requestAnimationFrame(() => {
                    const nav = document.querySelector('.bottom-nav');
                    const currentScrollY = window.scrollY;

                    if(currentScrollY > lastScrollY && currentScrollY > 100){
                        nav.classList.add('hide');
                    } else if (currentScrollY < lastScrollY) {
                        nav.classList.remove('hide');
                    }

                    lastScrollY = currentScrollY;
                    ticking = false;
                });
                ticking = true;
            }
        });
    }
}

// 启动应用
window.addEventListener('DOMContentLoaded', () => {
    // 移动端：禁止双击缩放
    document.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });

    window.examApp = new ExamApp();
});