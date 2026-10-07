// Progresso de cena (s) a partir da rolagem: soma das transições de cada seção [data-cena].
// Compartilhado pelo 3D (ScrollDirector) e pelo vídeo dos aparelhos fracos (scripts/video.ts).
export function progressoDe(tops: number[], y = scrollY, vh = innerHeight) {
  let s = 0;
  for (let i = 1; i < tops.length; i++) {
    const top = tops[i] - y;
    s += Math.min(1, Math.max(0, (vh * 0.92 - top) / (vh * 0.62)));
  }
  return s;
}
