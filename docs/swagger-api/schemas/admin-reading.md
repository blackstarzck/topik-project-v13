# Admin Reading Schemas

Source: [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-07-07

Boundary note: these schemas are for external backend admin reference only. They do not authorize new v13 user-app admin UI.

## Schema Index

| Schema | Type | Description |
| --- | --- | --- |
| [EditRequest](#editrequest) | object | Admin reading bank edit request. |
| [ReadingBankItem](#readingbankitem) | object | One reading bank item. |
| [ReadingBankListResponse](#readingbanklistresponse) | object | Reading bank list response. |
| [src__api__routes__admin_reading__ReviewRequest](#src-api-routes-admin-reading-reviewrequest) | object | Admin reading review request. |

## EditRequest

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `prompt_text` | no | string \| null | Replacement prompt text. |  |
| `answer_key` | no | object \| null | Replacement answer key. |  |
| `content_team_memo` | no | string \| null | Internal content-team memo. |  |

## ReadingBankItem

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `question_id` | yes | string | Reading bank question id. |  |
| `item_number` | yes | integer | TOPIK reading item number. |  |
| `question_type_name` | yes | string | Question type name. |  |
| `target_level` | no | string \| null | Target TOPIK level. |  |
| `prompt_text` | yes | string | Prompt text. |  |
| `answer_key` | yes | object | Answer key payload. |  |
| `needs_image` | yes | boolean | Whether the item needs an image. |  |
| `image_key` | no | string \| null | Image key when present. |  |
| `review_status` | yes | string | Review status. |  |
| `service_status` | yes | string | Service exposure status. |  |
| `review_note` | no | string \| null | Review note. |  |

## ReadingBankListResponse

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `total` | yes | integer | Total matching items. |  |
| `items` | yes | array<[ReadingBankItem](./admin-reading.md#readingbankitem)> | Current page items. |  |

## src__api__routes__admin_reading__ReviewRequest

OpenAPI component key: `src__api__routes__admin_reading__ReviewRequest`. The shared schema title is `ReviewRequest`; use the component key in links to avoid colliding with the admin-eval review schema.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `review_status` | yes | string | `검수 필요` \| `검수 완료` \| `검수 거부` \| `사용 보류`. |  |
| `service_status` | no | string \| null | `내부 테스트` \| `노출 가능` \| `노출 제외`. |  |
| `review_note` | no | string \| null | Review note. |  |
