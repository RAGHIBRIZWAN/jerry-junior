export default function QuantityInput({ value, onChange, min = 1, max = 20, small = false }) {
  const btn = small ? 'h-8 w-8' : 'h-12 w-11';
  return (
    <div className="inline-flex items-center border border-stone-300 bg-white">
      <button
        type="button"
        className={`${btn} text-lg text-ink-soft transition hover:text-ink disabled:opacity-30`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className={`${small ? 'w-7 text-sm' : 'w-9'} text-center tabular-nums`} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={`${btn} text-lg text-ink-soft transition hover:text-ink disabled:opacity-30`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
