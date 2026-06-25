package timetable

import (
	"strings"
	"testing"

	"pwl2/solver/internal/model"
)

func TestSolveRequiresRooms(t *testing.T) {
	_, err := Solve(model.TimetableSolveRequest{
		Requests:  []model.TeachingRequest{{CourseID: 1, ClassID: 1, DurationSlots: 1}},
		TimeSlots: []model.TimeSlot{{ID: 1, Day: "MON", StartTime: "08:00:00", EndTime: "09:00:00"}},
	})
	if err == nil {
		t.Fatal("expected error when rooms is empty")
	}
	if !strings.Contains(err.Error(), "rooms is required and must not be empty") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSolveRequiresTimeSlots(t *testing.T) {
	_, err := Solve(model.TimetableSolveRequest{
		Requests: []model.TeachingRequest{{CourseID: 1, ClassID: 1, DurationSlots: 1}},
		Rooms:    []model.Room{{ID: 1, Capacity: 40}},
	})
	if err == nil {
		t.Fatal("expected error when time_slots is empty")
	}
	if !strings.Contains(err.Error(), "time_slots is required and must not be empty") {
		t.Fatalf("unexpected error: %v", err)
	}
}
