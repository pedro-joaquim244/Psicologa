// Ilustração vetorial original. O recorte é feito na seção, sem overflow na página.
export default function Botanical({ className = '' }) {
  return (
    <svg className={`botanical ${className}`} viewBox="0 0 260 480" fill="none" aria-hidden="true" focusable="false" data-botanical>
      <g stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M91 482C78 397 159 317 140 232S121 91 185 8" />
        <path d="M116 378C55 376 12 336 7 292C70 287 107 319 116 378ZM141 324C158 266 207 256 253 270C230 315 187 338 141 324ZM139 253C74 255 41 219 24 165C85 167 131 201 139 253ZM136 193C167 151 202 134 247 142C229 187 184 211 136 193ZM143 121C93 120 72 84 70 37C117 48 140 77 143 121ZM169 46C195 34 224 40 243 55C220 82 190 80 162 69" />
        <path d="M116 378L18 301M141 324L243 277M139 253L35 176M136 193L237 149M143 121L80 48M162 69L229 55" opacity=".55" />
      </g>
    </svg>
  );
}
