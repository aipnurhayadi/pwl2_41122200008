package candidate

import (
	"fmt"
	"sort"

	"pwl2/solver/internal/model"
)

// ForcedSlotCoverage reports whether forced-single lecturers have enough distinct slots.
type ForcedSlotCoverage struct {
	LecturerID        int
	RequiredRequests  int
	DistinctSlotCount int
	SlotSufficient    bool
}

// ValidateForcedLecturerSlotCoverage memastikan request monopoli punya cukup slot
// berbeda di union kandidat untuk dosen wajib.
func ValidateForcedLecturerSlotCoverage(
	requests []model.TeachingRequest,
	lecturers []model.LecturerInput,
	candidates map[int][]Assignment,
) error {
	coverage := AnalyzeForcedLecturerSlotCoverage(requests, lecturers, candidates)
	for _, item := range coverage {
		if !item.SlotSufficient {
			return fmt.Errorf(
				"lecturer %d is the only eligible teacher for %d requests but candidate pool exposes only %d distinct occupied slot(s)",
				item.LecturerID, item.RequiredRequests, item.DistinctSlotCount,
			)
		}
	}
	return nil
}

// AnalyzeForcedLecturerSlotCoverage menghitung slot unik per dosen monopoli.
func AnalyzeForcedLecturerSlotCoverage(
	requests []model.TeachingRequest,
	lecturers []model.LecturerInput,
	candidates map[int][]Assignment,
) []ForcedSlotCoverage {
	allowedCourses := map[int]map[int]struct{}{}
	for _, l := range lecturers {
		set := map[int]struct{}{}
		for _, cid := range l.AllowedCourseIDs {
			set[cid] = struct{}{}
		}
		allowedCourses[l.ID] = set
	}

	forcedByLecturer := map[int][]int{}
	for i, req := range requests {
		eligible := eligibleLecturersForRequest(req, lecturers, allowedCourses)
		if len(eligible) == 1 {
			forcedByLecturer[eligible[0]] = append(forcedByLecturer[eligible[0]], i)
		}
	}

	out := make([]ForcedSlotCoverage, 0, len(forcedByLecturer))
	for lecturerID, requestIndexes := range forcedByLecturer {
		slots := map[int]struct{}{}
		for _, reqIdx := range requestIndexes {
			for _, c := range candidates[reqIdx] {
				if c.LecturerID != lecturerID {
					continue
				}
				for _, slotID := range c.OccupiedSlotIDs {
					slots[slotID] = struct{}{}
				}
			}
		}
		required := len(requestIndexes)
		distinct := len(slots)
		out = append(out, ForcedSlotCoverage{
			LecturerID:        lecturerID,
			RequiredRequests:  required,
			DistinctSlotCount: distinct,
			SlotSufficient:    distinct >= required,
		})
	}

	sort.Slice(out, func(i, j int) bool { return out[i].LecturerID < out[j].LecturerID })
	return out
}

// InfeasibilityDiagnostics ringkasan untuk logging saat CBC Infeasible.
type InfeasibilityDiagnostics struct {
	ForcedSlotCoverage    []ForcedSlotCoverage
	SingleEligibleCount   int
	SharedRoomIDsTop5     []int
	RequestsPerSharedRoom map[int]int
}

// DiagnoseInfeasibility menghasilkan metrik konflik dari kandidat final.
func DiagnoseInfeasibility(
	requests []model.TeachingRequest,
	lecturers []model.LecturerInput,
	candidates map[int][]Assignment,
) InfeasibilityDiagnostics {
	allowedCourses := map[int]map[int]struct{}{}
	for _, l := range lecturers {
		set := map[int]struct{}{}
		for _, cid := range l.AllowedCourseIDs {
			set[cid] = struct{}{}
		}
		allowedCourses[l.ID] = set
	}

	singleEligible := 0
	for _, req := range requests {
		if len(eligibleLecturersForRequest(req, lecturers, allowedCourses)) == 1 {
			singleEligible++
		}
	}

	roomUsage := map[int]int{}
	for _, list := range candidates {
		rooms := map[int]struct{}{}
		for _, c := range list {
			rooms[c.RoomID] = struct{}{}
		}
		for roomID := range rooms {
			roomUsage[roomID]++
		}
	}

	type roomCount struct {
		roomID int
		count  int
	}
	ranked := make([]roomCount, 0, len(roomUsage))
	for roomID, count := range roomUsage {
		ranked = append(ranked, roomCount{roomID: roomID, count: count})
	}
	sort.Slice(ranked, func(i, j int) bool {
		if ranked[i].count != ranked[j].count {
			return ranked[i].count > ranked[j].count
		}
		return ranked[i].roomID < ranked[j].roomID
	})

	topRooms := make([]int, 0, 5)
	topUsage := map[int]int{}
	for i := 0; i < len(ranked) && i < 5; i++ {
		topRooms = append(topRooms, ranked[i].roomID)
		topUsage[ranked[i].roomID] = ranked[i].count
	}

	return InfeasibilityDiagnostics{
		ForcedSlotCoverage:    AnalyzeForcedLecturerSlotCoverage(requests, lecturers, candidates),
		SingleEligibleCount:   singleEligible,
		SharedRoomIDsTop5:     topRooms,
		RequestsPerSharedRoom: topUsage,
	}
}
