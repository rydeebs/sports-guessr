"use client";

import { useEffect } from "react";

type DateGuess = {
  month: number | null;
  day: number | null;
  year: number | null;
};

type YearSliderProps = DateGuess & {
  onChange: (date: DateGuess) => void;
  disabled?: boolean;
};

const FIRST_YEAR = 1900;
const LAST_YEAR = 2026;
const DEFAULT_YEAR = 1988;

export function YearSlider({
  disabled = false,
  onChange,
  year,
}: YearSliderProps) {
  const selectedYear = year ?? DEFAULT_YEAR;

  useEffect(() => {
    if (year === null) {
      onChange({ day: null, month: null, year: selectedYear });
    }
  }, [onChange, selectedYear, year]);

  return (
    <section aria-label="Guess event year" className="year-slider-control">
      <div className="year-slider-panel">
        <div className="year-slider-value" aria-live="polite">
          {selectedYear}
        </div>
        <input
          aria-label="Guess event year"
          className="year-slider-input"
          disabled={disabled}
          max={LAST_YEAR}
          min={FIRST_YEAR}
          onChange={(event) =>
            onChange({
              day: null,
              month: null,
              year: Number(event.currentTarget.value),
            })
          }
          step={1}
          type="range"
          value={selectedYear}
        />
        <div aria-hidden="true" className="year-slider-bounds">
          <span>{FIRST_YEAR}</span>
          <span>{LAST_YEAR}</span>
        </div>
      </div>
    </section>
  );
}
