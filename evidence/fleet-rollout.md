# Fleet rollout — chưa triển khai

**BLOCKED_RELEASE_GATES**. Chỉ có inventory metadata; mọi lệnh chạy trên G6. Không accepted release artifact, rollback production hoặc safe offline command.

| Máy | ID | Version trước | Version quan sát sau | Online sau | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| docker | `0c6a0797215e-6d2dae4e` | 1.0.11 | 1.0.11 | true | BLOCKED |
| g6 | `desktop-b5e4iue-87cea2af` | 1.0.11 | 1.0.11 | true | BLOCKED |
| a5 | `dl-boxii-92c0beaa` | 1.0.11 | 1.0.11 | true | BLOCKED |
| g8 | `hp450-79844b90` | 1.0.11 | 1.0.11 | true | BLOCKED |
| fjp | `lppduongnh66-1-7337f19f` | 1.0.10 | 1.0.10 | true | EXCLUDED_BY_USER |
| r28-nspawn | `univ2019-03-6d9cfff7` | 1.0.10 | 1.0.10 | true | BLOCKED |
| r28 | `univ2019-03-d1c55794` | 1.0.11 | 1.0.11 | true | BLOCKED |
| z99 | `z0003210299-2de3addc` | 1.0.10 | 1.0.10 | false | DEFERRED_OFFLINE |

FJP được loại trừ bởi người dùng. Z99 offline, preparationComplete=false. Không có máy nào được coi là đã nâng cấp. Counter/epoch trước và sau nằm trong fleet-rollout.json; chúng không phải token usage LLM.
