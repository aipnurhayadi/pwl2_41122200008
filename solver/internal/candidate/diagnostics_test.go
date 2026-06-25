package candidate

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"pwl2/solver/internal/model"
)

func TestRotateRoomsOffsetsSubset(t *testing.T) {
	rooms := []model.Room{
		{ID: 1, Capacity: 40, Floor: 1},
		{ID: 2, Capacity: 40, Floor: 1},
		{ID: 3, Capacity: 40, Floor: 2},
		{ID: 4, Capacity: 40, Floor: 2},
		{ID: 5, Capacity: 40, Floor: 3},
	}
	lk := lookupData{roomByID: map[int]model.Room{}}
	for _, room := range rooms {
		lk.roomByID[room.ID] = room
	}

	ctxA := requestContext{index: 0, req: model.TeachingRequest{ClassID: 1}, capacityRequired: 30}
	ctxB := requestContext{index: 1, req: model.TeachingRequest{ClassID: 2}, capacityRequired: 30}

	selectedA := selectCandidateRooms(ctxA, lk, 3)
	selectedB := selectCandidateRooms(ctxB, lk, 3)
	if len(selectedA) != 3 || len(selectedB) != 3 {
		t.Fatalf("expected 3 rooms each, got %d and %d", len(selectedA), len(selectedB))
	}
	if selectedA[0].ID == selectedB[0].ID {
		t.Fatalf("expected rotated room subsets to differ, both start with room %d", selectedA[0].ID)
	}
}

func TestValidateForcedLecturerSlotCoverageDetectsShortfall(t *testing.T) {
	lecturers := []model.LecturerInput{{ID: 8, AllowedCourseIDs: []int{24}}}
	requests := []model.TeachingRequest{
		{CourseID: 24, ClassID: 1},
		{CourseID: 24, ClassID: 2},
	}
	candidates := map[int][]Assignment{
		0: {{
			LecturerID:      8,
			OccupiedSlotIDs: []int{100},
			VariableKey:     "a",
		}},
		1: {{
			LecturerID:      8,
			OccupiedSlotIDs: []int{100},
			VariableKey:     "b",
		}},
	}

	err := ValidateForcedLecturerSlotCoverage(requests, lecturers, candidates)
	if err == nil {
		t.Fatal("expected forced lecturer slot coverage failure")
	}
}

func TestDiagnoseInfeasibilityReportsSingleEligible(t *testing.T) {
	lecturers := []model.LecturerInput{
		{ID: 8, AllowedCourseIDs: []int{24}},
		{ID: 9, AllowedCourseIDs: []int{28}},
	}
	requests := []model.TeachingRequest{
		{CourseID: 24},
		{CourseID: 28},
		{CourseID: 24, ClassID: 2},
	}
	candidates := map[int][]Assignment{
		0: {{LecturerID: 8, RoomID: 1, OccupiedSlotIDs: []int{1}, VariableKey: "a"}},
		1: {{LecturerID: 9, RoomID: 2, OccupiedSlotIDs: []int{2}, VariableKey: "b"}},
		2: {{LecturerID: 8, RoomID: 1, OccupiedSlotIDs: []int{3}, VariableKey: "c"}},
	}

	diag := DiagnoseInfeasibility(requests, lecturers, candidates)
	if diag.SingleEligibleCount != 3 {
		t.Fatalf("expected 3 single-eligible requests, got %d", diag.SingleEligibleCount)
	}
	if len(diag.ForcedSlotCoverage) != 2 {
		t.Fatalf("expected forced coverage for 2 lecturers, got %d", len(diag.ForcedSlotCoverage))
	}
}

func TestRun4FixtureRoomCapVariants(t *testing.T) {
	path := filepath.Join("..", "..", "..", "storage", "app", "timetable-runs", "dataset-1", "run-4_20260625-001316-715483_request.json")
	file, err := os.Open(path)
	if err != nil {
		t.Skipf("run-4 fixture unavailable: %v", err)
	}
	defer file.Close()

	var req model.TimetableSolveRequest
	if err := json.NewDecoder(file).Decode(&req); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}

	weights := map[string]float64{"SFT_001": 1}
	for _, maxRooms := range []int{5, 10, 72} {
		out, stats, err := Build(
			req.Requests,
			req.Rooms,
			req.TimeSlots,
			req.Lecturers,
			weights,
			BuildOptions{
				MaxCandidatesPerRequest: req.Config.MaxCandidatesPerRequest,
				MaxRoomsPerRequest:      maxRooms,
			},
		)
		if err != nil {
			t.Fatalf("max_rooms=%d build failed: %v", maxRooms, err)
		}

		avgRaw := float64(stats.TotalRaw) / float64(len(out))
		coverage := ComputeCoverageStats(out, req.Config.MaxCandidatesPerRequest)
		t.Logf("max_rooms=%d avg_raw=%.0f total_candidates=%d starts_avg=%.1f", maxRooms, avgRaw, stats.TotalPruned, coverage.DistinctStartsAvg)

		if coverage.DistinctStartsAvg <= 7 {
			t.Fatalf("max_rooms=%d expected starts_avg > 7, got %.1f", maxRooms, coverage.DistinctStartsAvg)
		}
		if maxRooms == 5 && avgRaw > 10000 {
			t.Fatalf("max_rooms=5 expected avg raw < 10000, got %.0f", avgRaw)
		}
	}
}
