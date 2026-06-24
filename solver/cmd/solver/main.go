// Command solver adalah CLI untuk penjadwalan ILP.
//
// Usage:
//
//	solver timetable [input.json]   # stdin jika file tidak diberikan
//
// Contoh:
//
//	go run ./cmd/solver timetable examples/timetable_minimal.json
//	Get-Content payload.json | go run ./cmd/solver timetable
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"pwl2/solver/internal/model"
	"pwl2/solver/internal/runlog"
	"pwl2/solver/internal/timetable"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "timetable":
		runTimetable()
	case "help", "-h", "--help":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}

func runTimetable() {
	if _, err := runlog.InitFromEnv(); err != nil {
		fmt.Fprintf(os.Stderr, "timetable: init logger: %v\n", err)
		os.Exit(1)
	}

	input, closer, err := openInput()
	if err != nil {
		fmt.Fprintf(os.Stderr, "timetable: %v\n", err)
		os.Exit(1)
	}
	if closer != nil {
		defer closer.Close()
	}

	var req model.TimetableSolveRequest
	if err := json.NewDecoder(input).Decode(&req); err != nil {
		fmt.Fprintf(os.Stderr, "timetable: decode input: %v\n", err)
		os.Exit(1)
	}

	runlog.SetDefault(runlog.WithDatasetID(req.DatasetID))
	runlog.Event("RUN_STARTED", "start", map[string]any{
		"requests":   len(req.Requests),
		"rooms":      len(req.Rooms),
		"time_slots": len(req.TimeSlots),
		"lecturers":  len(req.Lecturers),
	})
	runlog.Event("INPUT_DECODED", "done", map[string]any{
		"dataset_id": req.DatasetID,
	})

	resp, err := timetable.Solve(req)
	if err != nil {
		runlog.Event("RUN_FAILED", "error", map[string]any{"message": err.Error()})
		fmt.Fprintf(os.Stderr, "timetable: %v\n", err)
		os.Exit(1)
	}
	if resp.Status == "FAILED" {
		runlog.Event("RUN_FAILED", "error", map[string]any{"message": resp.Error})
		fmt.Fprintf(os.Stderr, "timetable: %s\n", resp.Error)
		os.Exit(1)
	}

	runlog.Event("RUN_FINISHED", "done", map[string]any{
		"status":          resp.Status,
		"solver_status":   resp.SolverStatus,
		"objective_value": resp.ObjectiveValue,
		"assignments":     len(resp.Assignments),
	})

	if err := writeJSON(os.Stdout, resp); err != nil {
		fmt.Fprintf(os.Stderr, "timetable: encode output: %v\n", err)
		os.Exit(1)
	}
}

// openInput membaca dari argumen file (os.Args[2]) atau stdin.
func openInput() (io.Reader, io.Closer, error) {
	if len(os.Args) >= 3 {
		file, err := os.Open(os.Args[2])
		if err != nil {
			return nil, nil, fmt.Errorf("open input file: %w", err)
		}
		return file, file, nil
	}
	return os.Stdin, nil, nil
}

func writeJSON(w io.Writer, payload any) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(payload)
}

func printUsage() {
	fmt.Fprintf(os.Stderr, `PWL2 Timetable Solver (CLI)

Bobot soft constraint (BWM) dibaca dari database via Laravel, bukan dihitung di sini.

Usage:
  solver timetable [input.json]

Jika input.json tidak diberikan, JSON dibaca dari stdin.

Examples:
  go run ./cmd/solver timetable examples/timetable_minimal.json
  Get-Content payload.json | go run ./cmd/solver timetable

go build -o solver.exe ./cmd/solver
.\solver.exe bwm examples\bwm.json

Output: JSON ke stdout
Errors: pesan ke stderr, exit code 1
`)
}
