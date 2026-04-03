import React, { useState, useEffect } from 'react';
import './PairingGame.css';

export interface VocabItem {
  id: string;
  german: string;
  explanation: string;
  english: string;
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
  
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [shakeIds, setShakeIds] = useState<string[]>([]);
  
  useEffect(() => {
    // Initialize cards separately for 3 columns
    const ge: Card[] = [];
    const en: Card[] = [];
    const ex: Card[] = [];
    
    vocabData.forEach(item => {
      ge.push({ id: `ge-${item.id}`, text: item.german, type: 'german', vocabId: item.id });
      en.push({ id: `en-${item.id}`, text: item.english, type: 'english', vocabId: item.id });
      ex.push({ id: `ex-${item.id}`, text: item.explanation, type: 'explanation', vocabId: item.id });
    });
    
    // Shuffle columns independently
    setGermanCards(ge.sort(() => Math.random() - 0.5));
    setEnglishCards(en.sort(() => Math.random() - 0.5));
    setExplanationCards(ex.sort(() => Math.random() - 0.5));
    
    setMatchedIds(new Set());
    setSelectedCards([]);
  }, [vocabData]);

  useEffect(() => {
    if (selectedCards.length === 3) {
      const [first, second, third] = selectedCards;
      
      if (first.vocabId === second.vocabId && second.vocabId === third.vocabId) {
        // Match!
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
        }, 500);
      } else {
        // No match
        const ids = selectedCards.map(c => c.id);
        setShakeIds(ids);
        setTimeout(() => {
          setShakeIds([]);
          setSelectedCards([]);
        }, 800);
      }
    }
  }, [selectedCards, vocabData, onComplete]);

  const handleCardClick = (card: Card) => {
    if (matchedIds.has(card.vocabId) || selectedCards.length === 3 || shakeIds.length > 0) {
      return;
    }
    
    // If the user clicks a card of a type they already selected, replace that selection
    const newSelection = selectedCards.filter(c => c.type !== card.type);
    newSelection.push(card);
    setSelectedCards(newSelection);
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
        disabled={isMatched || (selectedCards.length === 3 && !isShaking)}
      >
        {card.text}
      </button>
    );
  };

  return (
    <div className="game-board">
      <div className="column">
        <h2 className="column-title">German</h2>
        {germanCards.map(renderCard)}
      </div>
      
      <div className="column">
        <h2 className="column-title">English</h2>
        {englishCards.map(renderCard)}
      </div>

      <div className="column">
        <h2 className="column-title">Explanation</h2>
        {explanationCards.map(renderCard)}
      </div>
    </div>
  );
};
