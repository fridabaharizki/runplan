// "1:10:00" -> 4200, "40:00" -> 2400, invalid -> null
export function parseDuration(input: string): number | null {
    const parts = input.trim().split(":").map(Number);
    const valid =
        parts.length >= 2 &&
        parts.length <= 3 &&
        parts.every((n) => Number.isInteger(n) && n >= 0) &&
        parts.slice(1).every((n) => n < 60);
    return valid ? parts.reduce((total, n) => total * 60 + n, 0) : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDuration(totalSec: number): string {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.round(totalSec % 60);
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export const formatPace = (secPerKm: number) => `${formatDuration(secPerKm)} /km`;

const dateFormat = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
});
export const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`));