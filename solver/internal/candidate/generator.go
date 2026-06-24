// Package candidate menghasilkan kombinasi (dosen, ruang, blok waktu) yang feasible
// sebelum ILP dijalankan. Hard constraint LOKAL (HRD_003, HRD_004) difilter di sini;
// hard constraint GLOBAL (HRD_001, HRD_002) ditangani di ILP.
package candidate

import (
	"fmt"
	"sort"

	"pwl2/solver/internal/model"
)

const directSFT001 = "SFT_001"

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

type requestContext struct {
	index            int
	req              model.TeachingRequest
	eligibleLecturer []int
	capacityRequired int
}

type lookupData struct {
	roomByID             map[int]model.Room
	slotByID             map[int]model.TimeSlot
	daySlots             map[string][]model.TimeSlot
	slotPositionByID     map[int]int
	lecturerAllowedSlots map[int]map[int]struct{}
	coursePrefs          map[int]map[int]int
}

// Build menghasilkan kandidat per teaching request.
func Build(
	requests []model.TeachingRequest,
	rooms []model.Room,
	slots []model.TimeSlot,
	lecturers []model.LecturerInput,
	weights map[string]float64,
	maxCandidatesPerRequest int,
) (map[int][]Assignment, error) {
	if maxCandidatesPerRequest <= 0 {
		maxCandidatesPerRequest = 40
	}

	lk := buildLookups(rooms, slots, lecturers)
	contexts, err := buildRequestContexts(requests, lecturers)
	if err != nil {
		return nil, err
	}

	out := map[int][]Assignment{}
	for _, ctx := range contexts {
		candidates := generateForRequest(ctx, lk, weights)
		if len(candidates) == 0 {
			return nil, fmt.Errorf("no feasible candidate for request #%d", ctx.index+1)
		}
		// Pruning berbasis soft objective: bukan hard constraint, tapi batasi ukuran model ILP.
		if len(candidates) > maxCandidatesPerRequest {
			sort.Slice(candidates, func(i, j int) bool {
				a, b := candidates[i], candidates[j]
				if a.ObjectiveCost != b.ObjectiveCost {
					return a.ObjectiveCost < b.ObjectiveCost
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
			})
			candidates = candidates[:maxCandidatesPerRequest]
		}
		out[ctx.index] = candidates
	}
	return out, nil
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
		roomByID:             map[int]model.Room{},
		slotByID:             map[int]model.TimeSlot{},
		daySlots:             map[string][]model.TimeSlot{},
		slotPositionByID:     map[int]int{},
		lecturerAllowedSlots: map[int]map[int]struct{}{},
		coursePrefs:          map[int]map[int]int{},
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
		slotSet := map[int]struct{}{}
		for _, sid := range l.AllowedTimeSlotIDs {
			slotSet[sid] = struct{}{}
		}
		lk.lecturerAllowedSlots[l.ID] = slotSet
		cp := map[int]int{}
		for _, p := range l.CoursePreferences {
			cp[p.CourseID] = p.RankOrder
		}
		lk.coursePrefs[l.ID] = cp
	}
	return lk
}

func generateForRequest(ctx requestContext, lk lookupData, weights map[string]float64) []Assignment {
	allowedRooms := toSet(ctx.req.AllowedRoomIDs)
	allowedStarts := toSet(ctx.req.AllowedStartTimeSlotIDs)
	duration := ctx.req.DurationSlots

	var out []Assignment
	for _, lecturerID := range ctx.eligibleLecturer {
		allowedSlotIDs := lk.lecturerAllowedSlots[lecturerID]
		for _, block := range iterCandidateBlocks(lk.daySlots, duration, allowedStarts) {
			occupied := slotIDs(block)
			// HRD_004: dosen hanya boleh di slot yang diizinkan (jika daftar allowed tidak kosong).
			if len(allowedSlotIDs) > 0 && !isSubset(occupied, allowedSlotIDs) {
				continue
			}
			for _, room := range lk.roomByID {
				if len(allowedRooms) > 0 {
					if _, ok := allowedRooms[room.ID]; !ok {
						continue
					}
				}
				// HRD_003: kapasitas ruang harus cukup.
				if room.Capacity < ctx.capacityRequired {
					continue
				}

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

func iterCandidateBlocks(daySlots map[string][]model.TimeSlot, duration int, allowedStarts map[int]struct{}) [][]model.TimeSlot {
	var blocks [][]model.TimeSlot
	for _, slots := range daySlots {
		if len(slots) < duration {
			continue
		}
		for start := 0; start <= len(slots)-duration; start++ {
			block := slots[start : start+duration]
			if len(allowedStarts) > 0 {
				if _, ok := allowedStarts[block[0].ID]; !ok {
					continue
				}
			}
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
	rankPenalty := map[int]float64{1: 0.0, 2: 0.35, 3: 0.7}
	if rank, ok := lk.coursePrefs[lecturerID][ctx.req.CourseID]; ok {
		if p, ok2 := rankPenalty[rank]; ok2 {
			penalties[directSFT001] = p
		}
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

func toSet(ids []int) map[int]struct{} {
	if len(ids) == 0 {
		return nil
	}
	out := make(map[int]struct{}, len(ids))
	for _, id := range ids {
		out[id] = struct{}{}
	}
	return out
}

func isSubset(values []int, allowed map[int]struct{}) bool {
	for _, v := range values {
		if _, ok := allowed[v]; !ok {
			return false
		}
	}
	return true
}
