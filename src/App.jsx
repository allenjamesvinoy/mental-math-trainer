import { useState, useEffect, useRef } from 'react';
import './App.css';

const operations = [
  { symbol: '+', fn: (a, b) => a + b },
  { symbol: '-', fn: (a, b) => a - b },
  { symbol: '×', fn: (a, b) => a * b },
  { symbol: '÷', fn: (a, b) => a / b },
];

const operationNames = {
  '+': 'Addition',
  '-': 'Subtraction',
  '×': 'Multiplication',
  '÷': 'Division',
};

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProblem(difficulty = 1) {
  const max = Math.floor(20 * difficulty);
  const min = 1;
  const opIndex = getRandomInt(0, operations.length - 1);
  let a = getRandomInt(min, max);
  let b = getRandomInt(min, max);
  if (operations[opIndex].symbol === '÷') {
    a = a * b;
  }
  return {
    a,
    b,
    op: operations[opIndex],
  };
}

const SESSION_CACHE_KEY = 'math_practice_session';

// Helper to convert operation to spoken words
function getSpokenOperation(a, opSymbol, b) {
  switch (opSymbol) {
    case '+':
      return `What is ${a} plus ${b}?`;
    case '-':
      return `What is ${a} minus ${b}?`;
    case '×':
      return `What is ${a} times ${b}?`;
    case '÷':
      return `What is ${a} divided by ${b}?`;
    default:
      return `What is ${a} ${opSymbol} ${b}?`;
  }
}

// Speak the problem using Web Speech API
function speakProblem(problem) {
  if ('speechSynthesis' in window) {
    const utterance = new window.SpeechSynthesisUtterance(
      getSpokenOperation(problem.a, problem.op.symbol, problem.b)
    );
    window.speechSynthesis.cancel(); // Stop any ongoing speech
    window.speechSynthesis.speak(utterance);
  }
}

function App() {
  const [problem, setProblem] = useState(generateProblem());
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [difficulty, setDifficulty] = useState(1);
  const [showStart, setShowStart] = useState(true);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [questionTimer, setQuestionTimer] = useState(0);
  const [trace, setTrace] = useState([]);
  const sessionTimerRef = useRef();
  const questionTimerRef = useRef();
  const [speechSupported] = useState('speechSynthesis' in window);
  const [speechMode, setSpeechMode] = useState(false);

  // Load trace from localStorage on mount
  useEffect(() => {
    const cached = localStorage.getItem(SESSION_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      setTrace(parsed.trace || []);
      setSessionActive(parsed.sessionActive || false);
      setQuestionsAnswered(parsed.questionsAnswered || 0);
      setDifficulty(parsed.difficulty || 1);
      setShowStart(parsed.showStart !== undefined ? parsed.showStart : true);
      setSessionTimer(parsed.sessionTimer || 0);
      setProblem(parsed.problem || generateProblem());
      setSpeechMode(parsed.speechMode || false); // Load speech mode from cache
    }
  }, []);

  // Save trace and session state to localStorage
  useEffect(() => {
    localStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({
        trace,
        sessionActive,
        questionsAnswered,
        difficulty,
        showStart,
        sessionTimer,
        problem,
        speechMode, // Save speech mode to cache
      })
    );
  }, [trace, sessionActive, questionsAnswered, difficulty, showStart, sessionTimer, problem, speechMode]);

  // Session timer logic
  useEffect(() => {
    if (sessionActive) {
      sessionTimerRef.current = setInterval(() => {
        setSessionTimer((t) => t + 1);
      }, 1000);
    } else {
      clearInterval(sessionTimerRef.current);
    }
    return () => clearInterval(sessionTimerRef.current);
  }, [sessionActive]);

  // Question timer logic
  useEffect(() => {
    if (sessionActive) {
      setQuestionTimer(0);
      questionTimerRef.current = setInterval(() => {
        setQuestionTimer((t) => t + 1);
      }, 1000);
    } else {
      clearInterval(questionTimerRef.current);
    }
    return () => clearInterval(questionTimerRef.current);
  }, [problem, sessionActive]);

  // Speak the problem whenever it changes, but only in speech mode
  useEffect(() => {
    if (problem && speechMode) {
      speakProblem(problem);
    }
  }, [problem, speechMode]);

  const startSession = () => {
    setSessionActive(true);
    setQuestionsAnswered(0);
    setDifficulty(1);
    setProblem(generateProblem(1));
    setUserAnswer('');
    setFeedback('');
    setShowStart(false);
    setSessionTimer(0);
    setQuestionTimer(0);
    setTrace([]);
    setSpeechMode(false); // Reset speech mode
    localStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({
        trace: [],
        sessionActive: true,
        questionsAnswered: 0,
        difficulty: 1,
        showStart: false,
        sessionTimer: 0,
        problem: generateProblem(1),
        speechMode: false, // Save reset speech mode
      })
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let correct = problem.op.fn(problem.a, problem.b);
    if (problem.op.symbol === '÷') {
      correct = Number(correct.toFixed(2));
    }
    const userVal = problem.op.symbol === '÷' ? Number(Number(userAnswer).toFixed(2)) : Number(userAnswer);
    const isCorrect = userVal === correct;
    if (isCorrect) {
      setFeedback('✅ Correct!');
    } else {
      setFeedback(`❌ Incorrect. The answer is ${correct}`);
    }
    if (sessionActive) {
      // Add to trace
      const newTrace = [
        ...trace,
        {
          question: `${problem.a} ${problem.op.symbol} ${problem.b}`,
          operation: operationNames[problem.op.symbol],
          a: problem.a,
          b: problem.b,
          operator: problem.op.symbol,
          userAnswer,
          correct,
          isCorrect,
          time: questionTimer,
        },
      ];
      setTrace(newTrace);
      setTimeout(() => {
        nextProblem(newTrace);
      }, 1000); // 1 second for feedback
    }
  };

  const nextProblem = (newTrace = trace) => {
    if (sessionActive) {
      const nextCount = questionsAnswered + 1;
      let newDifficulty = difficulty;
      if (nextCount % 20 === 0) {
        newDifficulty = Number((difficulty * 1.3).toFixed(2));
        setDifficulty(newDifficulty);
      }
      setQuestionsAnswered(nextCount);
      setProblem(generateProblem(newDifficulty));
      setUserAnswer('');
      setFeedback('');
      setQuestionTimer(0);
    } else {
      setProblem(generateProblem());
      setUserAnswer('');
      setFeedback('');
      setQuestionTimer(0);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && userAnswer !== '') {
      handleSubmit(e);
    }
  };

  // Sort trace: mistakes first (by time desc), then correct (by time desc)
  const sortedTrace = [
    ...trace
  ].sort((a, b) => {
    if (a.isCorrect === b.isCorrect) {
      return b.time - a.time; // time desc within group
    }
    return a.isCorrect ? 1 : -1; // mistakes (isCorrect false) first
  });

  return (
    <div className="math-app" style={{ display: 'flex', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        {!speechSupported && (
          <div style={{ background: '#ffe0e0', color: '#a00', padding: '10px', marginBottom: '15px', borderRadius: '5px', fontWeight: 'bold' }}>
            ⚠️ Your browser does not support speech synthesis. Math problems will not be read aloud.
          </div>
        )}
        <h1>Math Practice</h1>
        <div style={{ marginBottom: 15 }}>
          <label style={{ fontWeight: 'bold', fontSize: '1em' }}>
            <input
              type="checkbox"
              checked={speechMode}
              onChange={e => setSpeechMode(e.target.checked)}
              disabled={!speechSupported}
              style={{ marginRight: 8 }}
            />
            Speech Mode
          </label>
          {speechMode && !speechSupported && (
            <span style={{ color: '#a00', marginLeft: 10 }}>
              (Not supported in your browser)
            </span>
          )}
        </div>
        {sessionActive && (
          <div style={{ fontSize: '1.2em', marginBottom: 10 }}>
            ⏱️ Session: {Math.floor(sessionTimer / 60)}:{String(sessionTimer % 60).padStart(2, '0')}
            <br />
            ⏲️ Question: {questionTimer}s
          </div>
        )}
        {showStart && (
          <button onClick={startSession} style={{ marginBottom: 20 }}>Start Session</button>
        )}
        {sessionActive && (
          <div style={{ marginBottom: 10 }}>
            <strong>Session:</strong> Question {questionsAnswered + 1} | Difficulty: {difficulty}x
          </div>
        )}
        {/* Only show the problem visually if speech mode is off */}
        {!speechMode && (
          <div className="problem" style={{ fontSize: '2.5em', fontWeight: 'bold', margin: '20px 0' }}>
            <span>{problem.a}</span>
            <span style={{ margin: '0 20px' }}>{problem.op.symbol}</span>
            <span>{problem.b}</span>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <input
            type="number"
            step={problem.op.symbol === '÷' ? '0.01' : '1'}
            value={userAnswer}
            onChange={e => setUserAnswer(e.target.value)}
            onKeyDown={handleInputKeyDown}
            required
            autoFocus
          />
          <button type="submit">Check</button>
        </form>
        {feedback && <div className="feedback">{feedback}</div>}
        {!sessionActive && (
          <button onClick={nextProblem} style={{ marginTop: 10 }}>Next Problem</button>
        )}
      </div>
      {/* Trace on right side */}
      <div className="trace" style={{ width: 320, marginLeft: 30, background: '#f9f9f9', padding: 16, borderRadius: 8, minHeight: 200 }}>
        <h2 style={{ fontSize: '1.1em', marginTop: 0 }}>Question Trace</h2>
        {sortedTrace.length === 0 && <div style={{ color: '#888' }}>No questions yet.</div>}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {sortedTrace.map((item, idx) => (
            <li key={idx} style={{ marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 6 }}>
              <div style={{ fontWeight: 'bold' }}>{item.question}</div>
              <div style={{ fontSize: '0.95em', color: '#888' }}>{item.operation}</div>
              <div style={{ fontSize: '1.1em', color: '#333', margin: '2px 0' }}>
                <span>{item.a}</span>
                <span style={{ margin: '0 10px' }}>{item.operator}</span>
                <span>{item.b}</span>
              </div>
              <div>Answer: <span style={{ color: item.isCorrect ? 'green' : 'red' }}>{item.userAnswer}</span> {item.isCorrect ? '✅' : '❌'} </div>
              <div style={{ fontSize: '0.95em', color: '#555' }}>Time: {item.time}s</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
