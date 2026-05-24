type TimerProps = {
  secondsLeft: number;
  totalSeconds: number;
};

export function Timer({ secondsLeft, totalSeconds }: TimerProps) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = Math.min(1, Math.max(0, secondsLeft / totalSeconds));
  const dashLength = 1000;

  return (
    <div
      aria-live="polite"
      className="timer-shell relative grid place-items-center"
    >
      <svg
        aria-hidden="true"
        className="timer-border absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 200 110"
      >
        <rect
          className="timer-track"
          height="102"
          pathLength={dashLength}
          rx="51"
          ry="51"
          width="192"
          x="4"
          y="4"
        />
        <rect
          className="timer-progress"
          height="102"
          pathLength={dashLength}
          rx="51"
          ry="51"
          style={{
            strokeDasharray: dashLength,
            strokeDashoffset: dashLength * (1 - progress),
          }}
          width="192"
          x="4"
          y="4"
        />
      </svg>
      <span className="relative z-10 font-sans text-4xl font-medium tracking-normal text-white">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
