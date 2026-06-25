package candidate

import (
	"fmt"
	"math"
	"sort"

	"pwl2/solver/internal/model"
)

// ValidateDailySessionFeasibility memeriksa apakah beban mengajar per dosen
// secara prinsip dapat dipenuhi dengan daily_session_limit dan jumlah hari tersedia.
func ValidateDailySessionFeasibility(
	requests []model.TeachingRequest,
	lecturers []model.LecturerInput,
	slots []model.TimeSlot,
	dailyLimit int,
) error {
	if dailyLimit <= 0 {
		return nil
	}

	availableDays := countDistinctDays(slots)
	if availableDays == 0 {
		return fmt.Errorf("no teaching days available in time_slots")
	}

	allowedCourses := map[int]map[int]struct{}{}
	for _, l := range lecturers {
		set := map[int]struct{}{}
		for _, cid := range l.AllowedCourseIDs {
			set[cid] = struct{}{}
		}
		allowedCourses[l.ID] = set
	}

	loadPerLecturer := map[int]int{}
	minRequiredPerLecturer := map[int]int{}
	for _, req := range requests {
		eligible := eligibleLecturersForRequest(req, lecturers, allowedCourses)
		for _, lid := range eligible {
			loadPerLecturer[lid]++
		}
		if len(eligible) == 1 {
			minRequiredPerLecturer[eligible[0]]++
		}
	}

	maxCapacity := availableDays * dailyLimit
	for lecturerID, minRequired := range minRequiredPerLecturer {
		if minRequired > maxCapacity {
			return fmt.Errorf(
				"lecturer %d is the only eligible teacher for %d requests but daily_session_limit=%d allows at most %d sessions across %d day(s)",
				lecturerID, minRequired, dailyLimit, maxCapacity, availableDays,
			)
		}
	}

	for lecturerID, load := range loadPerLecturer {
		if load == 0 {
			continue
		}
		if load > maxCapacity {
			return fmt.Errorf(
				"lecturer %d has %d eligible requests but daily_session_limit=%d allows at most %d sessions across %d day(s)",
				lecturerID, load, dailyLimit, maxCapacity, availableDays,
			)
		}
		minDays := int(math.Ceil(float64(load) / float64(dailyLimit)))
		if minDays > availableDays {
			return fmt.Errorf(
				"lecturer %d needs at least %d distinct day(s) for %d requests with daily_session_limit=%d but only %d day(s) available",
				lecturerID, minDays, load, dailyLimit, availableDays,
			)
		}
	}

	return nil
}

func countDistinctDays(slots []model.TimeSlot) int {
	days := map[string]struct{}{}
	for _, s := range slots {
		if s.Day != "" {
			days[s.Day] = struct{}{}
		}
	}
	return len(days)
}

func eligibleLecturersForRequest(
	req model.TeachingRequest,
	lecturers []model.LecturerInput,
	allowedCourses map[int]map[int]struct{},
) []int {
	if req.LecturerID != nil {
		lid := *req.LecturerID
		if _, ok := allowedCourses[lid][req.CourseID]; ok {
			return []int{lid}
		}
		return nil
	}
	var eligible []int
	for _, l := range lecturers {
		if _, ok := allowedCourses[l.ID][req.CourseID]; ok {
			eligible = append(eligible, l.ID)
		}
	}
	sort.Ints(eligible)
	return eligible
}

// MinRequiredAssignmentsPerLecturer menghitung request yang hanya bisa diajar satu dosen tertentu.
func MinRequiredAssignmentsPerLecturer(
	requests []model.TeachingRequest,
	lecturers []model.LecturerInput,
) map[int]int {
	allowedCourses := map[int]map[int]struct{}{}
	for _, l := range lecturers {
		set := map[int]struct{}{}
		for _, cid := range l.AllowedCourseIDs {
			set[cid] = struct{}{}
		}
		allowedCourses[l.ID] = set
	}

	minRequired := map[int]int{}
	for _, req := range requests {
		eligible := eligibleLecturersForRequest(req, lecturers, allowedCourses)
		if len(eligible) == 1 {
			minRequired[eligible[0]]++
		}
	}
	return minRequired
}

// LecturerEligibleRequestCounts mengembalikan jumlah request yang bisa diampu tiap dosen.
func LecturerEligibleRequestCounts(
	requests []model.TeachingRequest,
	lecturers []model.LecturerInput,
) map[int]int {
	allowedCourses := map[int]map[int]struct{}{}
	for _, l := range lecturers {
		set := map[int]struct{}{}
		for _, cid := range l.AllowedCourseIDs {
			set[cid] = struct{}{}
		}
		allowedCourses[l.ID] = set
	}

	load := map[int]int{}
	for _, req := range requests {
		if req.LecturerID != nil {
			load[*req.LecturerID]++
			continue
		}
		for _, l := range lecturers {
			if _, ok := allowedCourses[l.ID][req.CourseID]; ok {
				load[l.ID]++
			}
		}
	}
	return load
}

// EligibleLecturerHistogram menghitung distribusi jumlah dosen eligible per request.
func EligibleLecturerHistogram(contexts []requestContext) map[int]int {
	hist := map[int]int{}
	for _, ctx := range contexts {
		hist[len(ctx.eligibleLecturer)]++
	}
	return hist
}
