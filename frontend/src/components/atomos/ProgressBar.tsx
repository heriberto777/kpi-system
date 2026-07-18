interface ProgressBarProps {
  porcentaje: number;
  colorClass?: string;
  showLabel?: boolean;
}

export default function ProgressBar({ porcentaje, colorClass = 'bg-primary', showLabel = true }: ProgressBarProps) {
  const value = Math.min(100, Math.max(0, porcentaje));

  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${value}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && <span className="mt-1 block text-xs text-gray-500">{value.toFixed(0)}%</span>}
    </div>
  );
}
