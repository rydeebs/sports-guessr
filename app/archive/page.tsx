import Link from "next/link";
import { getAvailableDailyDates, getDailyGame } from "@/data/dailyGames";

export default function ArchivePage() {
  const dates = getAvailableDailyDates();

  return (
    <main className="state-page min-h-screen px-4 py-6 text-[#0d1a26] sm:px-6">
      <section className="state-card mx-auto max-w-5xl rounded-[1.5rem] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-sans text-xs font-black uppercase text-[#566373]">
              Daily Games
            </p>
            <h1 className="mt-1 font-serif text-5xl">Archive</h1>
          </div>
          <Link className="state-back rounded-full px-5 py-3 font-sans text-sm font-black uppercase" href="/">
            Back
          </Link>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {dates.map((date) => {
            const dailyGame = getDailyGame(date);

            return (
              <Link
                className="rounded-[1.25rem] border border-[#bfccda] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                href={`/?date=${date}`}
                key={date}
              >
                <p className="font-serif text-3xl">{formatDate(date)}</p>
                <p className="mt-2 font-sans text-sm text-[#566373]">
                  {dailyGame.rounds.length} rounds ·{" "}
                  {dailyGame.hasUniqueImages ? "unique images" : "duplicate images"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}
