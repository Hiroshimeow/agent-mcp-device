# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.10] - 2026-10-04

### Added
- **Direct in-process tool dispatch**: Added `src/tool-dispatcher.ts` and refactored `GatewayToolAdapter` to invoke tool handlers directly in-process, bypassing the internal child-process stdio hop.
- **Single-call bounded search (`search_once`)**: Integrated single-call search capability to reduce round-trip LLM token cost and latency.
- **Resource accounting core (`src/utils/resource-accounting.ts`)**: Introduced per-instance bounded resource reservations and saturation guards against out-of-memory states under high load.
- **Image preview budget cap**: Enforced an 8 MiB maximum payload cap on bounded remote image previews.

### Changed
- **Gateway version reporting**: Explicitly report static `VERSION` constant (`1.0.10`) during Gateway device channel registration, preventing `undefined` fallback when run outside `npm` scripts.
- **Unified tool schemas**: Cleaned up and unified schemas across file, search, edit, and process tools to minimize token footprint.
- **Early bootstrap optimization**: Configured `UV_THREADPOOL_SIZE` (16/32) prior to loading runtime dependencies in `src/mcp-device.ts` and `src/bootstrap.ts`.

### Fixed
- **Completed process output replay**: Fixed regression in `terminal-manager.ts` and `improved-process-tools.ts` where `markOutputConsumed` cleared output buffers on completed processes; buffers now remain replayable matching v1.0.9 behavior.

### Retained & Compatibility
- **Backward compatibility (OD-4 Option B)**: Retained `LocalExecutionEngine` for internal migration and dev harness compatibility while routing live Gateway traffic in-process.

---

## [1.0.9] - 2026-09-24

### Fixed
- Concurrent remote tool calls dispatching on Gateway device channel.

---

## [1.0.8] - 2026-09-23

### Fixed
- Symlinked global package entrypoint resolution during update lifecycles.

---

## [1.0.7] - 2026-09-22

### Added
- Device runtime readiness advertisement independent of transport.
- Background device processes pinning to runtime directory.
