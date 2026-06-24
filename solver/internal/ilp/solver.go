// Package ilp memformulasikan masalah penjadwalan sebagai Integer Linear Program (ILP).
//
// Variabel keputusan utama: x_k ∈ {0,1} untuk setiap kandidat assignment k.
//
// Hard constraints (HRD):
//   - HRD_001: Σ x_k <= 1 per (lecturer_id, slot_id)     — tabrakan dosen
//   - HRD_002: Σ x_k <= 1 per (room_id, slot_id)           — tabrakan ruang
//   - daily_session_limit: Σ x_k <= limit per (lecturer, day)
//
// Soft penalties (SFT) dimasukkan ke fungsi objektif yang diminimalkan.
package ilp

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"pwl2/solver/internal/candidate"
	"pwl2/solver/internal/cbc"
	"pwl2/solver/internal/model"
	"pwl2/solver/internal/runlog"
)

type lecturerDayKey struct {
	lecturerID int
	day        string
}

// SolveOptions konfigurasi ILP.
type SolveOptions struct {
	DailySessionLimit       int
	TransitionNeighborLimit int
	TimeLimitSeconds        int
	RelativeGap             float64
	Threads                 int
}

// SolveResult hasil pemilihan kandidat per request.
type SolveResult struct {
	SolverStatus   string
	ObjectiveValue float64
	Selected       []candidate.Assignment
}

// Solve membangun dan menyelesaikan model ILP penjadwalan.
func Solve(
	requestCount int,
	courseByRequest map[int]int,
	candidates map[int][]candidate.Assignment,
	rooms map[int]model.Room,
	weights map[string]float64,
	opts SolveOptions,
) (*SolveResult, error) {
	if opts.DailySessionLimit <= 0 {
		opts.DailySessionLimit = 2
	}
	if opts.TransitionNeighborLimit <= 0 {
		opts.TransitionNeighborLimit = 8
	}

	m := cbc.NewModel("timetable_run_solver")

	// --- Variabel biner: satu per kandidat ---
	decisionVars := map[string]candidate.Assignment{}
	for _, list := range candidates {
		for _, c := range list {
			m.AddBinary(c.VariableKey)
			decisionVars[c.VariableKey] = c
		}
	}

	// --- Hard: setiap request mendapat tepat satu assignment ---
	for reqIdx := 0; reqIdx < requestCount; reqIdx++ {
		expr := cbc.LinearExpr{}
		for _, c := range candidates[reqIdx] {
			expr.Add(c.VariableKey, 1)
		}
		m.AddConstraint(fmt.Sprintf("req_%d_exact_one", reqIdx), expr, cbc.SenseEQ, 1)
	}

	// Kelompokkan kandidat untuk constraint global.
	type lecturerSlotKey struct{ lecturerID, slotID int }
	type roomSlotKey struct{ roomID, slotID int }

	lecturerSlotGroups := map[lecturerSlotKey][]string{}
	roomSlotGroups := map[roomSlotKey][]string{}
	lecturerDayGroups := map[lecturerDayKey][]string{}
	lecturerAssignmentGroups := map[int][]string{}
	lecturerDayCandidates := map[lecturerDayKey][]candidate.Assignment{}

	for _, list := range candidates {
		for _, c := range list {
			lecturerAssignmentGroups[c.LecturerID] = append(lecturerAssignmentGroups[c.LecturerID], c.VariableKey)
			ldKey := lecturerDayKey{c.LecturerID, c.Day}
			lecturerDayGroups[ldKey] = append(lecturerDayGroups[ldKey], c.VariableKey)
			lecturerDayCandidates[ldKey] = append(lecturerDayCandidates[ldKey], c)
			for _, slotID := range c.OccupiedSlotIDs {
				lecturerSlotGroups[lecturerSlotKey{c.LecturerID, slotID}] = append(
					lecturerSlotGroups[lecturerSlotKey{c.LecturerID, slotID}], c.VariableKey)
				roomSlotGroups[roomSlotKey{c.RoomID, slotID}] = append(
					roomSlotGroups[roomSlotKey{c.RoomID, slotID}], c.VariableKey)
			}
		}
	}

	// HRD_001 & HRD_002
	for key, keys := range lecturerSlotGroups {
		expr := cbc.LinearExpr{}
		for _, v := range keys {
			expr.Add(v, 1)
		}
		m.AddConstraint(fmt.Sprintf("hrd001_l%d_s%d", key.lecturerID, key.slotID), expr, cbc.SenseLE, 1)
	}
	for key, keys := range roomSlotGroups {
		expr := cbc.LinearExpr{}
		for _, v := range keys {
			expr.Add(v, 1)
		}
		m.AddConstraint(fmt.Sprintf("hrd002_r%d_s%d", key.roomID, key.slotID), expr, cbc.SenseLE, 1)
	}

	// Variabel lecturer_used: insentif coverage (menggunakan lebih banyak dosen).
	lecturerUsedVars := map[int]string{}
	for lecturerID, keys := range lecturerAssignmentGroups {
		usedVar := fmt.Sprintf("lecturer_used_l%d", lecturerID)
		m.AddBinary(usedVar)
		lecturerUsedVars[lecturerID] = usedVar
		assignExpr := cbc.LinearExpr{}
		for _, v := range keys {
			assignExpr.Add(v, 1)
		}
		// used <= sum(assignments)
		diff := cbc.LinearExpr{}
		diff.Merge(assignExpr, 1)
		diff.Add(usedVar, -1)
		m.AddConstraint(fmt.Sprintf("used_lb_l%d", lecturerID), diff, cbc.SenseGE, 0)
		// sum(assignments) <= |keys| * used
		ub := cbc.LinearExpr{}
		ub.Merge(assignExpr, 1)
		ub.Add(usedVar, -float64(len(keys)))
		m.AddConstraint(fmt.Sprintf("used_ub_l%d", lecturerID), ub, cbc.SenseLE, 0)
	}

	// Beban harian dosen (SFT_003 di-enforce sebagai hard ceiling).
	for key, keys := range lecturerDayGroups {
		expr := cbc.LinearExpr{}
		for _, v := range keys {
			expr.Add(v, 1)
		}
		m.AddConstraint(fmt.Sprintf("daily_load_l%d_%s", key.lecturerID, key.day), expr, cbc.SenseLE, float64(opts.DailySessionLimit))
	}

	// --- Soft: gap (SFT_002) dan mobilitas lantai (SFT_005) via transition vars ---
	gapPenaltyTerms := cbc.LinearExpr{}
	floorMobilityTerms := cbc.LinearExpr{}

	for ldKey, dayCandidates := range lecturerDayCandidates {
		sorted := append([]candidate.Assignment{}, dayCandidates...)
		sort.Slice(sorted, func(i, j int) bool {
			a, b := sorted[i], sorted[j]
			if a.StartSlotPosition != b.StartSlotPosition {
				return a.StartSlotPosition < b.StartSlotPosition
			}
			if a.EndSlotPosition != b.EndSlotPosition {
				return a.EndSlotPosition < b.EndSlotPosition
			}
			if a.RequestIndex != b.RequestIndex {
				return a.RequestIndex < b.RequestIndex
			}
			return a.RoomID < b.RoomID
		})

		firstVars := map[string]string{}
		lastVars := map[string]string{}
		for _, c := range sorted {
			fv := fmt.Sprintf("first_%s", c.VariableKey)
			lv := fmt.Sprintf("last_%s", c.VariableKey)
			m.AddBinary(fv)
			m.AddBinary(lv)
			firstVars[c.VariableKey] = fv
			lastVars[c.VariableKey] = lv
		}

		transitionIncoming := map[string][]string{}
		transitionOutgoing := map[string][]string{}

		for leftIdx, left := range sorted {
			neighborCount := 0
			for _, right := range sorted[leftIdx+1:] {
				if left.EndSlotPosition >= right.StartSlotPosition {
					continue
				}
				tv := fmt.Sprintf("trans_%s_to_%s", left.VariableKey, right.VariableKey)
				m.AddBinary(tv)
				// transition <= left
				le := cbc.LinearExpr{}
				le.Add(left.VariableKey, 1)
				le.Add(tv, -1)
				m.AddConstraint(tv+"_le_left", le, cbc.SenseGE, 0)
				// transition <= right
				re := cbc.LinearExpr{}
				re.Add(right.VariableKey, 1)
				re.Add(tv, -1)
				m.AddConstraint(tv+"_le_right", re, cbc.SenseGE, 0)

				transitionOutgoing[left.VariableKey] = append(transitionOutgoing[left.VariableKey], tv)
				transitionIncoming[right.VariableKey] = append(transitionIncoming[right.VariableKey], tv)

				gapSlots := right.StartSlotPosition - left.EndSlotPosition - 1
				if gapSlots > 0 {
					gapPenaltyTerms.Add(tv, float64(gapSlots))
				}
				leftFloor := rooms[left.RoomID].Floor
				rightFloor := rooms[right.RoomID].Floor
				floorJump := math.Abs(float64(leftFloor - rightFloor))
				if floorJump > 0 {
					floorMobilityTerms.Add(tv, floorJump)
				}

				neighborCount++
				if neighborCount >= opts.TransitionNeighborLimit {
					break
				}
			}
		}

		// Flow constraints: first + incoming = decision; last + outgoing = decision
		firstSum := cbc.LinearExpr{}
		for _, fv := range firstVars {
			firstSum.Add(fv, 1)
		}
		m.AddConstraint(fmt.Sprintf("one_first_l%d_%s", ldKey.lecturerID, ldKey.day), firstSum, cbc.SenseLE, 1)
		lastSum := cbc.LinearExpr{}
		for _, lv := range lastVars {
			lastSum.Add(lv, 1)
		}
		m.AddConstraint(fmt.Sprintf("one_last_l%d_%s", ldKey.lecturerID, ldKey.day), lastSum, cbc.SenseLE, 1)

		for _, c := range sorted {
			incoming := cbc.LinearExpr{}
			for _, tv := range transitionIncoming[c.VariableKey] {
				incoming.Add(tv, 1)
			}
			flowIn := cbc.LinearExpr{}
			flowIn.Add(firstVars[c.VariableKey], 1)
			flowIn.Merge(incoming, 1)
			flowIn.Add(c.VariableKey, -1)
			m.AddConstraint("flow_in_"+c.VariableKey, flowIn, cbc.SenseEQ, 0)

			outgoing := cbc.LinearExpr{}
			for _, tv := range transitionOutgoing[c.VariableKey] {
				outgoing.Add(tv, 1)
			}
			flowOut := cbc.LinearExpr{}
			flowOut.Add(lastVars[c.VariableKey], 1)
			flowOut.Merge(outgoing, 1)
			flowOut.Add(c.VariableKey, -1)
			m.AddConstraint("flow_out_"+c.VariableKey, flowOut, cbc.SenseEQ, 0)
		}
	}

	// --- Soft: pemerataan beban antar hari (SFT_004) ---
	balanceVars := []string{}
	lecturerDays := map[int]map[string]struct{}{}
	for key := range lecturerDayGroups {
		if lecturerDays[key.lecturerID] == nil {
			lecturerDays[key.lecturerID] = map[string]struct{}{}
		}
		lecturerDays[key.lecturerID][key.day] = struct{}{}
	}
	for lecturerID, days := range lecturerDays {
		dayList := sortedStrings(days)
		for i := 0; i < len(dayList); i++ {
			for j := i + 1; j < len(dayList); j++ {
				leftDay, rightDay := dayList[i], dayList[j]
				leftExpr := cbc.LinearExpr{}
				for _, v := range lecturerDayGroups[lecturerDayKey{lecturerID, leftDay}] {
					leftExpr.Add(v, 1)
				}
				rightExpr := cbc.LinearExpr{}
				for _, v := range lecturerDayGroups[lecturerDayKey{lecturerID, rightDay}] {
					rightExpr.Add(v, 1)
				}
				diffVar := fmt.Sprintf("bal_l%d_%s_%s", lecturerID, leftDay, rightDay)
				m.AddContinuous(diffVar, 0)
				balanceVars = append(balanceVars, diffVar)
				// diff >= left - right
				d1 := cbc.LinearExpr{}
				d1.Merge(leftExpr, 1)
				d1.Merge(rightExpr, -1)
				d1.Add(diffVar, -1)
				m.AddConstraint(diffVar+"_d1", d1, cbc.SenseLE, 0)
				// diff >= right - left
				d2 := cbc.LinearExpr{}
				d2.Merge(rightExpr, 1)
				d2.Merge(leftExpr, -1)
				d2.Add(diffVar, -1)
				m.AddConstraint(diffVar+"_d2", d2, cbc.SenseLE, 0)
			}
		}
	}

	// --- Fungsi objektif ---
	for _, c := range decisionVars {
		m.Objective.Add(c.VariableKey, c.ObjectiveCost)
	}
	w002 := weights["SFT_002"]
	w004 := weights["SFT_004"]
	w005 := weights["SFT_005"]
	m.Objective.Merge(gapPenaltyTerms, w002)
	m.Objective.Merge(floorMobilityTerms, w005)
	for _, bv := range balanceVars {
		m.Objective.Add(bv, w004)
	}

	coveragePriority := coveragePriority(requestCount, len(lecturerUsedVars), weights)
	for _, usedVar := range lecturerUsedVars {
		m.Objective.Add(usedVar, -coveragePriority)
	}

	runlog.Event("BUILD_MODEL", "done", map[string]any{
		"variables":   len(m.VarOrder),
		"constraints": len(m.Constraints),
		"requests":    requestCount,
	})

	cbcStart := time.Now()
	result, err := m.Solve(cbc.SolveOptions{
		TimeLimitSeconds: opts.TimeLimitSeconds,
		RelativeGap:      opts.RelativeGap,
		Threads:          opts.Threads,
	})
	if err != nil {
		runlog.Event("CBC_SOLVE", "error", map[string]any{
			"duration_ms": time.Since(cbcStart).Milliseconds(),
			"message":     err.Error(),
		})
		return nil, err
	}
	runlog.Event("CBC_SOLVE", "done", map[string]any{
		"duration_ms":     time.Since(cbcStart).Milliseconds(),
		"status":          result.Status,
		"objective_value": result.Objective,
	})
	status := result.Status
	if isBadStatus(status) {
		return nil, fmt.Errorf("ILP solver status: %s", status)
	}

	selected := make([]candidate.Assignment, 0, requestCount)
	for reqIdx := 0; reqIdx < requestCount; reqIdx++ {
		var chosen *candidate.Assignment
		for _, c := range candidates[reqIdx] {
			if result.Values[c.VariableKey] > 0.5 {
				copy := c
				chosen = &copy
				break
			}
		}
		if chosen == nil {
			return nil, fmt.Errorf("no assignment selected for request #%d (solver status: %s)", reqIdx+1, status)
		}
		selected = append(selected, *chosen)
	}

	objective := calculateSelectedObjective(selected, courseByRequest, rooms, weights)
	return &SolveResult{
		SolverStatus:   status,
		ObjectiveValue: objective,
		Selected:       selected,
	}, nil
}

func coveragePriority(requestCount, lecturerCount int, weights map[string]float64) float64 {
	budget := 0.0
	for _, w := range weights {
		if w > 0 {
			budget += w
		}
	}
	if budget <= 0 {
		budget = 1
	}
	priority := float64((requestCount+1)*(lecturerCount+1)) * budget * 10
	if priority < 1000 {
		priority = 1000
	}
	return priority
}

func calculateSelectedObjective(
	selected []candidate.Assignment,
	courseByRequest map[int]int,
	rooms map[int]model.Room,
	weights map[string]float64,
) float64 {
	directTotal := 0.0
	for _, c := range selected {
		directTotal += c.ObjectiveCost
	}

	lecturerDayLoads := map[int]map[string]int{}
	lecturerDayCandidates := map[lecturerDayKey][]candidate.Assignment{}

	for _, c := range selected {
		if lecturerDayLoads[c.LecturerID] == nil {
			lecturerDayLoads[c.LecturerID] = map[string]int{}
		}
		lecturerDayLoads[c.LecturerID][c.Day]++
		ldKey := lecturerDayKey{c.LecturerID, c.Day}
		lecturerDayCandidates[ldKey] = append(lecturerDayCandidates[ldKey], c)
	}

	balancePenalty := 0.0
	for _, dayLoads := range lecturerDayLoads {
		days := sortedStringsFromCounts(dayLoads)
		for i := 0; i < len(days); i++ {
			for j := i + 1; j < len(days); j++ {
				balancePenalty += math.Abs(float64(dayLoads[days[i]] - dayLoads[days[j]]))
			}
		}
	}

	gapPenalty := 0.0
	floorPenalty := 0.0
	for _, dayCandidates := range lecturerDayCandidates {
		sort.Slice(dayCandidates, func(i, j int) bool {
			a, b := dayCandidates[i], dayCandidates[j]
			if a.StartSlotPosition != b.StartSlotPosition {
				return a.StartSlotPosition < b.StartSlotPosition
			}
			return a.EndSlotPosition < b.EndSlotPosition
		})
		for i := 0; i < len(dayCandidates)-1; i++ {
			left, right := dayCandidates[i], dayCandidates[i+1]
			gapPenalty += float64(max(0, right.StartSlotPosition-left.EndSlotPosition-1))
			floorPenalty += math.Abs(float64(rooms[left.RoomID].Floor - rooms[right.RoomID].Floor))
		}
	}

	return directTotal +
		weights["SFT_002"]*gapPenalty +
		weights["SFT_004"]*balancePenalty +
		weights["SFT_005"]*floorPenalty
}

func isBadStatus(status string) bool {
	s := strings.ToLower(status)
	return strings.Contains(s, "infeasible") || strings.Contains(s, "unbounded") || strings.Contains(s, "undefined")
}

func sortedStrings(set map[string]struct{}) []string {
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func sortedStringsFromCounts(m map[string]int) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
