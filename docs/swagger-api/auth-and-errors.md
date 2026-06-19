# Auth And Errors

Source: [Swagger UI](https://api.dotoretopik.com/docs) / [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-19

## Security Schemes

| Scheme | Type | In | Name | Description |
| --- | --- | --- | --- | --- |
| `BearerAuth` | http | - | - | JWT bearer authentication. |
| `CampaignApiKey` | apiKey | header | X-API-Key | API key for external campaign endpoints. |

## Header Examples

Bearer token endpoints:

```http
Authorization: Bearer <jwt>
Content-Type: application/json
```

External campaign API-key endpoints:

```http
X-API-Key: <campaign_api_key>
Content-Type: application/json
```

Multipart upload endpoints:

```http
X-API-Key: <campaign_api_key>
Content-Type: multipart/form-data
```

## Common Status Codes

| Status | Meaning |
| --- | --- |
| 200 | Request succeeded. |
| 201 | Resource created. |
| 202 | Async job accepted. Poll with the returned `submission_id` or task id. |
| 400 | Invalid request body or parameters. |
| 401 | Missing or invalid JWT/API key. |
| 403 | Authenticated but not allowed. |
| 404 | Resource not found. |
| 422 | OpenAPI/Pydantic validation error. See [HTTPValidationError](./schemas/common.md#httpvalidationerror). |
| 429 | Rate limit exceeded. |
| 500 | Server error. |

## Rate Limit Notes

The live Swagger description explicitly marks writing submission as `5 requests/minute`. If another endpoint description states a more specific limit, treat the endpoint description as authoritative.

## Error Schema

- [HTTPValidationError](./schemas/common.md#httpvalidationerror)
- [ValidationError](./schemas/common.md#validationerror)
