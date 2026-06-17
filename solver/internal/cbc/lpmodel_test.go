package cbc

import (
	"os"
	"testing"
)

// TestSimpleLPBuild memverifikasi builder LP dan parser solusi CBC.
func TestSimpleLPBuild(t *testing.T) {
	m := NewModel("lp_test")
	m.AddContinuous("ksi", 0)
	m.Objective.Add("ksi", 1)
	m.AddContinuous("w_1", 0)
	m.AddContinuous("w_2", 0)

	sum := LinearExpr{}
	sum.Add("w_1", 1)
	sum.Add("w_2", 1)
	m.AddConstraint("normalize", sum, SenseEQ, 1)

	expr := LinearExpr{}
	expr.Add("w_1", 1)
	expr.Add("w_2", -3)
	expr.Add("ksi", -1)
	m.AddConstraint("c1", expr, SenseLE, 0)

	dir := t.TempDir()
	path := dir + "/model.lp"
	if err := m.WriteLP(path); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(path)
	t.Logf("LP file:\n%s", string(data))

	result, err := m.Solve(SolveOptions{})
	if err != nil {
		t.Skip("CBC not available:", err)
	}
	t.Logf("status=%s values=%v", result.Status, result.Values)
}
