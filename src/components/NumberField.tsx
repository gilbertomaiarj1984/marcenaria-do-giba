import { useEffect, useState } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

/** Campo numérico que só aplica o valor quando ele está dentro dos limites. */
export function NumberField({ label, value, min, max, onChange }: Props) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = (raw: string) => {
    const n = Math.round(Number(raw.replace(',', '.')));
    if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
  };

  const invalid = (() => {
    const n = Number(text.replace(',', '.'));
    return !Number.isFinite(n) || n < min || n > max;
  })();

  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        value={text}
        aria-invalid={invalid}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setText(String(value))}
      />
      {invalid && (
        <small className="err">
          Entre {min} e {max}
        </small>
      )}
    </label>
  );
}
