# Common Schemas

Source: [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-23

## Schema Index

| Schema | Type | Description |
| --- | --- | --- |
| [HTTPValidationError](#httpvalidationerror) | object |  |
| [ProvidedQuestion](#providedquestion) | object | A single prompt blank shown to the applicant for Q51/Q52 fill-in tasks. |
| [ValidationError](#validationerror) | object |  |

## HTTPValidationError

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `detail` | no | array<[ValidationError](./common.md#validationerror)> |  |  |

## ProvidedQuestion

A single prompt blank shown to the applicant for Q51/Q52 fill-in tasks.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | Stable identifier of the blank/sub-question (e.g. 'a', 'b'). | a |
| `text` | yes | string | Korean prompt text surrounding the blank the applicant must fill. | 다음을 읽고 ( ㉠ )에 들어갈 말을 쓰십시오. |

## ValidationError

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `loc` | yes | array<string \| integer> |  |  |
| `msg` | yes | string |  |  |
| `type` | yes | string |  |  |
| `input` | no | - |  |  |
| `ctx` | no | object |  |  |
