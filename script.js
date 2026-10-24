document.addEventListener('DOMContentLoaded', () => {
    // State management
    let state = {
        currentView: 'view-dashboard',
        flashcardIndex: 0,
        flashcardFlipped: false,
        flashcardDirection: 'fr-de',
        flashcardFilter: 'all',
        quizFilter: 'all',
        mcFilter: 'all',
        writeFilter: 'all',
        vocabFilterUnit: 'all',
        vocabSearchQuery: '',
        progress: JSON.parse(localStorage.getItem('vocab_progress') || '{}')
    };

    // Save Progress helper
    function saveProgress() {
        localStorage.setItem('vocab_progress', JSON.stringify(state.progress));
    }

    // Navigation logic
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));

            item.classList.add('active');
            const target = item.getAttribute('data-target');
            document.getElementById(target).classList.add('active');
            state.currentView = target;

            if (target === 'view-dashboard') updateDashboard();
            if (target === 'view-flashcards') initFlashcards();
            if (target === 'view-quiz') initQuiz();
            if (target === 'view-mc') initMC();
            if (target === 'view-write') initWrite();
            if (target === 'view-vocabulary') renderVocabularyTable();
        });
    });

    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    });

    // Reset Progress
    document.getElementById('reset-progress-btn').addEventListener('click', () => {
        if (confirm('Möchtest du wirklich deinen gesamten Lernfortschritt zurücksetzen?')) {
            state.progress = {};
            saveProgress();
            updateDashboard();
            alert('Fortschritt wurde zurückgesetzt.');
        }
    });

    // 1. Dashboard
    function updateDashboard() {
        const total = vocabularyDatabase.length;
        let learned = 0;
        let difficult = 0;
        let correct = 0;
        let wrong = 0;

        for (let id in state.progress) {
            if (state.progress[id].learned) learned++;
            if (state.progress[id].difficult) difficult++;
            correct += state.progress[id].correct || 0;
            wrong += state.progress[id].wrong || 0;
        }

        const unlearned = total - learned;
        const percent = total > 0 ? Math.round((learned / total) * 100) : 0;

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-learned').textContent = learned;
        document.getElementById('stat-unlearned').textContent = unlearned;
        document.getElementById('stat-difficult').textContent = difficult;
        document.getElementById('stat-correct').textContent = correct;
        document.getElementById('stat-wrong').textContent = wrong;
        document.getElementById('stat-percent').textContent = percent + '%';
    }

    // 2. Flashcards
    let fcList = [];
    function getFilteredFlashcards() {
        let unit = document.getElementById('fc-unit-filter').value;
        return vocabularyDatabase.filter(v => unit === 'all' || v.unit === unit);
    }

    function initFlashcards() {
        fcList = getFilteredFlashcards();
        state.flashcardIndex = 0;
        state.flashcardFlipped = false;
        renderFlashcard();
    }

    function renderFlashcard() {
        if (fcList.length === 0) {
            document.getElementById('fc-term').textContent = 'Keine Vokabeln in dieser Einheit.';
            document.getElementById('fc-hint').textContent = '';
            return;
        }
        if (state.flashcardIndex >= fcList.length) state.flashcardIndex = 0;
        if (state.flashcardIndex < 0) state.flashcardIndex = fcList.length - 1;

        const vocab = fcList[state.flashcardIndex];
        state.flashcardDirection = document.getElementById('fc-direction').value;

        const termEl = document.getElementById('fc-term');
        const hintEl = document.getElementById('fc-hint');
        const transEl = document.getElementById('fc-translation');
        const exEl = document.getElementById('fc-example');
        const unitEl = document.getElementById('fc-unit');

        unitEl.textContent = vocab.unit;
        if (state.flashcardDirection === 'fr-de') {
            termEl.textContent = vocab.fr;
            hintEl.textContent = vocab.example ? 'Beispiel / Hinweis verfügbar' : '';
            transEl.textContent = vocab.de;
            exEl.textContent = vocab.example || '';
        } else {
            termEl.textContent = vocab.de;
            hintEl.textContent = '';
            transEl.textContent = vocab.fr;
            exEl.textContent = vocab.example || '';
        }

        document.getElementById('card-inner').classList.remove('flipped');
        state.flashcardFlipped = false;

        const progressPercent = ((state.flashcardIndex + 1) / fcList.length) * 100;
        document.getElementById('fc-progress').style.width = progressPercent + '%';
    }

    document.getElementById('fc-flip').addEventListener('click', () => {
        const inner = document.getElementById('card-inner');
        state.flashcardFlipped = !state.flashcardFlipped;
        if (state.flashcardFlipped) inner.classList.add('flipped');
        else inner.classList.remove('flipped');
    });

    document.getElementById('fc-next').addEventListener('click', () => {
        state.flashcardIndex++;
        renderFlashcard();
    });

    document.getElementById('fc-prev').addEventListener('click', () => {
        state.flashcardIndex--;
        renderFlashcard();
    });

    document.getElementById('fc-known').addEventListener('click', () => {
        const vocab = fcList[state.flashcardIndex];
        if (!state.progress[vocab.id]) state.progress[vocab.id] = {};
        state.progress[vocab.id].learned = true;
        state.progress[vocab.id].correct = (state.progress[vocab.id].correct || 0) + 1;
        saveProgress();
        state.flashcardIndex++;
        renderFlashcard();
    });

    document.getElementById('fc-hard').addEventListener('click', () => {
        const vocab = fcList[state.flashcardIndex];
        if (!state.progress[vocab.id]) state.progress[vocab.id] = {};
        state.progress[vocab.id].difficult = true;
        state.progress[vocab.id].wrong = (state.progress[vocab.id].wrong || 0) + 1;
        saveProgress();
        state.flashcardIndex++;
        renderFlashcard();
    });

    document.getElementById('fc-unit-filter').addEventListener('change', initFlashcards);
    document.getElementById('fc-direction').addEventListener('change', renderFlashcard);

    // 3. Quiz (Vokabeltest)
    let quizList = [];
    let quizIndex = 0;
    let quizCorrectCount = 0;

    function initQuiz() {
        let unit = document.getElementById('quiz-unit-filter').value;
        quizList = vocabularyDatabase.filter(v => unit === 'all' || v.unit === unit).sort(() => Math.random() - 0.5);
        quizIndex = 0;
        quizCorrectCount = 0;
        document.getElementById('quiz-box').classList.remove('hidden');
        document.getElementById('quiz-results').classList.add('hidden');
        nextQuizQuestion();
    }

    function nextQuizQuestion() {
        if (quizIndex >= quizList.length) {
            document.getElementById('quiz-box').classList.add('hidden');
            const res = document.getElementById('quiz-results');
            res.classList.remove('hidden');
            document.getElementById('quiz-score-text').textContent = `Du hast ${quizCorrectCount} von ${quizList.length} Vokabeln richtig beantwortet!`;
            return;
        }
        const vocab = quizList[quizIndex];
        document.getElementById('quiz-unit').textContent = vocab.unit;
        document.getElementById('quiz-prompt').textContent = vocab.fr;
        document.getElementById('quiz-input').value = '';
        document.getElementById('quiz-feedback').classList.add('hidden');
    }

    document.getElementById('quiz-submit').addEventListener('click', () => {
        const vocab = quizList[quizIndex];
        const userAns = document.getElementById('quiz-input').value.trim().toLowerCase();
        const correctAns = vocab.de.toLowerCase();

        const feedback = document.getElementById('quiz-feedback');
        feedback.classList.remove('hidden');

        if (correctAns.includes(userAns) && userAns.length > 2) {
            feedback.textContent = 'Richtig!';
            feedback.className = 'quiz-feedback correct';
            quizCorrectCount++;
            if (!state.progress[vocab.id]) state.progress[vocab.id] = {};
            state.progress[vocab.id].learned = true;
            state.progress[vocab.id].correct = (state.progress[vocab.id].correct || 0) + 1;
        } else {
            feedback.textContent = `Falsch! Richtige Antwort: ${vocab.de}`;
            feedback.className = 'quiz-feedback wrong';
            if (!state.progress[vocab.id]) state.progress[vocab.id] = {};
            state.progress[vocab.id].wrong = (state.progress[vocab.id].wrong || 0) + 1;
        }
        saveProgress();

        quizIndex++;
        setTimeout(nextQuizQuestion, 1500);
    });

    document.getElementById('quiz-restart').addEventListener('click', initQuiz);
    document.getElementById('quiz-unit-filter').addEventListener('change', initQuiz);

    // 4. Multiple Choice
    let mcList = [];
    let mcIndex = 0;

    function initMC() {
        let unit = document.getElementById('mc-unit-filter').value;
        mcList = vocabularyDatabase.filter(v => unit === 'all' || v.unit === unit).sort(() => Math.random() - 0.5);
        mcIndex = 0;
        renderMC();
    }

    function renderMC() {
        if (mcList.length === 0) return;
        if (mcIndex >= mcList.length) mcIndex = 0;
        const vocab = mcList[mcIndex];

        document.getElementById('mc-unit').textContent = vocab.unit;
        document.getElementById('mc-prompt').textContent = vocab.fr;

        // Get 3 wrong options
        let wrongs = vocabularyDatabase.filter(v => v.id !== vocab.id).sort(() => Math.random() - 0.5).slice(0, 3);
        let options = [...wrongs, vocab].sort(() => Math.random() - 0.5);

        const optionsContainer = document.getElementById('mc-options');
        optionsContainer.innerHTML = '';

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'mc-btn';
            btn.textContent = opt.de;
            btn.addEventListener('click', () => {
                if (opt.id === vocab.id) {
                    btn.style.backgroundColor = 'var(--success)';
                    if (!state.progress[vocab.id]) state.progress[vocab.id] = {};
                    state.progress[vocab.id].correct = (state.progress[vocab.id].correct || 0) + 1;
                    state.progress[vocab.id].learned = true;
                } else {
                    btn.style.backgroundColor = 'var(--danger)';
                    if (!state.progress[vocab.id]) state.progress[vocab.id] = {};
                    state.progress[vocab.id].wrong = (state.progress[vocab.id].wrong || 0) + 1;
                }
                saveProgress();
                setTimeout(() => {
                    mcIndex++;
                    renderMC();
                }, 1000);
            });
            optionsContainer.appendChild(btn);
        });
    }
    document.getElementById('mc-unit-filter').addEventListener('change', initMC);

    // 5. Schreiben & Übersetzen
    let writeList = [];
    let writeIndex = 0;

    function initWrite() {
        let unit = document.getElementById('write-unit-filter').value;
        writeList = vocabularyDatabase.filter(v => unit === 'all' || v.unit === unit).sort(() => Math.random() - 0.5);
        writeIndex = 0;
        nextWriteQuestion();
    }

    function nextWriteQuestion() {
        if (writeIndex >= writeList.length) writeIndex = 0;
        const vocab = writeList[writeIndex];
        document.getElementById('write-unit').textContent = vocab.unit;
        document.getElementById('write-prompt').textContent = vocab.de;
        document.getElementById('write-input').value = '';
        document.getElementById('write-feedback').classList.add('hidden');
    }

    document.getElementById('write-submit').addEventListener('click', () => {
        const vocab = writeList[writeIndex];
        const userAns = document.getElementById('write-input').value.trim().toLowerCase();
        const correctAns = vocab.fr.toLowerCase();

        const feedback = document.getElementById('write-feedback');
        feedback.classList.remove('hidden');

        if (correctAns.includes(userAns) && userAns.length > 2) {
            feedback.textContent = 'Richtig!';
            feedback.className = 'quiz-feedback correct';
            if (!state.progress[vocab.id]) state.progress[vocab.id] = {};
            state.progress[vocab.id].learned = true;
            state.progress[vocab.id].correct = (state.progress[vocab.id].correct || 0) + 1;
        } else {
            feedback.textContent = `Falsch! Richtige Antwort: ${vocab.fr}`;
            feedback.className = 'quiz-feedback wrong';
            if (!state.progress[vocab.id]) state.progress[vocab.id] = {};
            state.progress[vocab.id].wrong = (state.progress[vocab.id].wrong || 0) + 1;
        }
        saveProgress();
        writeIndex++;
        setTimeout(nextWriteQuestion, 1500);
    });
    document.getElementById('write-unit-filter').addEventListener('change', initWrite);

    // 6. Vocabulary Table
    function renderVocabularyTable() {
        const tbody = document.getElementById('vocab-table-body');
        tbody.innerHTML = '';

        const search = document.getElementById('vocab-search').value.toLowerCase();
        const unitFilter = document.getElementById('vocab-filter-unit').value;

        const filtered = vocabularyDatabase.filter(v => {
            const matchesSearch = v.fr.toLowerCase().includes(search) || v.de.toLowerCase().includes(search);
            const matchesUnit = unitFilter === 'all' || v.unit === unitFilter;
            return matchesSearch && matchesUnit;
        });

        document.getElementById('vocab-count').textContent = filtered.length;

        filtered.forEach(v => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${v.fr}</strong></td>
                <td>${v.de}</td>
                <td>${v.unit}</td>
                <td><button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="toggleDifficult('${v.id}')">${state.progress[v.id]?.difficult ? '⭐ Schwer' : '☆ Merken'}</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.toggleDifficult = function(id) {
        if (!state.progress[id]) state.progress[id] = {};
        state.progress[id].difficult = !state.progress[id].difficult;
        saveProgress();
        renderVocabularyTable();
    };

    document.getElementById('vocab-search').addEventListener('input', renderVocabularyTable);
    document.getElementById('vocab-filter-unit').addEventListener('change', renderVocabularyTable);

    // Initial load
    updateDashboard();
});
