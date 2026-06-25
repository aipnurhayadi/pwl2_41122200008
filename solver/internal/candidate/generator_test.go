package candidate

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"pwl2/solver/internal/model"
)

func ptr[T any](v T) *T { return &v }

func TestRoomMatchesRequiredType(t *testing.T) {
	teori := "TEORI"
	lab := "LABORATORIUM"
	room := model.Room{ID: 1, RoomType: &teori}

	if !roomMatchesRequiredType(room, nil) {
		t.Fatal("nil required type should match any room")
	}
	if !roomMatchesRequiredType(room, &teori) {
		t.Fatal("matching room type should pass")
	}
	if roomMatchesRequiredType(room, &lab) {
		t.Fatal("mismatched room type should fail")
	}
}

func TestApplyDominancePruningRetainsMultipleSlotPositionsPerDay(t *testing.T) {
	candidates := []Assignment{
		{LecturerID: 1, RoomID: 10, Day: "MON", StartSlotPosition: 0, ObjectiveCost: 0.5, VariableKey: "a"},
		{LecturerID: 1, RoomID: 10, Day: "MON", StartSlotPosition: 5, ObjectiveCost: 0.5, VariableKey: "b"},
		{LecturerID: 1, RoomID: 10, Day: "MON", StartSlotPosition: 10, ObjectiveCost: 0.5, VariableKey: "c"},
		{LecturerID: 1, RoomID: 10, Day: "TUE", StartSlotPosition: 2, ObjectiveCost: 0.1, VariableKey: "d"},
	}

	pruned := applyDominancePruning(candidates, 3)
	if len(pruned) != 4 {
		t.Fatalf("expected 4 candidates after spread dominance pruning, got %d", len(pruned))
	}

	positions := map[int]struct{}{}
	for _, c := range pruned {
		if c.Day == "MON" && c.RoomID == 10 {
			positions[c.StartSlotPosition] = struct{}{}
		}
	}
	if len(positions) != 3 {
		t.Fatalf("expected 3 distinct MON slot positions, got %v", positions)
	}
}

func TestBucketPrunePreservesLecturerDiversity(t *testing.T) {
	candidates := []Assignment{
		{LecturerID: 1, RoomID: 1, Day: "MON", StartTimeSlotID: 100, ObjectiveCost: 0.01, VariableKey: "l1"},
		{LecturerID: 1, RoomID: 2, Day: "MON", StartTimeSlotID: 101, ObjectiveCost: 0.02, VariableKey: "l1b"},
		{LecturerID: 2, RoomID: 1, Day: "MON", StartTimeSlotID: 100, ObjectiveCost: 0.5, VariableKey: "l2"},
		{LecturerID: 2, RoomID: 2, Day: "MON", StartTimeSlotID: 101, ObjectiveCost: 0.6, VariableKey: "l2b"},
	}

	pruned := bucketPruneCandidates(candidates, 2)
	lecturers := map[int]struct{}{}
	for _, c := range pruned {
		lecturers[c.LecturerID] = struct{}{}
	}
	if len(lecturers) < 2 {
		t.Fatalf("bucket pruning should keep both lecturers when maxK=2, got %v", pruned)
	}
}

func TestValidateDailySessionFeasibilityDetectsOverload(t *testing.T) {
	lecturers := []model.LecturerInput{{ID: 1, AllowedCourseIDs: []int{10}}}
	requests := make([]model.TeachingRequest, 0, 12)
	for i := 0; i < 12; i++ {
		requests = append(requests, model.TeachingRequest{CourseID: 10})
	}
	slots := []model.TimeSlot{
		{ID: 1, Day: "MON"},
		{ID: 2, Day: "TUE"},
	}

	err := ValidateDailySessionFeasibility(requests, lecturers, slots, 5)
	if err == nil {
		t.Fatal("expected infeasibility when 12 requests exceed 2 days * limit 5")
	}
}

func TestMinRequiredAssignmentsDetectsSingleOptionBottleneck(t *testing.T) {
	lecturers := []model.LecturerInput{
		{ID: 1, AllowedCourseIDs: []int{10}},
		{ID: 2, AllowedCourseIDs: []int{11}},
	}
	requests := []model.TeachingRequest{
		{CourseID: 10},
		{CourseID: 10},
		{CourseID: 11},
	}
	minReq := MinRequiredAssignmentsPerLecturer(requests, lecturers)
	if minReq[1] != 2 || minReq[2] != 1 {
		t.Fatalf("unexpected min required map: %v", minReq)
	}
}

func TestBuildFiltersRequiredRoomType(t *testing.T) {
	teori := "TEORI"
	lab := "LABORATORIUM"
	rooms := []model.Room{
		{ID: 1, Code: "R1", Capacity: 40, RoomType: &teori},
		{ID: 2, Code: "R2", Capacity: 40, RoomType: &lab},
	}
	slots := []model.TimeSlot{
		{ID: 10, Day: "MON", StartTime: "08:00:00", EndTime: "09:40:00", Code: "MON1"},
	}
	lecturers := []model.LecturerInput{{
		ID:               1,
		AllowedCourseIDs: []int{100},
	}}
	requests := []model.TeachingRequest{{
		ClassID:          1,
		CourseID:         100,
		DurationSlots:    1,
		ExpectedCapacity: ptr(30),
		RequiredRoomType: &lab,
	}}
	weights := map[string]float64{"SFT_001": 1}

	out, stats, err := Build(requests, rooms, slots, lecturers, weights, BuildOptions{MaxCandidatesPerRequest: 100})
	if err != nil {
		t.Fatalf("build failed: %v", err)
	}
	if len(out[0]) != 1 || out[0][0].RoomID != 2 {
		t.Fatalf("expected only lab room candidate, got %+v", out[0])
	}
	if stats.TotalRaw != 1 {
		t.Fatalf("expected 1 raw candidate, got %d", stats.TotalRaw)
	}
}

func TestBuildCapsRoomsPerRequest(t *testing.T) {
	teori := "TEORI"
	rooms := make([]model.Room, 0, 10)
	for i := 1; i <= 10; i++ {
		rooms = append(rooms, model.Room{
			ID:       i,
			Code:     "R",
			Capacity: 40,
			Floor:    i % 3,
			RoomType: &teori,
		})
	}
	slots := []model.TimeSlot{
		{ID: 1, Day: "MON", StartTime: "08:00:00", EndTime: "09:40:00", Code: "MON1"},
	}
	lecturers := []model.LecturerInput{{
		ID:               1,
		AllowedCourseIDs: []int{100},
	}}
	requests := []model.TeachingRequest{{
		ClassID:          1,
		CourseID:         100,
		DurationSlots:    1,
		ExpectedCapacity: ptr(30),
	}}
	weights := map[string]float64{"SFT_001": 1}

	out, stats, err := Build(requests, rooms, slots, lecturers, weights, BuildOptions{
		MaxCandidatesPerRequest: 100,
		MaxRoomsPerRequest:      3,
	})
	if err != nil {
		t.Fatalf("build failed: %v", err)
	}
	if stats.TotalRaw != 3 {
		t.Fatalf("expected raw candidates capped to 3 rooms, got %d", stats.TotalRaw)
	}
	roomIDs := map[int]struct{}{}
	for _, c := range out[0] {
		roomIDs[c.RoomID] = struct{}{}
	}
	if len(roomIDs) > 3 {
		t.Fatalf("expected at most 3 rooms in final candidates, got %d", len(roomIDs))
	}
}

func TestTrimmedCandidatesCoverAllWeekdays(t *testing.T) {
	teori := "TEORI"
	rooms := []model.Room{{ID: 1, Code: "R1", Capacity: 40, Floor: 1, RoomType: &teori}}
	slots := make([]model.TimeSlot, 0, 7)
	days := []string{"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}
	for i, day := range days {
		slots = append(slots, model.TimeSlot{
			ID:        i + 1,
			Code:      day,
			Day:       day,
			StartTime: "08:00:00",
			EndTime:   "09:40:00",
		})
	}
	lecturers := []model.LecturerInput{{
		ID:               1,
		AllowedCourseIDs: []int{100},
	}}
	requests := []model.TeachingRequest{{
		ClassID:          1,
		CourseID:         100,
		DurationSlots:    1,
		ExpectedCapacity: ptr(30),
	}}
	weights := map[string]float64{"SFT_001": 1}

	out, _, err := Build(requests, rooms, slots, lecturers, weights, BuildOptions{
		MaxCandidatesPerRequest: 100,
		MaxRoomsPerRequest:      5,
		DominanceSlotsPerDay:    3,
	})
	if err != nil {
		t.Fatalf("build failed: %v", err)
	}

	daysSeen := map[string]struct{}{}
	for _, c := range out[0] {
		daysSeen[c.Day] = struct{}{}
	}
	if len(daysSeen) != 7 {
		t.Fatalf("expected all 7 weekdays in candidates, got %d days", len(daysSeen))
	}
}

func TestTrimmedCandidatesUseMoreThanMorningSlot(t *testing.T) {
	teori := "TEORI"
	rooms := []model.Room{{ID: 1, Code: "R1", Capacity: 40, Floor: 1, RoomType: &teori}}
	slots := []model.TimeSlot{
		{ID: 1, Day: "MON", StartTime: "07:00:00", EndTime: "07:40:00", Code: "MON1"},
		{ID: 2, Day: "MON", StartTime: "07:40:00", EndTime: "08:20:00", Code: "MON2"},
		{ID: 3, Day: "MON", StartTime: "08:20:00", EndTime: "09:00:00", Code: "MON3"},
		{ID: 4, Day: "MON", StartTime: "13:00:00", EndTime: "13:40:00", Code: "MON4"},
		{ID: 5, Day: "MON", StartTime: "13:40:00", EndTime: "14:20:00", Code: "MON5"},
	}
	lecturers := []model.LecturerInput{{
		ID:               1,
		AllowedCourseIDs: []int{100},
	}}
	requests := []model.TeachingRequest{{
		ClassID:          1,
		CourseID:         100,
		DurationSlots:    1,
		ExpectedCapacity: ptr(30),
	}}
	weights := map[string]float64{"SFT_001": 1}

	out, _, err := Build(requests, rooms, slots, lecturers, weights, BuildOptions{
		MaxCandidatesPerRequest: 100,
		MaxRoomsPerRequest:      5,
		DominanceSlotsPerDay:    3,
	})
	if err != nil {
		t.Fatalf("build failed: %v", err)
	}

	positions := map[int]struct{}{}
	for _, c := range out[0] {
		positions[c.StartSlotPosition] = struct{}{}
	}
	if len(positions) <= 1 {
		t.Fatalf("expected more than one slot position in candidates, got %v", positions)
	}
}

func TestRun4FixtureCandidateCoverage(t *testing.T) {
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
	if req.Config.MaxRoomsPerRequest <= 0 {
		req.Config.MaxRoomsPerRequest = DefaultMaxRoomsPerRequest
	}

	weights := map[string]float64{"SFT_001": 1}
	out, stats, err := Build(
		req.Requests,
		req.Rooms,
		req.TimeSlots,
		req.Lecturers,
		weights,
		BuildOptions{
			MaxCandidatesPerRequest: req.Config.MaxCandidatesPerRequest,
			MaxRoomsPerRequest:      req.Config.MaxRoomsPerRequest,
			DominanceSlotsPerDay:    DefaultDominanceSlotsPerDay,
		},
	)
	if err != nil {
		t.Fatalf("build failed: %v", err)
	}

	coverage := ComputeCoverageStats(out, req.Config.MaxCandidatesPerRequest)
	avgRaw := float64(stats.TotalRaw) / float64(len(out))
	if avgRaw > 10000 {
		t.Fatalf("expected avg raw candidates per request under 10k, got %.0f (total=%d)", avgRaw, stats.TotalRaw)
	}
	if coverage.DistinctStartsAvg <= 7 {
		t.Fatalf("expected avg distinct start slots > 7 after fix, got %.1f", coverage.DistinctStartsAvg)
	}
	if coverage.DistinctPositionsAvg <= 1 {
		t.Fatalf("expected avg distinct slot positions > 1 after fix, got %.1f", coverage.DistinctPositionsAvg)
	}
	if coverage.DistinctDaysMin < 7 {
		t.Fatalf("expected all requests to retain 7 weekdays, min=%d", coverage.DistinctDaysMin)
	}
}

func TestComputeDirectScoresCourseRankPenalty(t *testing.T) {
	lk := lookupData{
		coursePrefs: map[int]map[int]int{
			1: {10: 1, 11: 2, 12: 3, 13: 4, 14: 8},
		},
	}

	cases := []struct {
		courseID int
		want     float64
	}{
		{courseID: 10, want: 0.0},
		{courseID: 11, want: 0.35},
		{courseID: 12, want: 0.7},
		{courseID: 13, want: 1.0},
		{courseID: 14, want: 1.0},
	}

	for _, tc := range cases {
		ctx := requestContext{req: model.TeachingRequest{CourseID: tc.courseID}}
		scores := computeDirectScores(ctx, 1, lk)
		if scores[directSFT001] != tc.want {
			t.Fatalf("course %d rank penalty: got %.2f want %.2f", tc.courseID, scores[directSFT001], tc.want)
		}
	}

	unknown := requestContext{req: model.TeachingRequest{CourseID: 99}}
	if got := computeDirectScores(unknown, 1, lk)[directSFT001]; got != 1.0 {
		t.Fatalf("missing preference should default to 1.0, got %.2f", got)
	}
}
