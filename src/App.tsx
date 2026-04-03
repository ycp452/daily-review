import { useState, useEffect } from 'react';
import { PairingGame } from './components/PairingGame';
import type { VocabItem } from './components/PairingGame';

interface Article {
  title: string;
  text: string;
  vocab: VocabItem[];
}

interface DailyData {
  articleDate: string;
  articleLink: string;
  articles: Article[];
}

const APP_PASSWORD = 'deutsch2026';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('dw_auth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [view, setView] = useState<'menu' | 'article-select' | 'game'>('menu');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [selectedArticleIndex, setSelectedArticleIndex] = useState<number | -1>(-1); // -1 means "All"
  
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoadingManifest, setIsLoadingManifest] = useState(true);

  // Fetch available dates on load
  useEffect(() => {
    const loadManifest = async () => {
      try {
        const response = await fetch('data/manifest.json');
        if (response.ok) {
          const dates = await response.json();
          setAvailableDates(dates);
        }
      } catch (err) {
        console.error('Failed to load manifest:', err);
      } finally {
        setIsLoadingManifest(false);
      }
    };
    loadManifest();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === APP_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('dw_auth', 'true');
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const fetchDailyData = async (date: string) => {
    try {
      setSelectedDate(date);
      setIsCompleted(false);
      setError(null);
      setDailyData(null);
      
      // Use relative path for GitHub Pages compatibility
      const response = await fetch(`data/vocab_${date}.json`);
      if (!response.ok) {
        throw new Error('Data for this date is not available yet.');
      }
      const data = await response.json();
      
      // Support both old format (array) and new format (object with articles)
      if (data.articles && Array.isArray(data.articles)) {
          setDailyData(data);
      } else if (Array.isArray(data)) {
          // Backward compatibility
          setDailyData({
              articleDate: date,
              articleLink: '',
              articles: [{ title: 'Vocabulary List', text: '', vocab: data }]
          });
      }
      
      setView('article-select');
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  };

  const selectArticle = (index: number) => {
      setSelectedArticleIndex(index);
      setView('game');
  };

  const returnToMenu = () => {
    setView('menu');
    setSelectedDate(null);
    setDailyData(null);
    setIsCompleted(false);
  };

  const returnToArticleSelect = () => {
      setView('article-select');
      setIsCompleted(false);
  };

  const getActiveVocab = (): VocabItem[] => {
      if (!dailyData) return [];
      if (selectedArticleIndex === -1) {
          return dailyData.articles.reduce((acc, art) => [...acc, ...art.vocab], [] as VocabItem[]);
      }
      return dailyData.articles[selectedArticleIndex].vocab;
  };

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="glass-panel login-card">
          <header className="header" style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem' }}>DW Nachrichten</h1>
            <p>Please enter the password</p>
          </header>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              className="login-input"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
            />
            {loginError && <div style={{ color: 'var(--error)', marginBottom: '1rem', fontSize: '0.9rem' }}>Incorrect password. Try again.</div>}
            <button type="submit" className="btn btn-primary btn-large" style={{ width: '100%' }}>
              Unlock Project
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="header" style={{ marginBottom: view === 'menu' ? '3rem' : '1.5rem' }}>
        <h1>DW Kurz und leicht</h1>
        <p>Vocabulary Pairing Game</p>
      </header>

      {view === 'menu' && (
        <main className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '2rem', fontSize: '2rem' }}>Select a Date to Play</h2>
          {error && <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</div>}
          
          {isLoadingManifest ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Loading articles...</div>
          ) : availableDates.length > 0 ? (
            <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {availableDates.map(date => (
                <button 
                  key={date}
                  onClick={() => fetchDailyData(date)}
                  className="btn btn-primary btn-large"
                >
                  {date}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>No articles found yet. Run the scraper to get started!</div>
          )}
        </main>
      )}

      {view === 'article-select' && dailyData && (
        <main className="glass-panel" style={{ padding: '3rem', maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <button onClick={returnToMenu} className="btn btn-ghost">← Dates</button>
            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>{selectedDate}</h2>
          </div>
          
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <button 
                onClick={() => selectArticle(-1)}
                className="btn btn-accent btn-large"
                style={{ width: '100%' }}
            >
                🚀 Play All Articles ({dailyData.articles.reduce((a, b) => a + b.vocab.length, 0)} words)
            </button>
            
            {dailyData.articles.map((article, idx) => (
                <button 
                    key={idx}
                    onClick={() => selectArticle(idx)}
                    className="card-btn"
                >
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.15rem' }}>{article.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{article.vocab.length} words</div>
                </button>
            ))}
          </div>
        </main>
      )}

      {view === 'game' && dailyData && (
        <main className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={returnToArticleSelect} className="btn btn-ghost">← Back</button>
              <h2 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--primary)' }}>
                {selectedArticleIndex === -1 ? 'All Articles' : dailyData.articles[selectedArticleIndex].title}
              </h2>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {dailyData.articleLink && (
                  <a href={dailyData.articleLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                    Original DW Article 📖
                  </a>
                )}
                {isCompleted && (
                  <div style={{ color: 'var(--accent)', fontWeight: 'bold', animation: 'popIn 0.5s ease', fontSize: '0.95rem' }}>
                    🎉 Excellent!
                  </div>
                )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {selectedArticleIndex !== -1 && (
                <div className="glass-panel" style={{ padding: '1.5rem', fontSize: '1rem', lineHeight: '1.6', background: 'rgba(0,0,0,0.2)' }}>
                    <h3 style={{ marginTop: 0, color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Manuscript</h3>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{dailyData.articles[selectedArticleIndex].text}</div>
                </div>
            )}
            
            <PairingGame 
                vocabData={getActiveVocab()} 
                onComplete={() => setIsCompleted(true)} 
            />
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
