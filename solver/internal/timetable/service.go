// Package timetable mengorkestrasi alur lengkap: validasi input → generate kandidat → ILP.
package timetable

import (
	"fmt"

	"pwl2/solver/internal/candidate"
	"pwl2/solver/internal/ilp"
	"pwl2/solver/internal/model"
)

// Solve menjalankan pipeline penjadwalan untuk satu dataset.
func Solve(req model.TimetableSolveRequest) (*model.TimetableSolveResponse, error) {
	if len(req.Requests) == 0 {
		return nil, fmt.Errorf("teaching_requests is empty")
	}
	if len(req.Rooms) == 0 || len(req.TimeSlots) == 0 {
		return nil, fmt.Errorf("rooms and time_slots are required")
	}

	cfg := req.Config
	if cfg.MaxCandidatesPerRequest <= 0 {
		cfg.MaxCandidatesPerRequest = 40
	}
	if cfg.DailySessionLimit <= 0 {
		cfg.DailySessionLimit = 2
	}
	if cfg.TransitionNeighborLimit <= 0 {
		cfg.TransitionNeighborLimit = 8
	}
	if cfg.SolverTimeLimitSeconds <= 0 {
		cfg.SolverTimeLimitSeconds = 45
	}
	if cfg.SolverRelativeGap <= 0 {
		cfg.SolverRelativeGap = 0.03
	}
	if cfg.SolverThreads <= 0 {
		cfg.SolverThreads = 2
	}

	weights := normalizeWeights(req.Weights)

	candidates, err := candidate.Build(
		req.Requests,
		req.Rooms,
		req.TimeSlots,
		req.Lecturers,
		weights,
		cfg.MaxCandidatesPerRequest,
	)
	if err != nil {
		return &model.TimetableSolveResponse{Status: "FAILED", Error: err.Error()}, nil
	}

	roomMap := map[int]model.Room{}
	for _, r := range req.Rooms {
		roomMap[r.ID] = r
	}
	courseByRequest := map[int]int{}
	for i, tr := range req.Requests {
		courseByRequest[i] = tr.CourseID
	}

	result, err := ilp.Solve(
		len(req.Requests),
		courseByRequest,
		candidates,
		roomMap,
		weights,
		ilp.SolveOptions{
			DailySessionLimit:       cfg.DailySessionLimit,
			TransitionNeighborLimit: cfg.TransitionNeighborLimit,
			TimeLimitSeconds:        cfg.SolverTimeLimitSeconds,
			RelativeGap:             cfg.SolverRelativeGap,
			Threads:                 cfg.SolverThreads,
		},
	)
	if err != nil {
		return &model.TimetableSolveResponse{
			Status:       "FAILED",
			SolverStatus: "Error",
			Error:        err.Error(),
		}, nil
	}

	assignments := make([]model.AssignmentResult, 0, len(result.Selected))
	for _, c := range result.Selected {
		assignments = append(assignments, model.AssignmentResult{
			RequestIndex:    c.RequestIndex,
			LecturerID:      c.LecturerID,
			CourseID:        c.CourseID,
			ClassID:         c.ClassID,
			RoomID:          c.RoomID,
			StartTimeSlotID: c.StartTimeSlotID,
			EndTimeSlotID:   c.EndTimeSlotID,
			ObjectiveCost:   c.ObjectiveCost,
			DirectPenalties: c.DirectPenalties,
		})
	}

	return &model.TimetableSolveResponse{
		Status:         "COMPLETED",
		SolverStatus:   result.SolverStatus,
		ObjectiveValue: result.ObjectiveValue,
		Assignments:    assignments,
	}, nil
}

func normalizeWeights(raw map[string]float64) map[string]float64 {
	codes := []string{"SFT_001", "SFT_002", "SFT_003", "SFT_004", "SFT_005", "SFT_006", "SFT_007", "SFT_008"}
	out := map[string]float64{}
	total := 0.0
	for _, code := range codes {
		w := raw[code]
		if w < 0 {
			w = 0
		}
		out[code] = w
		total += w
	}
	if total <= 0 {
		equal := 1.0 / float64(len(codes))
		for _, code := range codes {
			out[code] = equal
		}
		return out
	}
	for _, code := range codes {
		out[code] /= total
	}
	return out
}
