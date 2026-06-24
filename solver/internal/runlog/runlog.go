// Package runlog menyediakan logging terstruktur per-run solver ke stderr dan file.
package runlog

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strconv"
	"sync"
	"time"
)

const (
	envRunID     = "PWL2_RUN_ID"
	envDatasetID = "PWL2_DATASET_ID"
	envLogFile   = "PWL2_LOG_FILE"
)

var (
	defaultLogger = slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
	mu            sync.RWMutex
)

// SetDefault mengganti logger global yang dipakai helper Phase/Event.
func SetDefault(logger *slog.Logger) {
	if logger == nil {
		return
	}
	mu.Lock()
	defaultLogger = logger
	mu.Unlock()
}

// Default mengembalikan logger global saat ini.
func Default() *slog.Logger {
	mu.RLock()
	defer mu.RUnlock()
	return defaultLogger
}

// InitFromEnv membuat logger dari env PWL2_* yang diset Laravel.
// Jika env tidak ada, fallback ke stderr-only.
func InitFromEnv() (*slog.Logger, error) {
	runID := envInt(envRunID)
	datasetID := envInt(envDatasetID)
	logFile := os.Getenv(envLogFile)

	writers := []io.Writer{os.Stderr}
	if logFile != "" {
		file, err := os.OpenFile(logFile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return nil, err
		}
		writers = append(writers, file)
	}

	handler := slog.NewJSONHandler(io.MultiWriter(writers...), &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	logger := slog.New(&contextHandler{
		base:      handler,
		runID:     runID,
		datasetID: datasetID,
	})

	SetDefault(logger)
	return logger, nil
}

// WithDatasetID mengembalikan logger dengan dataset_id eksplisit (untuk CLI manual).
func WithDatasetID(datasetID int) *slog.Logger {
	logger := Default()
	if datasetID <= 0 {
		return logger
	}
	return logger.With("dataset_id", datasetID)
}

// Event menulis log event standar.
func Event(phase, event string, detail map[string]any) {
	attrs := []any{
		"phase", phase,
		"event", event,
	}
	if len(detail) > 0 {
		attrs = append(attrs, "detail", detail)
	}
	Default().Info("solver", attrs...)
}

// EventWithDuration menulis log event dengan durasi di level atas.
func EventWithDuration(phase, event string, durationMs int64, detail map[string]any) {
	attrs := []any{
		"phase", phase,
		"event", event,
		"duration_ms", durationMs,
	}
	if len(detail) > 0 {
		attrs = append(attrs, "detail", detail)
	}
	Default().Info("solver", attrs...)
}

// Phase menjalankan fn sambil mencatat start/done/error beserta durasi.
func Phase(phase string, fn func() error) error {
	start := time.Now()
	Event(phase, "start", nil)

	if err := fn(); err != nil {
		EventWithDuration(phase, "error", time.Since(start).Milliseconds(), map[string]any{
			"message": err.Error(),
		})
		return err
	}

	EventWithDuration(phase, "done", time.Since(start).Milliseconds(), nil)
	return nil
}

type contextHandler struct {
	base      slog.Handler
	runID     int
	datasetID int
}

func (h *contextHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.base.Enabled(ctx, level)
}

func (h *contextHandler) Handle(ctx context.Context, record slog.Record) error {
	if h.runID > 0 {
		record.AddAttrs(slog.Int("run_id", h.runID))
	}
	if h.datasetID > 0 {
		record.AddAttrs(slog.Int("dataset_id", h.datasetID))
	}
	return h.base.Handle(ctx, record)
}

func (h *contextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &contextHandler{
		base:      h.base.WithAttrs(attrs),
		runID:     h.runID,
		datasetID: h.datasetID,
	}
}

func (h *contextHandler) WithGroup(name string) slog.Handler {
	return &contextHandler{
		base:      h.base.WithGroup(name),
		runID:     h.runID,
		datasetID: h.datasetID,
	}
}

func envInt(key string) int {
	value := os.Getenv(key)
	if value == "" {
		return 0
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return parsed
}
