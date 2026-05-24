# MomentGuessr

MomentGuessr uses the Google Maps JavaScript API for the guess map. A player
selects a location by clicking the map, so the project only needs the Maps
JavaScript API for the current location picker.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`.
4. Start the app with `npm run dev`.

## Google Maps setup

1. Create or select a Google Cloud project with billing enabled.
2. Enable `Maps JavaScript API` for that project.
3. Create an API key in Google Cloud credentials.
4. Restrict the key to websites with HTTP referrer restrictions.
5. Add local referrers while developing:

   ```text
   http://localhost:3000/*
   http://127.0.0.1:3000/*
   http://localhost:3002/*
   http://127.0.0.1:3002/*
   ```

6. Add the deployed site referrer before production use, for example:

   ```text
   https://your-vercel-project.vercel.app/*
   https://your-custom-domain.example/*
   ```

7. Restrict the key to the `Maps JavaScript API`.

The key is used by browser code, so it is expected to be visible to the client.
Keep it limited with website referrer and API restrictions instead of treating it
like a server secret.

## Location picker

The map setup lives in `components/GuessMap.tsx`. Once the key is configured,
clicking the map records the selected latitude and longitude for the guess.
