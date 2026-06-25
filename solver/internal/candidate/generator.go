// Package candidate menghasilkan kombinasi (dosen, ruang, blok waktu) yang feasible
// sebelum ILP dijalankan. Hard constraint LOKAL (HRD_003, required_room_type) difilter di sini;
// hard constraint GLOBAL (HRD_001, HRD_002) ditangani di ILP.
package candidate

import (
	"fmt"
	"math"
	"sort"

	"pwl2/solver/internal/model"
)

const directSFT001 = "SFT_001"

const (
	DefaultMaxCandidatesPerRequest = 40
	DefaultMaxRoomsPerRequest      = 5
	DefaultDominanceSlotsPerDay    = 3
)

var dayOrder = map[string]int{
	"MON": 0,
	"TUE": 1,
	"WED": 2,
	"THU": 3,
	"FRI": 4,
	"SAT": 5,
	"SUN": 6,
}

// BuildOptions konfigurasi pembuatan kandidat per request.
type BuildOptions struct {
	MaxCandidatesPerRequest int
	MaxRoomsPerRequest      int
	DominanceSlotsPerDay    int
}

// CoverageStats metrik cakupan hari/slot pada kandidat final per request.
type CoverageStats struct {
	DistinctDaysMin      int
	DistinctDaysMax      int
	DistinctDaysAvg      float64
	DistinctStartsMin    int
	DistinctStartsMax    int
	DistinctStartsAvg    float64
	DistinctPositionsMin int
	DistinctPositionsMax int
	DistinctPositionsAvg float64
	RequestsAtCap        int
}

// Assignment adalah satu kandidat penempatan jadwal.
type Assignment struct {
	VariableKey       string
	RequestIndex      int
	LecturerID        int
	RoomID            int
	StartTimeSlotID   int
	EndTimeSlotID     int
	StartSlotPosition int
	EndSlotPosition   int
	OccupiedSlotIDs   []int
	Day               string
	CourseID          int
	ClassID           int
	DirectPenalties   map[string]float64
	ObjectiveCost     float64
}

// BuildStats ringkasan metrik pembuatan kandidat untuk logging diagnostik.
type BuildStats struct {
	TotalRaw            int
	TotalAfterDominance int
	TotalPruned         int
	EligibleLecturerHist map[int]int
}

type requestContext struct {
	index            int
	req              model.TeachingRequest
	eligibleLecturer []int
	capacityRequired int
}

type lookupData struct {
	roomByID         map[int]model.Room
	slotByID         map[int]model.TimeSlot
	daySlots         map[string][]model.TimeSlot
	slotPositionByID map[int]int
	coursePrefs      map[int]map[int]int
}

type dominanceKey struct {
	lecturerID int
	roomID     int
	day        string
}

// Build menghasilkan kandidat per teaching request.
func Build(
	requests []model.TeachingRequest,
	rooms []model.Room,
	slots []model.TimeSlot,
	lecturers []model.LecturerInput,
	weights map[string]float64,
	opts BuildOptions,
) (map[int][]Assignment, BuildStats, error) {
	stats := BuildStats{EligibleLecturerHist: map[int]int{}}
	opts = normalizeBuildOptions(opts)

	lk := buildLookups(rooms, slots, lecturers)
	contexts, err := buildRequestContexts(requests, lecturers)
	if err != nil {
		return nil, stats, err
	}
	stats.EligibleLecturerHist = EligibleLecturerHistogram(contexts)

	out := map[int][]Assignment{}
	for _, ctx := range contexts {
		raw := generateForRequest(ctx, lk, weights, opts.MaxRoomsPerRequest)
		stats.TotalRaw += len(raw)
		if len(raw) == 0 {
			return nil, stats, fmt.Errorf("no feasible candidate for request #%d", ctx.index+1)
		}

		dominated := applyDominancePruning(raw, opts.DominanceSlotsPerDay)
		stats.TotalAfterDominance += len(dominated)

		candidates := dominated
		if len(candidates) > opts.MaxCandidatesPerRequest {
			candidates = bucketPruneCandidates(candidates, opts.MaxCandidatesPerRequest)
		}
		stats.TotalPruned += len(candidates)
		out[ctx.index] = candidates
	}
	return out, stats, nil
}

func normalizeBuildOptions(opts BuildOptions) BuildOptions {
	if opts.MaxCandidatesPerRequest <= 0 {
		opts.MaxCandidatesPerRequest = DefaultMaxCandidatesPerRequest
	}
	if opts.MaxRoomsPerRequest <= 0 {
		opts.MaxRoomsPerRequest = DefaultMaxRoomsPerRequest
	}
	if opts.DominanceSlotsPerDay <= 0 {
		opts.DominanceSlotsPerDay = DefaultDominanceSlotsPerDay
	}
	return opts
}

// ComputeCoverageStats menghitung cakupan hari/slot kandidat final per request.
func ComputeCoverageStats(candidates map[int][]Assignment, maxCap int) CoverageStats {
	if len(candidates) == 0 {
		return CoverageStats{}
	}

	stats := CoverageStats{
		DistinctDaysMin:      -1,
		DistinctStartsMin:    -1,
		DistinctPositionsMin: -1,
	}
	totalDays := 0
	totalStarts := 0
	totalPositions := 0

	for _, list := range candidates {
		if len(list) >= maxCap {
			stats.RequestsAtCap++
		}

		days := map[string]struct{}{}
		starts := map[int]struct{}{}
		positions := map[int]struct{}{}
		for _, c := range list {
			days[c.Day] = struct{}{}
			starts[c.StartTimeSlotID] = struct{}{}
			positions[c.StartSlotPosition] = struct{}{}
		}

		dayCount := len(days)
		startCount := len(starts)
		positionCount := len(positions)
		totalDays += dayCount
		totalStarts += startCount
		totalPositions += positionCount

		stats.DistinctDaysMin = minIntOr(stats.DistinctDaysMin, dayCount)
		stats.DistinctDaysMax = maxInt(stats.DistinctDaysMax, dayCount)
		stats.DistinctStartsMin = minIntOr(stats.DistinctStartsMin, startCount)
		stats.DistinctStartsMax = maxInt(stats.DistinctStartsMax, startCount)
		stats.DistinctPositionsMin = minIntOr(stats.DistinctPositionsMin, positionCount)
		stats.DistinctPositionsMax = maxInt(stats.DistinctPositionsMax, positionCount)
	}

	n := float64(len(candidates))
	stats.DistinctDaysAvg = float64(totalDays) / n
	stats.DistinctStartsAvg = float64(totalStarts) / n
	stats.DistinctPositionsAvg = float64(totalPositions) / n
	return stats
}

func buildRequestContexts(requests []model.TeachingRequest, lecturers []model.LecturerInput) ([]requestContext, error) {
	allowedCourses := map[int]map[int]struct{}{}
	lecturerIDs := map[int]struct{}{}
	for _, l := range lecturers {
		lecturerIDs[l.ID] = struct{}{}
		set := map[int]struct{}{}
		for _, cid := range l.AllowedCourseIDs {
			set[cid] = struct{}{}
		}
		allowedCourses[l.ID] = set
	}

	out := make([]requestContext, 0, len(requests))
	for i, req := range requests {
		var eligible []int
		if req.LecturerID != nil {
			lid := *req.LecturerID
			if _, ok := lecturerIDs[lid]; !ok {
				return nil, fmt.Errorf("lecturer_id %d not found for request #%d", lid, i+1)
			}
			if _, ok := allowedCourses[lid][req.CourseID]; !ok {
				return nil, fmt.Errorf("lecturer %d cannot teach course %d (request #%d)", lid, req.CourseID, i+1)
			}
			eligible = []int{lid}
		} else {
			for _, l := range lecturers {
				if _, ok := allowedCourses[l.ID][req.CourseID]; ok {
					eligible = append(eligible, l.ID)
				}
			}
			sort.Ints(eligible)
		}
		if len(eligible) == 0 {
			return nil, fmt.Errorf("no eligible lecturer for course %d (request #%d)", req.CourseID, i+1)
		}

		capacity := 0
		if req.ExpectedCapacity != nil {
			capacity = *req.ExpectedCapacity
		} else if req.ClassCapacity != nil {
			capacity = *req.ClassCapacity
		}

		duration := req.DurationSlots
		if duration <= 0 {
			duration = 1
		}
		req.DurationSlots = duration

		out = append(out, requestContext{
			index:            i,
			req:              req,
			eligibleLecturer: eligible,
			capacityRequired: capacity,
		})
	}
	return out, nil
}

func buildLookups(rooms []model.Room, slots []model.TimeSlot, lecturers []model.LecturerInput) lookupData {
	lk := lookupData{
		roomByID:         map[int]model.Room{},
		slotByID:         map[int]model.TimeSlot{},
		daySlots:         map[string][]model.TimeSlot{},
		slotPositionByID: map[int]int{},
		coursePrefs:      map[int]map[int]int{},
	}
	for _, r := range rooms {
		lk.roomByID[r.ID] = r
	}
	for _, s := range slots {
		lk.slotByID[s.ID] = s
		lk.daySlots[s.Day] = append(lk.daySlots[s.Day], s)
	}
	for day, dayList := range lk.daySlots {
		sort.Slice(dayList, func(i, j int) bool {
			a, b := dayList[i], dayList[j]
			if a.StartTime != b.StartTime {
				return a.StartTime < b.StartTime
			}
			if a.EndTime != b.EndTime {
				return a.EndTime < b.EndTime
			}
			return a.Code < b.Code
		})
		lk.daySlots[day] = dayList
		for idx, slot := range dayList {
			lk.slotPositionByID[slot.ID] = idx
		}
	}
	for _, l := range lecturers {
		cp := map[int]int{}
		for _, p := range l.CoursePreferences {
			cp[p.CourseID] = p.RankOrder
		}
		lk.coursePrefs[l.ID] = cp
	}
	return lk
}

func generateForRequest(ctx requestContext, lk lookupData, weights map[string]float64, maxRoomsPerRequest int) []Assignment {
	duration := ctx.req.DurationSlots
	candidateRooms := selectCandidateRooms(ctx, lk, maxRoomsPerRequest)

	var out []Assignment
	for _, lecturerID := range ctx.eligibleLecturer {
		for _, block := range iterCandidateBlocks(lk.daySlots, duration) {
			occupied := slotIDs(block)
			for _, room := range candidateRooms {
				penalties := computeDirectScores(ctx, lecturerID, lk)
				objectiveCost := weights[directSFT001] * penalties[directSFT001]

				out = append(out, Assignment{
					VariableKey:       fmt.Sprintf("r%d_l%d_room%d_start%d", ctx.index, lecturerID, room.ID, block[0].ID),
					RequestIndex:      ctx.index,
					LecturerID:        lecturerID,
					RoomID:            room.ID,
					StartTimeSlotID:   block[0].ID,
					EndTimeSlotID:     block[len(block)-1].ID,
					StartSlotPosition: lk.slotPositionByID[block[0].ID],
					EndSlotPosition:   lk.slotPositionByID[block[len(block)-1].ID],
					OccupiedSlotIDs:   occupied,
					Day:               block[0].Day,
					CourseID:          ctx.req.CourseID,
					ClassID:           ctx.req.ClassID,
					DirectPenalties:   penalties,
					ObjectiveCost:     objectiveCost,
				})
			}
		}
	}
	return out
}

func selectCandidateRooms(
	ctx requestContext,
	lk lookupData,
	maxRoomsPerRequest int,
) []model.Room {
	feasible := make([]model.Room, 0, len(lk.roomByID))
	for _, room := range lk.roomByID {
		if !roomMatchesRequiredType(room, ctx.req.RequiredRoomType) {
			continue
		}
		if room.Capacity < ctx.capacityRequired {
			continue
		}
		feasible = append(feasible, room)
	}

	sort.Slice(feasible, func(i, j int) bool {
		left := feasible[i]
		right := feasible[j]
		leftWaste := left.Capacity - ctx.capacityRequired
		rightWaste := right.Capacity - ctx.capacityRequired
		if leftWaste != rightWaste {
			return leftWaste < rightWaste
		}
		if left.Floor != right.Floor {
			return left.Floor < right.Floor
		}
		return left.ID < right.ID
	})

	if maxRoomsPerRequest <= 0 || len(feasible) <= maxRoomsPerRequest {
		return feasible
	}

	offset := 0
	if ctx.req.ClassID > 0 {
		offset = (ctx.req.ClassID - 1) % len(feasible)
	} else if ctx.index >= 0 {
		offset = ctx.index % len(feasible)
	}

	selected := make([]model.Room, 0, maxRoomsPerRequest)
	if len(feasible) <= maxRoomsPerRequest {
		return feasible
	}

	stride := max(1, len(feasible)/maxRoomsPerRequest)
	for i := 0; i < maxRoomsPerRequest; i++ {
		idx := (offset + i*stride) % len(feasible)
		selected = append(selected, feasible[idx])
	}
	return selected
}

func roomMatchesRequiredType(room model.Room, required *string) bool {
	if required == nil || *required == "" {
		return true
	}
	if room.RoomType == nil {
		return false
	}
	return *room.RoomType == *required
}

// applyDominancePruning mempertahankan hingga K slot tersebar per (lecturer, room, day).
func applyDominancePruning(candidates []Assignment, slotsPerDay int) []Assignment {
	if slotsPerDay <= 0 {
		slotsPerDay = DefaultDominanceSlotsPerDay
	}

	buckets := map[dominanceKey][]Assignment{}
	for _, c := range candidates {
		key := dominanceKey{lecturerID: c.LecturerID, roomID: c.RoomID, day: c.Day}
		buckets[key] = append(buckets[key], c)
	}

	out := make([]Assignment, 0, len(candidates))
	for _, list := range buckets {
		out = append(out, selectSpreadSlots(list, slotsPerDay)...)
	}
	sort.Slice(out, func(i, j int) bool { return assignmentLess(out[i], out[j]) })
	return out
}

func selectSpreadSlots(candidates []Assignment, maxK int) []Assignment {
	if len(candidates) == 0 {
		return nil
	}
	if len(candidates) <= maxK {
		sort.Slice(candidates, func(i, j int) bool { return assignmentLess(candidates[i], candidates[j]) })
		return candidates
	}

	byPosition := map[int]Assignment{}
	positions := make([]int, 0)
	for _, c := range candidates {
		pos := c.StartSlotPosition
		existing, ok := byPosition[pos]
		if !ok || assignmentLess(c, existing) {
			byPosition[pos] = c
		}
	}
	for pos := range byPosition {
		positions = append(positions, pos)
	}
	sort.Ints(positions)

	if len(positions) <= maxK {
		out := make([]Assignment, 0, len(positions))
		for _, pos := range positions {
			out = append(out, byPosition[pos])
		}
		sort.Slice(out, func(i, j int) bool { return assignmentLess(out[i], out[j]) })
		return out
	}

	if maxK == 1 {
		best := byPosition[positions[0]]
		for _, pos := range positions[1:] {
			if assignmentLess(byPosition[pos], best) {
				best = byPosition[pos]
			}
		}
		return []Assignment{best}
	}

	selected := make([]Assignment, 0, maxK)
	for i := 0; i < maxK; i++ {
		idx := i * (len(positions) - 1) / (maxK - 1)
		selected = append(selected, byPosition[positions[idx]])
	}
	sort.Slice(selected, func(i, j int) bool { return assignmentLess(selected[i], selected[j]) })
	return selected
}

// bucketPruneCandidates menjaga diversitas dosen, ruang, dan slot start
// alih-alih global top-K murni berbasis SFT_001.
func bucketPruneCandidates(candidates []Assignment, maxK int) []Assignment {
	if len(candidates) <= maxK {
		return candidates
	}

	sorted := append([]Assignment{}, candidates...)
	sort.Slice(sorted, func(i, j int) bool { return assignmentLess(sorted[i], sorted[j]) })

	byLecturer := map[int][]Assignment{}
	byRoom := map[int][]Assignment{}
	byStart := map[int][]Assignment{}
	for _, c := range candidates {
		byLecturer[c.LecturerID] = append(byLecturer[c.LecturerID], c)
		byRoom[c.RoomID] = append(byRoom[c.RoomID], c)
		byStart[c.StartTimeSlotID] = append(byStart[c.StartTimeSlotID], c)
	}
	for k := range byLecturer {
		sort.Slice(byLecturer[k], func(i, j int) bool { return assignmentLess(byLecturer[k][i], byLecturer[k][j]) })
	}
	for k := range byRoom {
		sort.Slice(byRoom[k], func(i, j int) bool { return assignmentLess(byRoom[k][i], byRoom[k][j]) })
	}
	for k := range byStart {
		sort.Slice(byStart[k], func(i, j int) bool { return assignmentLess(byStart[k][i], byStart[k][j]) })
	}

	lecturerQuota := max(1, ceilDiv(maxK, 3*max(1, len(byLecturer))))
	roomQuota := max(1, ceilDiv(maxK, 3*max(1, len(byRoom))))
	startQuota := max(1, ceilDiv(maxK, 3*max(1, len(byStart))))

	selected := map[string]Assignment{}
	addFromBuckets := func(buckets map[int][]Assignment, quota int) {
		for _, list := range buckets {
			limit := quota
			if limit > len(list) {
				limit = len(list)
			}
			for i := 0; i < limit; i++ {
				selected[list[i].VariableKey] = list[i]
			}
		}
	}
	addFromBuckets(byLecturer, lecturerQuota)
	addFromBuckets(byRoom, roomQuota)
	addFromBuckets(byStart, startQuota)

	for _, c := range sorted {
		if len(selected) >= maxK {
			break
		}
		selected[c.VariableKey] = c
	}

	out := make([]Assignment, 0, len(selected))
	for _, c := range selected {
		out = append(out, c)
	}
	return trimWithLecturerDiversity(out, maxK)
}

func trimWithLecturerDiversity(candidates []Assignment, maxK int) []Assignment {
	if len(candidates) <= maxK {
		return candidates
	}

	sorted := append([]Assignment{}, candidates...)
	sort.Slice(sorted, func(i, j int) bool { return assignmentLess(sorted[i], sorted[j]) })

	byLecturer := map[int][]Assignment{}
	lecturerIDs := []int{}
	for _, c := range sorted {
		if _, ok := byLecturer[c.LecturerID]; !ok {
			lecturerIDs = append(lecturerIDs, c.LecturerID)
		}
		byLecturer[c.LecturerID] = append(byLecturer[c.LecturerID], c)
	}
	sort.Ints(lecturerIDs)

	used := map[string]struct{}{}
	out := make([]Assignment, 0, maxK)
	for _, lid := range lecturerIDs {
		if len(out) >= maxK {
			break
		}
		list := byLecturer[lid]
		if len(list) == 0 {
			continue
		}
		key := list[0].VariableKey
		if _, ok := used[key]; ok {
			continue
		}
		used[key] = struct{}{}
		out = append(out, list[0])
	}
	for _, c := range sorted {
		if len(out) >= maxK {
			break
		}
		if _, ok := used[c.VariableKey]; ok {
			continue
		}
		used[c.VariableKey] = struct{}{}
		out = append(out, c)
	}
	sort.Slice(out, func(i, j int) bool { return assignmentLess(out[i], out[j]) })
	return out
}

func assignmentLess(a, b Assignment) bool {
	if a.ObjectiveCost != b.ObjectiveCost {
		return a.ObjectiveCost < b.ObjectiveCost
	}
	dayA, okA := dayOrder[a.Day]
	dayB, okB := dayOrder[b.Day]
	if okA && okB && dayA != dayB {
		return dayA < dayB
	}
	if a.Day != b.Day {
		return a.Day < b.Day
	}
	if a.StartSlotPosition != b.StartSlotPosition {
		return a.StartSlotPosition < b.StartSlotPosition
	}
	if a.EndSlotPosition != b.EndSlotPosition {
		return a.EndSlotPosition < b.EndSlotPosition
	}
	if a.RoomID != b.RoomID {
		return a.RoomID < b.RoomID
	}
	return a.LecturerID < b.LecturerID
}

func iterCandidateBlocks(daySlots map[string][]model.TimeSlot, duration int) [][]model.TimeSlot {
	var blocks [][]model.TimeSlot
	for _, slots := range daySlots {
		if len(slots) < duration {
			continue
		}
		for start := 0; start <= len(slots)-duration; start++ {
			block := slots[start : start+duration]
			contiguous := true
			for i := 0; i < len(block)-1; i++ {
				if block[i].EndTime != block[i+1].StartTime {
					contiguous = false
					break
				}
			}
			if contiguous {
				blocks = append(blocks, block)
			}
		}
	}
	return blocks
}

func computeDirectScores(ctx requestContext, lecturerID int, lk lookupData) map[string]float64 {
	penalties := map[string]float64{
		directSFT001: 1.0,
	}
	if rank, ok := lk.coursePrefs[lecturerID][ctx.req.CourseID]; ok {
		penalties[directSFT001] = math.Min(1.0, float64(rank-1)*0.35)
	}
	return penalties
}

func slotIDs(block []model.TimeSlot) []int {
	out := make([]int, len(block))
	for i, s := range block {
		out[i] = s.ID
	}
	return out
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func ceilDiv(a, b int) int {
	if b <= 0 {
		return a
	}
	return (a + b - 1) / b
}

func minIntOr(current, value int) int {
	if current < 0 || value < current {
		return value
	}
	return current
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
