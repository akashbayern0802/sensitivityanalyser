'use client';

import { forwardRef } from 'react';

export interface Slide {
  id: number;
  title: string;
  body: string;
  isTitle?: boolean;
  isCta?: boolean;
}

const GRADIENT_THEMES = [
  'from-indigo-600 to-purple-700',
  'from-purple-600 to-pink-600',
  'from-blue-600 to-cyan-600',
  'from-emerald-600 to-teal-600',
  'from-orange-500 to-red-600',
];

export const CarouselSlide = forwardRef<HTMLDivElement, { slide: Slide; index: number; authorName?: string }>(({ slide, index, authorName }, ref) => {
  const theme = GRADIENT_THEMES[index % GRADIENT_THEMES.length];
  return (
    <div
      ref={ref}
      className={`relative bg-gradient-to-br ${theme} text-white flex flex-col justify-between`}
      style={{ width: '1080px', height: '1080px', padding: '80px', boxSizing: 'border-box', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Slide number */}
      {!slide.isTitle && (
        <div style={{ position: 'absolute', top: '40px', right: '60px', fontSize: '18px', opacity: 0.6, fontWeight: 600 }}>
          {index + 1}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {slide.title && (
          <h2 style={{ fontSize: slide.isTitle ? '72px' : '52px', fontWeight: 800, lineHeight: 1.1, marginBottom: '32px', letterSpacing: '-1px' }}>
            {slide.title}
          </h2>
        )}
        {slide.body && (
          <p style={{ fontSize: slide.isTitle ? '28px' : '34px', lineHeight: 1.5, opacity: 0.9, fontWeight: 400 }}>
            {slide.body}
          </p>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '20px', fontWeight: 600, opacity: 0.8 }}>{authorName || 'Sensitivity Analyser'}</span>
        <span style={{ fontSize: '18px', opacity: 0.5 }}>Swipe →</span>
      </div>
    </div>
  );
});
CarouselSlide.displayName = 'CarouselSlide';
