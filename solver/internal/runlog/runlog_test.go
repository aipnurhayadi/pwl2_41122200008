package runlog_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"pwl2/solver/internal/runlog"
)

func TestInitFromEnvFallbackStderrOnly(t *testing.T) {
	t.Setenv("PWL2_RUN_ID", "")
	t.Setenv("PWL2_DATASET_ID", "")
	t.Setenv("PWL2_LOG_FILE", "")

	logger, err := runlog.InitFromEnv()
	if err != nil {
		t.Fatalf("InitFromEnv() error = %v", err)
	}
	if logger == nil {
		t.Fatal("expected logger")
	}
}

func TestPhaseLogsDoneWithDuration(t *testing.T) {
	var buf bytes.Buffer
	runlog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))

	err := runlog.Phase("TEST_PHASE", func() error {
		time.Sleep(2 * time.Millisecond)
		return nil
	})
	if err != nil {
		t.Fatalf("Phase() error = %v", err)
	}

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) < 2 {
		t.Fatalf("expected at least 2 log lines, got %q", buf.String())
	}

	last := map[string]any{}
	if err := json.Unmarshal([]byte(lines[len(lines)-1]), &last); err != nil {
		t.Fatalf("decode log: %v", err)
	}
	if last["phase"] != "TEST_PHASE" || last["event"] != "done" {
		t.Fatalf("unexpected last log: %#v", last)
	}
	if _, ok := last["duration_ms"]; !ok {
		t.Fatalf("expected duration_ms in log: %#v", last)
	}
}

func TestInitFromEnvWritesLogFile(t *testing.T) {
	dir := t.TempDir()
	logFile := dir + string(os.PathSeparator) + "run-1.log"

	t.Setenv("PWL2_RUN_ID", "7")
	t.Setenv("PWL2_DATASET_ID", "3")
	t.Setenv("PWL2_LOG_FILE", logFile)

	if _, err := runlog.InitFromEnv(); err != nil {
		t.Fatalf("InitFromEnv() error = %v", err)
	}

	runlog.Event("RUN_STARTED", "start", map[string]any{"requests": 2})

	content, err := os.ReadFile(logFile)
	if err != nil {
		t.Fatalf("read log file: %v", err)
	}
	if !strings.Contains(string(content), `"run_id":7`) {
		t.Fatalf("expected run_id in log file, got %q", content)
	}
	if !strings.Contains(string(content), `"dataset_id":3`) {
		t.Fatalf("expected dataset_id in log file, got %q", content)
	}
}

func TestPhaseLogsError(t *testing.T) {
	var buf bytes.Buffer
	runlog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))

	err := runlog.Phase("FAIL_PHASE", func() error {
		return context.Canceled
	})
	if err == nil {
		t.Fatal("expected error")
	}

	if !strings.Contains(buf.String(), `"event":"error"`) {
		t.Fatalf("expected error event in log, got %q", buf.String())
	}
	if !strings.Contains(buf.String(), `"duration_ms"`) {
		t.Fatalf("expected duration_ms in error log, got %q", buf.String())
	}
}
