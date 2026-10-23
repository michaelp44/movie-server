import type { ProviderSearchResult } from '@movie-server/shared';

const GB = 1024 * 1024 * 1024;

export function scoreForSamsungOptical(
  title: string,
  sizeBytes: number | null
): NonNullable<ProviderSearchResult['compatibility']> {
  const normalized = title.toLowerCase();
  const reasons: string[] = [];
  let score = 50;

  const has = (pattern: RegExp) => pattern.test(normalized);

  if (has(/\b(1080p|720p)\b/)) {
    score += 18;
    reasons.push('HD resolution is easier to stream and seek');
  }

  if (has(/\b(2160p|4k|uhd)\b/)) {
    score -= 20;
    reasons.push('4K is heavier for Plex seeking');
  }

  if (has(/\b(x264|h\.?264|avc)\b/)) {
    score += 16;
    reasons.push('H.264 is highly compatible with Samsung Plex');
  }

  if (has(/\b(x265|h\.?265|hevc|10bit|10-bit)\b/)) {
    score -= 16;
    reasons.push('HEVC/10-bit may force direct-stream or transcode behavior');
  }

  if (has(/\b(ac3|dd5\.?1|dolby digital)\b/)) {
    score += 22;
    reasons.push('AC3 5.1 is the safest surround format over optical');
  }

  if (has(/\b(aac)\b/) && has(/\b(5\.1|6ch|6 ch|channels? 6)\b/)) {
    score -= 18;
    reasons.push('AAC 5.1 is risky with optical soundbars');
  } else if (has(/\b(aac)\b/)) {
    score += 4;
    reasons.push('AAC stereo is usually compatible');
  }

  if (has(/\b(eac3|e-ac-3|ddp|ddp5\.?1|atmos|truehd|dts[- .]?hd|dts-hd|7\.1)\b/)) {
    score -= 28;
    reasons.push('Atmos/TrueHD/DTS-HD/EAC3 often breaks or downmixes over optical');
  }

  if (has(/\b(remux|bluray remux)\b/)) {
    score -= 18;
    reasons.push('Remux files are large and seek poorly from a mechanical HDD');
  }

  if (sizeBytes !== null) {
    const sizeGb = sizeBytes / GB;
    if (sizeGb <= 4) {
      score += 8;
      reasons.push('Small file size should seek well from HDD');
    } else if (sizeGb > 12) {
      score -= 20;
      reasons.push('Large file size may stutter or seek slowly from HDD');
    } else if (sizeGb > 7) {
      score -= 8;
      reasons.push('Moderate-large file size may be slower to seek');
    }
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const level = boundedScore >= 72 ? 'best' : boundedScore >= 45 ? 'ok' : 'risky';
  const label =
    level === 'best'
      ? 'Best for TV'
      : level === 'ok'
        ? 'May work'
        : 'Risky for TV';

  return {
    score: boundedScore,
    level,
    label,
    reasons: reasons.slice(0, 4),
  };
}

export function sortByCompatibility(
  results: ProviderSearchResult[]
): ProviderSearchResult[] {
  return [...results].sort((a, b) => {
    const compatibilityDelta =
      (b.compatibility?.score ?? 0) - (a.compatibility?.score ?? 0);
    if (compatibilityDelta !== 0) return compatibilityDelta;

    return (b.seeds ?? 0) - (a.seeds ?? 0);
  });
}
