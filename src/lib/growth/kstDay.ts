const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * KST(+9h) 기준 day bucket 키(YYYY-MM-DD). 서버 TZ 의존 없이 오프셋만 가산한다.
 * 서버(growth page)와 클라이언트(GrowthTrendChart)가 같은 버킷 규칙을 공유해야
 * 하므로 이 모듈에 둔다 — Date 파싱("YYYY-MM-DD")은 UTC 자정으로 해석돼 KST와
 * 최대 9시간 어긋난다.
 */
export function kstDayKey(input: string | number | Date): string {
  return new Date(new Date(input).getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}
