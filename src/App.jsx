import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import wordBankData from './utils/wordBank.json';
import { generateContext } from './utils/api';
import HomeScreen from './components/HomeScreen';
import RoundScreen from './components/RoundScreen';
import LoadingScreen from './components/LoadingScreen';
import ResultsScreen from './components/ResultsScreen';
import ProgressScreen from './components/ProgressScreen';
import SettingsScreen from './components/SettingsScreen';
import MicPermissionScreen from './components/MicPermissionScreen';

function pickWord(bank, difficulty, recentWords) {
  const eligible = difficulty === 'mixed'
    ? bank
    : bank.filter(w => w.difficulty === difficulty);
  const pool = eligible.filter(w => !recentWords.includes(w.word));
  const candidates = pool.length > 0 ? pool : eligible;
  if (candidates.length === 0) return bank[Math.floor(Math.random() * bank.length)];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function AppRoutes() {
  const [roundKey, setRoundKey] = useState(0);
  const [recentWords, setRecentWords] = useState([]);
  const [sessionRoundCount, setSessionRoundCount] = useState(0);
  const navigate = useNavigate();

  const handleStartRound = useCallback(
    async (difficulty = 'easy', category = 'random', challengeMode = false, specificWord = null) => {
      let word;
      if (specificWord) {
        word = specificWord;
      } else {
        word = pickWord(wordBankData.words, difficulty, recentWords);
        setRecentWords(prev => [...prev.slice(-9), word.word]);
      }

      const nextRound = sessionRoundCount + 1;
      setSessionRoundCount(nextRound);
      setRoundKey(k => k + 1);

      let context;
      try {
        const data = await generateContext(word.word, category);
        context = data.context;
      } catch {
        context = `Use the word "${word.word}" naturally in a response about a recent challenge you've faced.`;
      }

      const roundState = {
        word,
        category,
        challengeMode,
        roundNumber: nextRound,
        isWeeklyChallenge: !!specificWord,
        context,
      };

      const micShown = localStorage.getItem('cadence_mic_shown');
      if (!micShown) {
        navigate('/mic-permission', { state: { next: { path: '/round', state: roundState } } });
      } else {
        navigate('/round', { state: roundState });
      }
    },
    [recentWords, sessionRoundCount, navigate]
  );

  return (
    <Routes>
      <Route path="/" element={<HomeScreen onStartRound={handleStartRound} />} />
      <Route
        path="/round"
        element={<RoundScreen key={roundKey} sessionRoundCount={sessionRoundCount} />}
      />
      <Route path="/loading" element={<LoadingScreen />} />
      <Route path="/results" element={<ResultsScreen onGoAgain={handleStartRound} />} />
      <Route path="/progress" element={<ProgressScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/mic-permission" element={<MicPermissionScreen />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
