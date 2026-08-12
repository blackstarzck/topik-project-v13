# Evaluation Schemas

Source snapshot: generated from the former TALKPIK external API documentation on 2026-07-07. The original service and documentation routes are no longer available.
Last synced: 2026-06-23

## Schema Index

| Schema | Type | Description |
| --- | --- | --- |
| [CombinedFeedbackDetail](#combinedfeedbackdetail) | object | Merged learning + drill feedback (single pipeline agent output). |
| [DrillExerciseDetail](#drillexercisedetail) | object | Practice exercise. |
| [ErrorDetail](#errordetail) | object | A single detected error. |
| [EvaluationFeedbackResponse](#evaluationfeedbackresponse) | object | Full evaluation feedback response. |
| [EvaluationStatusResponse](#evaluationstatusresponse) | object | Response for evaluation status polling. |
| [GrammarPointDetail](#grammarpointdetail) | object | Grammar point for learning. |
| [InlineAnnotationDetail](#inlineannotationdetail) | object | Inline annotation on essay text. |
| [ModelAnswerDetail](#modelanswerdetail) | object | Model answer response. |
| [TraitScoreDetail](#traitscoredetail) | object | Detailed trait score. ``score`` is the FINAL rubric score on this trait's |

## CombinedFeedbackDetail

Merged learning + drill feedback (single pipeline agent output).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `grammar_points` | yes | array<[GrammarPointDetail](./evaluation.md#grammarpointdetail)> |  |  |
| `vocabulary` | yes | array<string> |  |  |
| `related_topics` | yes | array<string> |  |  |
| `study_tips` | yes | string |  |  |
| `exercises` | yes | array<[DrillExerciseDetail](./evaluation.md#drillexercisedetail)> |  |  |
| `focus_areas` | yes | array<string> |  |  |

## DrillExerciseDetail

Practice exercise.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `exercise_type` | yes | string |  |  |
| `question` | yes | string |  |  |
| `answer` | yes | string |  |  |
| `explanation` | yes | string |  |  |
| `target_error_type` | yes | string |  |  |

## ErrorDetail

A single detected error.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `error_type` | yes | string |  |  |
| `severity` | yes | string |  |  |
| `original` | yes | string |  |  |
| `correction` | yes | string |  |  |
| `explanation` | yes | string |  |  |

## EvaluationFeedbackResponse

Full evaluation feedback response.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submission_id` | yes | string |  |  |
| `status` | yes | string |  |  |
| `total_score` | yes | number |  |  |
| `max_score` | yes | number |  |  |
| `processing_time_seconds` | yes | number |  |  |
| `trait_scores` | yes | array<[TraitScoreDetail](./evaluation.md#traitscoredetail)> |  |  |
| `errors` | yes | array<[ErrorDetail](./evaluation.md#errordetail)> |  |  |
| `model_answer` | no | [ModelAnswerDetail](./evaluation.md#modelanswerdetail) \| null |  |  |
| `combined_feedback` | no | [CombinedFeedbackDetail](./evaluation.md#combinedfeedbackdetail) \| null |  |  |
| `annotations` | no | array<[InlineAnnotationDetail](./evaluation.md#inlineannotationdetail)> |  |  |
| `ai_summary` | no | string | Unified AI summary | default:  |
| `degraded` | no | boolean | True if 1+ scoring agent fell back to default | default: false |
| `degraded_traits` | no | array<string> | Trait names that used fallback scores |  |

## EvaluationStatusResponse

Response for evaluation status polling.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submission_id` | yes | string |  |  |
| `status` | yes | string | processing \| graded \| failed |  |
| `total_score` | no | number \| null |  |  |
| `max_score` | no | number \| null |  |  |
| `processing_time_seconds` | no | number \| null |  |  |

## GrammarPointDetail

Grammar point for learning.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `grammar` | yes | string |  |  |
| `explanation` | yes | string |  |  |
| `example` | yes | string |  |  |

## InlineAnnotationDetail

Inline annotation on essay text.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `start_offset` | yes | integer |  |  |
| `end_offset` | yes | integer |  |  |
| `text` | yes | string |  |  |
| `annotation_type` | yes | string |  |  |
| `category` | yes | string |  |  |
| `comment` | yes | string |  |  |
| `suggestion` | no | string |  | default:  |

## ModelAnswerDetail

Model answer response.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `model_essay` | yes | string |  |  |
| `key_points` | yes | array<string> |  |  |
| `structure_note` | yes | string |  |  |

## TraitScoreDetail

Detailed trait score. ``score`` is the FINAL rubric score on this trait's
own scale; ``max_score`` is its denominator (render ``score/max_score`` — e.g.
언어 22/26 — not a fixed /10).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `trait` | yes | string |  |  |
| `trait_korean` | yes | string |  |  |
| `weight` | yes | number |  |  |
| `score` | yes | integer |  |  |
| `max_score` | no | integer |  | default: 0 |
| `feedback` | yes | string |  |  |
| `strengths` | no | array<string> |  |  |
| `improvements` | no | array<string> |  |  |
