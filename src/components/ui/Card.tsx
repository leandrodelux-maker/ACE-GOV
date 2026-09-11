import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  padding?: 'compact' | 'default' | 'spacious';
  className?: string;
}

const PADDING_MAP: Record<NonNullable<CardProps['padding']>, string> = {
  compact: 'p-4',
  default: 'p-5',
  spacious: 'p-6',
};

/**
 * Painel base do Sistema Visual Endemias — substitui o `bg-white p-5 rounded-xl
 * border border-slate-200 shadow-xs` repetido manualmente em cada tela.
 */
export const Card: React.FC<CardProps> = ({ children, padding = 'default', className = '' }) => (
  <div className={`bg-white rounded-card border border-slate-200 shadow-xs ${PADDING_MAP[padding]} ${className}`}>
    {children}
  </div>
);
