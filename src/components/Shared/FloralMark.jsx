export default function FloralMark({ className = '' }) {
  return (
    <svg className={`floral-mark ${className}`} viewBox="0 0 60 60" fill="none" aria-hidden="true" focusable="false">
      {[0, 60, 120].map((angle) => <ellipse key={angle} cx="30" cy="30" rx="8" ry="25" transform={`rotate(${angle} 30 30)`} stroke="currentColor" strokeWidth="1.2" />)}
      <circle cx="30" cy="30" r="3" fill="currentColor" />
    </svg>
  );
}
