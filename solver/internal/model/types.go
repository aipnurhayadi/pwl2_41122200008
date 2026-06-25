// Package model berisi kontrak JSON input/output solver CLI penjadwalan.
// Laravel membaca database (termasuk bobot agregat dari bwm_weights),
// membangun TimetableSolveRequest, lalu memanggil `solver timetable`.
package model

type TimetableSolveRequest struct {
	DatasetID int                    `json:"dataset_id"`
	Weights   map[string]float64     `json:"weights"`
	Config    TimetableSolverConfig  `json:"config"`
	Rooms     []Room                 `json:"rooms"`
	TimeSlots []TimeSlot             `json:"time_slots"`
	Lecturers []LecturerInput        `json:"lecturers"`
	Requests  []TeachingRequest      `json:"teaching_requests"`
}

type TimetableSolverConfig struct {
	DailySessionLimit        int     `json:"daily_session_limit"`
	MaxCandidatesPerRequest  int     `json:"max_candidates_per_request"`
	MaxRoomsPerRequest       int     `json:"max_rooms_per_request"`
	TransitionNeighborLimit  int     `json:"transition_neighbor_limit"`
	SolverTimeLimitSeconds   int     `json:"solver_time_limit_seconds"`
	SolverRelativeGap        float64 `json:"solver_relative_gap"`
	SolverThreads            int     `json:"solver_threads"`
}

type Room struct {
	ID       int     `json:"id"`
	Code     string  `json:"code"`
	Capacity int     `json:"capacity"`
	Floor    int     `json:"floor"`
	RoomType *string `json:"room_type"`
}

type TimeSlot struct {
	ID        int    `json:"id"`
	Code      string `json:"code"`
	Day       string `json:"day"`
	StartTime string `json:"start_time"` // HH:MM:SS
	EndTime   string `json:"end_time"`
}

type LecturerInput struct {
	ID                int                `json:"id"`
	AllowedCourseIDs  []int              `json:"allowed_course_ids"`
	CoursePreferences []CoursePreference `json:"course_preferences"`
}

type CoursePreference struct {
	CourseID  int `json:"course_id"`
	RankOrder int `json:"rank_order"`
}

type TeachingRequest struct {
	ClassID          int     `json:"class_id"`
	CourseID         int     `json:"course_id"`
	LecturerID       *int    `json:"lecturer_id"`
	DurationSlots    int     `json:"duration_slots"`
	ExpectedCapacity *int    `json:"expected_capacity"`
	RequiredRoomType *string `json:"required_room_type"`
	ClassCapacity    *int    `json:"class_capacity"`
}

type TimetableSolveResponse struct {
	Status         string             `json:"status"`
	SolverStatus   string             `json:"solver_status,omitempty"`
	ObjectiveValue float64            `json:"objective_value,omitempty"`
	Assignments    []AssignmentResult `json:"assignments,omitempty"`
	Error          string             `json:"error,omitempty"`
}

type AssignmentResult struct {
	RequestIndex    int                `json:"request_index"`
	LecturerID      int                `json:"lecturer_id"`
	CourseID        int                `json:"course_id"`
	ClassID         int                `json:"class_id"`
	RoomID          int                `json:"room_id"`
	StartTimeSlotID int                `json:"start_time_slot_id"`
	EndTimeSlotID   int                `json:"end_time_slot_id"`
	ObjectiveCost   float64            `json:"objective_cost"`
	DirectPenalties map[string]float64 `json:"direct_penalties"`
}
