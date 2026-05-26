import type { Round } from "@/types/game";
import { importedRounds } from "@/data/importedRounds";

// Upload 360-degree equirectangular panoramas to these local paths as needed.
export const coreRounds: Round[] = [
  {
    id: "1936-olympics-jesse-owens",
    title: "Jesse Owens at Berlin 1936",
    imageUrl: "/rounds/jesse-owens-1936.jpg",
    actualYear: 1936,
    actualMonth: "August",
    actualDay: 3,
    actualLocation: {
      name: "Olympiastadion Berlin",
      city: "Berlin",
      country: "Germany",
      lat: 52.5147,
      lng: 13.2394,
    },
    description:
      "Jesse Owens stands atop the podium after a historic performance at the 1936 Olympic Games in Nazi Germany.",
  },
  {
    id: "barry-bonds-home-run-record",
    title: "Barry Bonds Breaks the Record",
    imageUrl: "/rounds/barry-bonds-2007.jpg",
    actualYear: 2007,
    actualMonth: "August",
    actualDay: 7,
    actualLocation: {
      name: "AT&T Park",
      city: "San Francisco",
      country: "United States",
      lat: 37.7786,
      lng: -122.3893,
    },
    description:
      "Barry Bonds launches his record-breaking 756th home run into the San Francisco night, surpassing Hank Aaron.",
  },
  {
    id: "michael-jordan-last-shot",
    title: "Jordan's Last Shot",
    imageUrl: "/rounds/jordan-last-shot.jpg",
    actualYear: 1998,
    actualMonth: "June",
    actualDay: 14,
    actualLocation: {
      name: "Delta Center",
      city: "Salt Lake City",
      country: "United States",
      lat: 40.7683,
      lng: -111.9011,
    },
    description:
      "Michael Jordan rises over Bryon Russell for the iconic game-winning jumper in Game 6 of the 1998 NBA Finals.",
  },
  {
    id: "maradona-hand-of-god",
    title: "Hand of God",
    imageUrl: "/rounds/hand-of-god.jpg",
    actualYear: 1986,
    actualMonth: "June",
    actualDay: 22,
    actualLocation: {
      name: "Estadio Azteca",
      city: "Mexico City",
      country: "Mexico",
      lat: 19.3029,
      lng: -99.1505,
    },
    description:
      "Diego Maradona leaps above England goalkeeper Peter Shilton to score the infamous 'Hand of God' goal at the 1986 World Cup.",
  },
  {
    id: "tiger-woods-chip-in-2005",
    title: "Tiger's Chip-In at Augusta",
    imageUrl: "/rounds/tiger-chip-in-2005.jpg",
    actualYear: 2005,
    actualMonth: "April",
    actualDay: 10,
    actualLocation: {
      name: "Augusta National Golf Club",
      city: "Augusta",
      country: "United States",
      lat: 33.5021,
      lng: -82.0209,
    },
    description:
      "Tiger Woods watches his legendary chip on the 16th green pause on the lip before dropping during the final round of the Masters.",
  },
];

export const rounds: Round[] = [...coreRounds, ...importedRounds];
