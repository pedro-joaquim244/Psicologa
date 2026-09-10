import { useId } from 'react';
import FloralMark from './FloralMark';

export default function CircularBadge({ className = '' }) {
  const id = `badge-${useId().replace(/:/g, '')}`;
  return (
    <div className={`circular-badge ${className}`} aria-hidden="true">
      <svg className="badge-ring" viewBox="0 0 160 160" data-badge-ring focusable="false">
        <defs><path id={id} d="M 80,80 m -60,0 a 60,60 0 1,1 120,0 a 60,60 0 1,1 -120,0" /></defs>
        <text textLength="373"><textPath href={`#${id}`}>PSICOLOGIA · ACOLHIMENTO · ESCUTA · PRESENÇA · </textPath></text>
        <circle cx="80" cy="80" r="45" fill="none" stroke="currentColor" strokeWidth=".6" />
      </svg>
      <FloralMark />
    </div>
  );
}
