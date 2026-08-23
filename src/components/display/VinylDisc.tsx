import Image from "next/image";
import { VENUE } from "@/config/venue";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

// The Now Playing thumbnail, styled as a spinning record: a dense grooved,
// matte-black disc framing a circularly-cropped thumbnail — or, with no
// thumbnail, just the bare grooved disc, same as a real record with no
// picture sleeve — plus a center label carrying the venue's initials
// (config/venue.ts; no logo asset required, unlike aut-dj-party's uploaded
// AUT mark). Spins only while `spinning` is true. Disc/label sizes are
// calc(<base> * var(--card-scale)) so this scales in lockstep with
// DisplayCard's own font/padding/gap sizing.
export default function VinylDisc({
  thumbnailUrl,
  spinning,
}: {
  thumbnailUrl: string | null;
  spinning: boolean;
}) {
  return (
    <div className="relative h-[calc(10rem*var(--card-scale))] w-[calc(10rem*var(--card-scale))] shrink-0 sm:h-[calc(13rem*var(--card-scale))] sm:w-[calc(13rem*var(--card-scale))]">
      <div
        className="relative h-full w-full rounded-full"
        style={{
          background: [
            // Two ring patterns at slightly different periods so they drift
            // in and out of phase across the radius instead of reading as
            // one smooth, even gradient.
            "repeating-radial-gradient(circle, rgba(244,238,231,0.12) 0px, rgba(244,238,231,0.12) 0.6px, transparent 0.6px, transparent 3px)",
            "repeating-radial-gradient(circle, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 0.6px, transparent 0.6px, transparent 4.3px)",
            "#0b0b09",
          ].join(", "),
          animation: spinning ? "vinyl-spin 3.5s linear infinite" : undefined,
        }}
      >
        {thumbnailUrl && (
          <div className="absolute inset-[9%] overflow-hidden rounded-full">
            {/* unoptimized: album_art_url can be a moderator-pasted URL from
                any host. */}
            <Image src={thumbnailUrl} alt="" fill sizes="208px" className="object-cover" unoptimized />
          </div>
        )}

        <div className="absolute left-1/2 top-1/2 flex h-[calc(2.5rem*var(--card-scale))] w-[calc(2.5rem*var(--card-scale))] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full bg-brand-surface sm:h-[calc(3rem*var(--card-scale))] sm:w-[calc(3rem*var(--card-scale))]">
          <span className="font-heading text-[length:calc(0.75rem*var(--card-scale))] font-bold text-brand-accent sm:text-[length:calc(0.9rem*var(--card-scale))]">
            {initials(VENUE.djName)}
          </span>
        </div>
      </div>
    </div>
  );
}
