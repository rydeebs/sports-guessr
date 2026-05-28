"use client";

import {
  KeyboardEvent,
  PointerEvent,
  UIEvent,
  useEffect,
  useMemo,
  useRef,
} from "react";

type DateGuess = {
  month: number | null;
  day: number | null;
  year: number | null;
};

type YearSliderProps = DateGuess & {
  onChange: (date: DateGuess) => void;
  disabled?: boolean;
};

type WheelOption = {
  label: string;
  shortLabel?: string;
  value: number;
};

type WheelColumnProps = {
  ariaLabel: string;
  disabled: boolean;
  options: WheelOption[];
  value: number;
  onChange: (value: number) => void;
};

const FIRST_YEAR = 1900;
const LAST_YEAR = 2026;
const DEFAULT_MONTH = 1;
const DEFAULT_DAY = 1;
const DEFAULT_YEAR = 1963;
const WHEEL_ITEM_PX = 44;

const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, index) => ({
  label,
  shortLabel: label.slice(0, 3),
  value: index + 1,
}));

const yearOptions = Array.from(
  { length: LAST_YEAR - FIRST_YEAR + 1 },
  (_, index) => {
    const year = FIRST_YEAR + index;

    return { label: String(year), value: year };
  },
);

export function YearSlider({
  day,
  disabled = false,
  month,
  onChange,
  year,
}: YearSliderProps) {
  const selectedMonth = month ?? DEFAULT_MONTH;
  const selectedYear = year ?? DEFAULT_YEAR;
  const maxDay = getDaysInMonth(selectedMonth, selectedYear);
  const selectedDay = Math.min(day ?? DEFAULT_DAY, maxDay);
  const dayOptions = useMemo(
    () =>
      Array.from({ length: maxDay }, (_, index) => ({
        label: String(index + 1),
        value: index + 1,
      })),
    [maxDay],
  );

  useEffect(() => {
    if (
      month === null ||
      day === null ||
      year === null ||
      day !== selectedDay
    ) {
      onChange({
        day: selectedDay,
        month: selectedMonth,
        year: selectedYear,
      });
    }
  }, [
    day,
    month,
    onChange,
    selectedDay,
    selectedMonth,
    selectedYear,
    year,
  ]);

  const updateDate = (updates: Partial<DateGuess>) => {
    const nextMonth = updates.month ?? selectedMonth;
    const nextYear = updates.year ?? selectedYear;
    const nextMaxDay = getDaysInMonth(nextMonth, nextYear);
    const nextDay = Math.min(updates.day ?? selectedDay, nextMaxDay);

    onChange({
      day: nextDay,
      month: nextMonth,
      year: nextYear,
    });
  };

  return (
    <section aria-label="Guess event date" className="date-wheel-control">
      <div className="date-wheel-panel">
        <div className="date-wheel-frame">
          <span aria-hidden="true" className="date-wheel-highlight" />
          <WheelColumn
            ariaLabel="Guess event month"
            disabled={disabled}
            onChange={(nextMonth) => updateDate({ month: nextMonth })}
            options={monthOptions}
            value={selectedMonth}
          />
        </div>
        <div className="date-wheel-frame">
          <span aria-hidden="true" className="date-wheel-highlight" />
          <WheelColumn
            ariaLabel="Guess event day"
            disabled={disabled}
            onChange={(nextDay) => updateDate({ day: nextDay })}
            options={dayOptions}
            value={selectedDay}
          />
        </div>
        <div className="date-wheel-frame">
          <span aria-hidden="true" className="date-wheel-highlight" />
          <WheelColumn
            ariaLabel="Guess event year"
            disabled={disabled}
            onChange={(nextYear) => updateDate({ year: nextYear })}
            options={yearOptions}
            value={selectedYear}
          />
        </div>
      </div>
    </section>
  );
}

function WheelColumn({
  ariaLabel,
  disabled,
  onChange,
  options,
  value,
}: WheelColumnProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: number;
    scrollTop: number;
    startY: number;
  } | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    scroller.scrollTop = selectedIndex * WHEEL_ITEM_PX;
  }, [selectedIndex]);

  const updateFromScroll = (event: UIEvent<HTMLDivElement>) => {
    const nextIndex = Math.min(
      options.length - 1,
      Math.max(0, Math.round(event.currentTarget.scrollTop / WHEEL_ITEM_PX)),
    );
    const nextValue = options[nextIndex]?.value;

    if (!disabled && nextValue !== undefined && nextValue !== value) {
      onChange(nextValue);
    }
  };

  const moveWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    const direction =
      event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;

    if (direction === 0) {
      return;
    }

    event.preventDefault();
    const nextOption = options[
      Math.min(options.length - 1, Math.max(0, selectedIndex + direction))
    ];

    if (nextOption) {
      onChange(nextOption.value);
    }
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.pointerType === "touch") {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      scrollTop: event.currentTarget.scrollTop,
      startY: event.clientY,
    };
  };

  const dragWheel = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.id !== event.pointerId) {
      return;
    }

    event.currentTarget.scrollTop = drag.scrollTop - event.clientY + drag.startY;
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id === event.pointerId) {
      dragRef.current = null;
    }
  };

  return (
    <div
      aria-label={ariaLabel}
      aria-valuemax={options[options.length - 1]?.value}
      aria-valuemin={options[0]?.value}
      aria-valuenow={value}
      className={`date-wheel-column ${disabled ? "date-wheel-disabled" : ""}`}
      onKeyDown={moveWithKeyboard}
      onPointerCancel={stopDrag}
      onPointerDown={startDrag}
      onPointerMove={dragWheel}
      onPointerUp={stopDrag}
      onScroll={updateFromScroll}
      ref={scrollerRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
    >
      <div aria-hidden="true" className="date-wheel-spacer" />
      {options.map((option) => (
        <div
          className={`date-wheel-option ${
            option.value === value ? "date-wheel-option-selected" : ""
          }`}
          key={option.value}
        >
          <span className="date-wheel-label-full">{option.label}</span>
          <span className="date-wheel-label-short">
            {option.shortLabel ?? option.label}
          </span>
        </div>
      ))}
      <div aria-hidden="true" className="date-wheel-spacer" />
    </div>
  );
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}
