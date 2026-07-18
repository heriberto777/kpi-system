import Input from '../atomos/Input';

interface DateRangePickerProps {
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
}

export default function DateRangePicker({ desde, hasta, onChange }: DateRangePickerProps) {
  return (
    <div className="flex items-end gap-3">
      <Input
        type="date"
        label="Desde"
        value={desde}
        max={hasta || undefined}
        onChange={(e) => onChange(e.target.value, hasta)}
      />
      <Input
        type="date"
        label="Hasta"
        value={hasta}
        min={desde || undefined}
        onChange={(e) => onChange(desde, e.target.value)}
      />
    </div>
  );
}
