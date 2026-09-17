export function ProgressRing({
  fraction,
  size = 52,
  stroke = 4,
}: {
  fraction: number;
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, fraction));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-white/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className="stroke-accent transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] tabular-nums text-ink-muted">
        {Math.round(clamped * 100)}%
      </span>
    </div>
  );
}
