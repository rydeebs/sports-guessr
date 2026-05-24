export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      key:
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
        process.env.GOOGLE_MAPS_API_KEY ??
        "",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
