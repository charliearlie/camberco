// src/scripts/app-demo.ts
// Lazy phone quiz + parallax demo for /services/apps.

interface QuizQuestion {
  question: string;
  answers: string[];
  correctIndex: number;
}

const QUESTIONS: QuizQuestion[] = [
  {
    question: 'Which Premier League team won the 2023/24 title?',
    answers: ['Arsenal', 'Liverpool', 'Manchester City', 'Aston Villa'],
    correctIndex: 2,
  },
  {
    question: 'What powers Football IQ on mobile?',
    answers: ['React Native + Expo', 'A spreadsheet', 'A static PDF', 'A slide deck'],
    correctIndex: 0,
  },
];

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isTiltDisabled(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768 || prefersReducedMotion();
}

function initQuiz(root: HTMLElement): void {
  const questionEl = root.querySelector<HTMLElement>('[data-quiz-question]');
  const answersEl = root.querySelector<HTMLElement>('[data-quiz-answers]');
  const scoreEl = root.querySelector<HTMLElement>('[data-quiz-score]');
  const burstEl = root.querySelector<HTMLElement>('[data-score-burst]');
  if (!questionEl || !answersEl || !scoreEl || !burstEl) return;

  let questionIndex = 0;
  let score = 0;
  let locked = false;

  function setScore(nextScore: number): void {
    score = nextScore;
    scoreEl.textContent = String(score);
  }

  function animateScore(): void {
    burstEl.classList.remove('is-visible');
    void burstEl.offsetHeight;
    burstEl.classList.add('is-visible');
  }

  function renderDone(): void {
    questionEl.textContent = "Done - you're ready";
    answersEl.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'quiz-done-card';

    const title = document.createElement('p');
    title.className = 'quiz-done-title';
    title.textContent = "🏆 Done - you're ready";

    const body = document.createElement('p');
    body.className = 'quiz-done-body';
    body.textContent = `${score}/${QUESTIONS.length} correct. That is enough signal for a prototype.`;

    const restart = document.createElement('button');
    restart.type = 'button';
    restart.className = 'quiz-restart';
    restart.textContent = 'Restart';
    restart.addEventListener('click', () => {
      questionIndex = 0;
      setScore(0);
      renderQuestion();
    });

    card.append(title, body, restart);
    answersEl.appendChild(card);
  }

  function renderQuestion(): void {
    locked = false;
    const question = QUESTIONS[questionIndex];
    questionEl.textContent = question.question;
    answersEl.innerHTML = '';

    question.answers.forEach((answer, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-answer';
      button.textContent = answer;
      button.addEventListener('click', () => handleAnswer(index));
      answersEl.appendChild(button);
    });
  }

  function handleAnswer(index: number): void {
    if (locked) return;
    locked = true;

    const question = QUESTIONS[questionIndex];
    const buttons = Array.from(answersEl.querySelectorAll<HTMLButtonElement>('.quiz-answer'));
    const isCorrect = index === question.correctIndex;

    buttons.forEach((button, buttonIndex) => {
      button.disabled = true;
      if (buttonIndex === question.correctIndex) {
        button.classList.add('is-correct');
      } else if (buttonIndex === index) {
        button.classList.add('is-wrong');
      }
    });

    if (isCorrect) {
      setScore(score + 1);
      animateScore();
    }

    const delay = prefersReducedMotion() ? 0 : 850;
    window.setTimeout(() => {
      questionIndex += 1;
      if (questionIndex >= QUESTIONS.length) {
        renderDone();
      } else {
        renderQuestion();
      }
    }, delay);
  }

  setScore(0);
  renderQuestion();
}

function initTilt(root: HTMLElement): void {
  const phone = root.querySelector<HTMLElement>('[data-phone-frame]');
  if (!phone) return;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let rafId = 0;
  let active = false;

  function applyTransform(): void {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    phone.style.transform = `perspective(1200px) rotateX(${currentY.toFixed(3)}deg) rotateY(${currentX.toFixed(3)}deg)`;
    rafId = window.requestAnimationFrame(applyTransform);
  }

  function start(): void {
    if (active || isTiltDisabled()) return;
    active = true;
    rafId = window.requestAnimationFrame(applyTransform);
  }

  function stop(): void {
    active = false;
    window.cancelAnimationFrame(rafId);
    targetX = 0;
    targetY = 0;
    currentX = 0;
    currentY = 0;
    phone.style.transform = '';
  }

  root.addEventListener('mousemove', (event) => {
    if (isTiltDisabled()) return;
    const rect = root.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width - 0.5;
    const relY = (event.clientY - rect.top) / rect.height - 0.5;
    targetX = relX * 16;
    targetY = relY * -16;
  });

  root.addEventListener('mouseleave', () => {
    targetX = 0;
    targetY = 0;
  });

  window.addEventListener('resize', () => {
    if (isTiltDisabled()) {
      stop();
    } else {
      start();
    }
  }, { passive: true });

  start();
}

function initOneAppDemo(root: HTMLElement): void {
  let hasBooted = false;

  function boot(): void {
    if (hasBooted) return;
    hasBooted = true;
    initQuiz(root);
    initTilt(root);
    root.classList.add('is-booted');
  }

  if (!('IntersectionObserver' in window)) {
    boot();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(root);
        boot();
      });
    },
    { threshold: 0.25 },
  );

  observer.observe(root);
}

export function initAppDemo(): void {
  document.querySelectorAll<HTMLElement>('[data-app-demo]').forEach(initOneAppDemo);
}
