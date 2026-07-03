type QueryErrorLike = { message: string } | null;

/**
 * supabase-js 쿼리는 실패해도 throw하지 않고 `{ data, error }`를 반환한다.
 * error를 확인하지 않으면 실패가 "데이터 없음" 빈 상태로 위장되므로, 라벨을
 * 붙여 throw해 호출부의 페이지 단위 오류 처리로 승격시킨다.
 */
export function throwIfQueryError(
  label: string,
  result: { error: QueryErrorLike },
): void {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
}
