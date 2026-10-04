/** Arus mark: three currents converging — the three signal streams (foreign, broker, sector). */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect width="24" height="24" rx="7" fill="#0c1320" />
      <path d="M4 8.5c3-2.4 6-2.4 9 0s5 2.4 7 .8" stroke="#1c5cab" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 12.5c3-2.4 6-2.4 9 0s5 2.4 7 .8" stroke="#3987e5" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 16.5c3-2.4 6-2.4 9 0s5 2.4 7 .8" stroke="#5cc8ff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
