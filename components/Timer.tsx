type TimerProps = {
  secondsLeft: number;
  totalSeconds: number;
};

export function Timer({ secondsLeft }: TimerProps) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft <= 10 && secondsLeft > 0;

  return (
    <div
      aria-live="polite"
      className={`timer-shell relative grid place-items-center ${
        isUrgent ? "timer-shell-urgent" : ""
      }`}
    >
      <span className="relative z-10 font-sans text-4xl font-medium tracking-normal text-white">
        <span className="timer-label">Gameclock</span>
        <span className="timer-value">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </span>
      </span>
    </div>
  );
}
