# Auth And Errors

Source: [Swagger UI](https://api.dotoretopik.com/docs) / [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-23

## Security Schemes

| Scheme | Type | In | Name | Description |
| --- | --- | --- | --- | --- |
| `BearerAuth` | http | - | - | JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login. |
| `CampaignApiKey` | apiKey | header | X-API-Key | Shared campaign API key for the /api/external/campaign/* endpoints. |

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

## Error Schema

- [HTTPValidationError](./schemas/common.md#httpvalidationerror)
- [ValidationError](./schemas/common.md#validationerror)
