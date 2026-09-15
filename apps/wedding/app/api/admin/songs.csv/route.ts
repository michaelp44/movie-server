import { getAuthenticatedAdmin, listSongRequests } from "@/lib/admin";

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!(await getAuthenticatedAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const songs = await listSongRequests();
  const rows = [
    ["Song", "Artist", "Guest", "Submitted at"],
    ...songs.map((song) => [song.song, song.artist, song.display_name, song.created_at]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wedding-song-requests.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
