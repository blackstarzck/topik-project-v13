# Fixture — fx-04 FAIL (skipped without sub-fields)

부모만 `skipped`이고 하위 4개 필드 없음.
현재 checker는 사유 문자열 자체는 검증하지 않지만(skipped 단독도 부모로는 통과),
하위 4개 필드 누락은 FAIL이어야 함.

- UX/UI Consistency Pass: skipped

(sub-fields intentionally not provided — fixture verifies that checker catches missing sub-fields even when parent is 'skipped')
