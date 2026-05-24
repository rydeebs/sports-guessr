"use client";

import {
  KeyboardEvent,
  PointerEvent,
  UIEvent,
  WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type YearSliderProps = {
  year: number | null;
  onChange: (year: number) => void;
  disabled?: boolean;
};

const FIRST_YEAR = 1900;
const LAST_YEAR = 2026;
const DEFAULT_YEAR = 1963;
const YEAR_STEP_PX = 12;

export function YearSlider({ year, onChange, disabled = false }: YearSliderProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: number;
    startX: number;
    scrollLeft: number;
  } | null>(null);
  const selectedYear = year ?? DEFAULT_YEAR;
  const [isEditingYear, setIsEditingYear] = useState(false);
  const [yearDraft, setYearDraft] = useState(String(selectedYear));
  const years = useMemo(
    () =>
      Array.from(
        { length: LAST_YEAR - FIRST_YEAR + 1 },
        (_, index) => FIRST_YEAR + index,
      ),
    [],
  );

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    scroller.scrollLeft = (selectedYear - FIRST_YEAR) * YEAR_STEP_PX;

    if (year === null) {
      onChange(selectedYear);
    }
  }, [onChange, selectedYear, year]);

  useEffect(() => {
    if (!isEditingYear) {
      setYearDraft(String(selectedYear));
    }
  }, [isEditingYear, selectedYear]);

  const updateYearFromScroll = (event: UIEvent<HTMLDivElement>) => {
    const nextYear = Math.min(
      LAST_YEAR,
      Math.max(
        FIRST_YEAR,
        FIRST_YEAR + Math.round(event.currentTarget.scrollLeft / YEAR_STEP_PX),
      ),
    );

    if (!disabled && nextYear !== selectedYear) {
      onChange(nextYear);
    }
  };

  const scrollWithWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (disabled || !event.currentTarget) {
      return;
    }

    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      event.currentTarget.scrollLeft += event.deltaY;
    }
  };

  const moveWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    const nextYear =
      event.key === "ArrowLeft"
        ? selectedYear - 1
        : event.key === "ArrowRight"
          ? selectedYear + 1
          : null;

    if (nextYear !== null) {
      event.preventDefault();
      onChange(Math.min(LAST_YEAR, Math.max(FIRST_YEAR, nextYear)));
    }
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.pointerType === "touch") {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      scrollLeft: event.currentTarget.scrollLeft,
      startX: event.clientX,
    };
  };

  const dragYears = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.id !== event.pointerId) {
      return;
    }

    event.currentTarget.scrollLeft = drag.scrollLeft - event.clientX + drag.startX;
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id === event.pointerId) {
      dragRef.current = null;
    }
  };

  const commitTypedYear = () => {
    const typedYear = Number(yearDraft);

    if (Number.isFinite(typedYear)) {
      onChange(
        Math.min(LAST_YEAR, Math.max(FIRST_YEAR, Math.round(typedYear))),
      );
    } else {
      setYearDraft(String(selectedYear));
    }

    setIsEditingYear(false);
  };

  return (
    <section className="year-control text-white">
      <div className="relative pb-4 text-center">
        <label className="sr-only" htmlFor="year-scroll">
          Guess event year
        </label>
        {isEditingYear ? (
          <input
            aria-label="Enter guessed year"
            autoFocus
            className="year-entry font-serif"
            disabled={disabled}
            inputMode="numeric"
            max={LAST_YEAR}
            min={FIRST_YEAR}
            onBlur={commitTypedYear}
            onChange={(event) => setYearDraft(event.target.value)}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitTypedYear();
              }

              if (event.key === "Escape") {
                setYearDraft(String(selectedYear));
                setIsEditingYear(false);
              }
            }}
            type="number"
            value={yearDraft}
          />
        ) : (
          <button
            className="year-value font-serif"
            disabled={disabled}
            onClick={() => setIsEditingYear(true)}
            type="button"
          >
            {selectedYear}
          </button>
        )}
        <span className="year-pointer top-pointer" aria-hidden="true" />
      </div>
      <div className="year-rail relative">
        <span className="year-pointer bottom-pointer" aria-hidden="true" />
        <span aria-hidden="true" className="year-center-line" />
        <div
          aria-label="Guess event year"
          aria-valuemax={LAST_YEAR}
          aria-valuemin={FIRST_YEAR}
          aria-valuenow={selectedYear}
          className={`year-scroll absolute inset-0 z-10 ${
            disabled ? "year-scroll-disabled" : ""
          }`}
          id="year-scroll"
          onKeyDown={moveWithKeyboard}
          onPointerCancel={stopDrag}
          onPointerDown={startDrag}
          onPointerMove={dragYears}
          onPointerUp={stopDrag}
          onScroll={updateYearFromScroll}
          onWheel={scrollWithWheel}
          ref={scrollerRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
        >
          <div aria-hidden="true" className="year-strip">
            {years.map((tickYear) => {
              const isDecade = tickYear % 10 === 0;

              return (
                <span
                  className={`year-tick ${isDecade ? "decade-tick" : ""}`}
                  key={tickYear}
                >
                  {isDecade ? (
                    <span className="year-tick-label">{tickYear}</span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
