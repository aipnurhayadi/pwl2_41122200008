// Package timetable mengorkestrasi alur lengkap: validasi input → generate kandidat → ILP.
package timetable

import (
	"fmt"
	"strings"

	"pwl2/solver/internal/candidate"
	"pwl2/solver/internal/ilp"
	"pwl2/solver/internal/model"
	"pwl2/solver/internal/runlog"
)

// Solve menjalankan pipeline penjadwalan untuk satu dataset.
func Solve(req model.TimetableSolveRequest) (*model.TimetableSolveResponse, error) {
	if len(req.Requests) == 0 {
		return nil, fmt.Errorf("teaching_requests is empty")
	}
	if len(req.Rooms) == 0 {
		return nil, fmt.Errorf("rooms is required and must not be empty")
	}
	if len(req.TimeSlots) == 0 {
		return nil, fmt.Errorf("time_slots is required and must not be empty")
	}

	cfg := req.Config
	if cfg.MaxCandidatesPerRequest <= 0 {
		cfg.MaxCandidatesPerRequest = candidate.DefaultMaxCandidatesPerRequest
	}
	if cfg.MaxRoomsPerRequest <= 0 {
		cfg.MaxRoomsPerRequest = candidate.DefaultMaxRoomsPerRequest
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

	var weights map[string]float64
	if err := runlog.Phase("NORMALIZE_WEIGHTS", func() error {
		weights = normalizeWeights(req.Weights)
		return nil
	}); err != nil {
		return nil, err
	}

	var candidates map[int][]candidate.Assignment
	if err := runlog.Phase("BUILD_CANDIDATES", func() error {
		if presolveErr := candidate.ValidateDailySessionFeasibility(
			req.Requests,
			req.Lecturers,
			req.TimeSlots,
			cfg.DailySessionLimit,
		); presolveErr != nil {
			return presolveErr
		}

		lecturerLoads := candidate.LecturerEligibleRequestCounts(req.Requests, req.Lecturers)
		minRequired := candidate.MinRequiredAssignmentsPerLecturer(req.Requests, req.Lecturers)
		runlog.Event("BUILD_CANDIDATES", "presolve", map[string]any{
			"daily_session_limit":      cfg.DailySessionLimit,
			"teaching_days":            countDistinctDaysFromSlots(req.TimeSlots),
			"lecturer_eligible_counts": lecturerLoads,
			"lecturer_min_required":    minRequired,
		})

		var buildStats candidate.BuildStats
		var buildErr error
		buildOpts := candidate.BuildOptions{
			MaxCandidatesPerRequest: cfg.MaxCandidatesPerRequest,
			MaxRoomsPerRequest:      cfg.MaxRoomsPerRequest,
			DominanceSlotsPerDay:    candidate.DefaultDominanceSlotsPerDay,
		}
		candidates, buildStats, buildErr = candidate.Build(
			req.Requests,
			req.Rooms,
			req.TimeSlots,
			req.Lecturers,
			weights,
			buildOpts,
		)
		if buildErr != nil {
			return buildErr
		}

		totalCandidates := 0
		for _, list := range candidates {
			totalCandidates += len(list)
		}
		coverage := candidate.ComputeCoverageStats(candidates, cfg.MaxCandidatesPerRequest)
		if slotErr := candidate.ValidateForcedLecturerSlotCoverage(req.Requests, req.Lecturers, candidates); slotErr != nil {
			return slotErr
		}
		runlog.Event("BUILD_CANDIDATES", "metrics", map[string]any{
			"requests":                len(req.Requests),
			"total_candidates":        totalCandidates,
			"total_raw":               buildStats.TotalRaw,
			"total_after_dominance":   buildStats.TotalAfterDominance,
			"eligible_lecturer_hist":  buildStats.EligibleLecturerHist,
			"max_candidates_per_req":  cfg.MaxCandidatesPerRequest,
			"max_rooms_per_req":       cfg.MaxRoomsPerRequest,
			"requests_at_cap":         coverage.RequestsAtCap,
			"distinct_days_per_req": map[string]any{
				"min": coverage.DistinctDaysMin,
				"avg": coverage.DistinctDaysAvg,
				"max": coverage.DistinctDaysMax,
			},
			"distinct_start_slots_per_req": map[string]any{
				"min": coverage.DistinctStartsMin,
				"avg": coverage.DistinctStartsAvg,
				"max": coverage.DistinctStartsMax,
			},
			"distinct_slot_positions_per_req": map[string]any{
				"min": coverage.DistinctPositionsMin,
				"avg": coverage.DistinctPositionsAvg,
				"max": coverage.DistinctPositionsMax,
			},
		})
		return nil
	}); err != nil {
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

	var result *ilp.SolveResult
	if err := runlog.Phase("ILP_SOLVE", func() error {
		var solveErr error
		result, solveErr = ilp.Solve(
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
		return solveErr
	}); err != nil {
		if candidates != nil && isInfeasibleError(err) {
			diag := candidate.DiagnoseInfeasibility(req.Requests, req.Lecturers, candidates)
			runlog.Event("ILP_SOLVE", "infeasibility_diagnostics", map[string]any{
				"single_eligible_requests":    diag.SingleEligibleCount,
				"shared_room_ids_top5":        diag.SharedRoomIDsTop5,
				"requests_per_shared_room":    diag.RequestsPerSharedRoom,
				"forced_lecturer_slot_coverage": diag.ForcedSlotCoverage,
			})
		}
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
	codes := []string{"SFT_001", "SFT_002", "SFT_003", "SFT_004", "SFT_005"}
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

func countDistinctDaysFromSlots(slots []model.TimeSlot) int {
	days := map[string]struct{}{}
	for _, s := range slots {
		if s.Day != "" {
			days[s.Day] = struct{}{}
		}
	}
	return len(days)
}

func isInfeasibleError(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "Infeasible")
}
