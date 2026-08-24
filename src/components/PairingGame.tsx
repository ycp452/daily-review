import React, { useState, useEffect } from 'react';
import './PairingGame.css';

export interface VocabItem {
  id: string;
  german: string;
  explanation: string;
  english?: string; // May be absent when the scraper's translator fails.
}

export type CardType = 'german' | 'english' | 'explanation';

interface Card {
  id: string;
  text: string;
  type: CardType;
  vocabId: string;
}

interface PairingGameProps {
  vocabData: VocabItem[];
  onComplete?: () => void;
}

export const PairingGame: React.FC<PairingGameProps> = ({ vocabData, onComplete }) => {
  const [germanCards, setGermanCards] = useState<Card[]>([]);
  const [englishCards, setEnglishCards] = useState<Card[]>([]);
  const [explanationCards, setExplanationCards] = useState<Card[]>([]);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: German, 1: English*, 2: Explanation (*skipped when translations missing)

  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [shakeIds, setShakeIds] = useState<string[]>([]);

  // Fall back to a 2-column German↔Explanation game when any item lacks a translation
  // (the scraper's bulk translator can fail — see scraper/dw_scraper.py).
  const hasEnglish = vocabData.length > 0 && vocabData.every(v => !!v.english);
  const totalSteps = hasEnglish ? 3 : 2;
  const explanationStep = hasEnglish ? 2 : 1;
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Initialize cards separately for 3 columns
    const ge: Card[] = [];
    const en: Card[] = [];
    const ex: Card[] = [];
    
    vocabData.forEach(item => {
      ge.push({ id: `ge-${item.id}`, text: item.german, type: 'german', vocabId: item.id });
      if (item.english) {
        en.push({ id: `en-${item.id}`, text: item.english, type: 'english', vocabId: item.id });
      }
      ex.push({ id: `ex-${item.id}`, text: item.explanation, type: 'explanation', vocabId: item.id });
    });
    
    // Shuffle columns independently
    setGermanCards(ge.sort(() => Math.random() - 0.5));
    setEnglishCards(en.sort(() => Math.random() - 0.5));
    setExplanationCards(ex.sort(() => Math.random() - 0.5));
    
    setMatchedIds(new Set());
    setSelectedCards([]);
    setCurrentStep(0);
  }, [vocabData]);

  useEffect(() => {
    if (selectedCards.length === totalSteps) {
      const first = selectedCards[0];
      const isMatch = selectedCards.every(c => c.vocabId === first.vocabId);

      if (isMatch) {
        setTimeout(() => {
          setMatchedIds(prev => {
            const newSet = new Set(prev);
            newSet.add(first.vocabId);
            if (newSet.size === vocabData.length && onComplete) {
                setTimeout(onComplete, 500);
            }
            return newSet;
          });
          setSelectedCards([]);
          setCurrentStep(0);
        }, 300);
      } else {
        // No match
        const ids = selectedCards.map(c => c.id);
        setShakeIds(ids);
        setTimeout(() => {
          setShakeIds([]);
          setSelectedCards([]);
          setCurrentStep(0);
        }, 800);
      }
    }
  }, [selectedCards, vocabData, onComplete, totalSteps]);

  const handleCardClick = (card: Card) => {
    if (matchedIds.has(card.vocabId) || selectedCards.length === totalSteps || shakeIds.length > 0) {
      return;
    }
    
    if (isMobile) {
        // Sequential flow on mobile
        setSelectedCards(prev => [...prev, card]);
        setCurrentStep(prev => prev + 1);
    } else {
        // Desktop multi-select replacement
        const newSelection = selectedCards.filter(c => c.type !== card.type);
        newSelection.push(card);
        setSelectedCards(newSelection);
    }
  };

  if (vocabData.length === 0) return <div className="loading">Loading Game...</div>;

  const renderCard = (card: Card) => {
    const isSelected = selectedCards.some(c => c.id === card.id);
    const isMatched = matchedIds.has(card.vocabId);
    const isShaking = shakeIds.includes(card.id);
    
    let className = 'card glass-panel';
    if (isSelected) className += ' selected';
    if (isMatched) className += ' matched';
    if (isShaking) className += ' shake';

    return (
      <button
        key={card.id}
        className={className}
        onClick={() => handleCardClick(card)}
        disabled={isMatched || (selectedCards.length === totalSteps && !isShaking)}
      >
        {card.text}
      </button>
    );
  };

  return (
    <div className={`game-board ${isMobile ? 'mobile-sequential' : ''} ${!hasEnglish ? 'two-columns' : ''}`}>
      {isMobile ? (
        <div className="sequential-view">
          <div className="game-status">
            <div className="step-indicator">Step {currentStep + 1} of {totalSteps}</div>
            {selectedCards.length > 0 && (
                <div className="selected-path">
                    {selectedCards.map((c, i) => (
                        <span key={c.id}>
                            {i > 0 && ' → '}
                            <span className="path-chip">{c.text}</span>
                        </span>
                    ))}
                </div>
            )}
          </div>

          <div className="column active-column">
            <h2 className="column-title">
              {currentStep === 0 && 'Pick German Word'}
              {hasEnglish && currentStep === 1 && 'Find English Match'}
              {currentStep === explanationStep && 'Select Explanation'}
            </h2>
            {currentStep === 0 && germanCards.map(renderCard)}
            {hasEnglish && currentStep === 1 && englishCards.map(renderCard)}
            {currentStep === explanationStep && explanationCards.map(renderCard)}
          </div>
        </div>
      ) : (
        <>
          <div className="column">
            <h2 className="column-title">German</h2>
            {germanCards.map(renderCard)}
          </div>

          {hasEnglish && (
            <div className="column">
              <h2 className="column-title">English</h2>
              {englishCards.map(renderCard)}
            </div>
          )}

          <div className="column">
            <h2 className="column-title">Explanation</h2>
            {explanationCards.map(renderCard)}
          </div>
        </>
      )}
    </div>
  );
};
