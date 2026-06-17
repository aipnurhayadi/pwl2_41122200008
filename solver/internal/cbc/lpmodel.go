// Package cbc membangun model LP/MILP dalam format CPLEX LP dan menyelesaikannya
// dengan solver CBC (COIN-OR Branch and Cut). CBC dipakai karena open-source dan
// kompatibel dengan referensi Python (PuLP + PULP_CBC_CMD).
package cbc

import (
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

// Sense menandai arah constraint: <=, >=, atau ==.
type Sense int

const (
	SenseLE Sense = iota
	SenseGE
	SenseEQ
)

// LinearExpr adalah ekspresi linear sum(coef[i] * var[i]).
type LinearExpr map[string]float64

func (e LinearExpr) Add(term string, coef float64) {
	if coef == 0 {
		return
	}
	e[term] += coef
	if math.Abs(e[term]) < 1e-12 {
		delete(e, term)
	}
}

func (e LinearExpr) Merge(other LinearExpr, scale float64) {
	for v, c := range other {
		e.Add(v, c*scale)
	}
}

// Constraint adalah satu baris Subject To.
type Constraint struct {
	Name  string
	Expr  LinearExpr
	Sense Sense
	RHS   float64
}

// Model adalah representasi MILP yang akan ditulis ke file .lp.
type Model struct {
	Name           string
	Minimize       bool
	Objective      LinearExpr
	Constraints    []Constraint
	LowerBounds    map[string]float64
	UpperBounds    map[string]float64
	BinaryVars     map[string]struct{}
	ContinuousVars map[string]struct{}
	// VarOrder urutan deklarasi variabel; dipakai untuk memetakan solusi CBC (x0, x1, ...).
	VarOrder []string
}

func NewModel(name string) *Model {
	return &Model{
		Name:           name,
		Minimize:       true,
		Objective:      LinearExpr{},
		LowerBounds:    map[string]float64{},
		UpperBounds:    map[string]float64{},
		BinaryVars:     map[string]struct{}{},
		ContinuousVars: map[string]struct{}{},
	}
}

func (m *Model) registerVar(name string) {
	for _, existing := range m.VarOrder {
		if existing == name {
			return
		}
	}
	m.VarOrder = append(m.VarOrder, name)
}

func (m *Model) AddBinary(name string) {
	m.registerVar(name)
	m.BinaryVars[name] = struct{}{}
	m.LowerBounds[name] = 0
	m.UpperBounds[name] = 1
}

func (m *Model) AddContinuous(name string, lower float64) {
	m.registerVar(name)
	m.ContinuousVars[name] = struct{}{}
	m.LowerBounds[name] = lower
}

func (m *Model) AddConstraint(name string, expr LinearExpr, sense Sense, rhs float64) {
	m.Constraints = append(m.Constraints, Constraint{Name: name, Expr: expr, Sense: sense, RHS: rhs})
}

// SolveOptions mengatur batas waktu dan gap relatif solver CBC.
type SolveOptions struct {
	TimeLimitSeconds int
	RelativeGap      float64
	Threads          int
}

// SolveResult berisi status dan nilai variabel dari solusi CBC.
type SolveResult struct {
	Status    string
	Objective float64
	Values    map[string]float64
}

func (m *Model) WriteLP(path string) error {
	var b strings.Builder

	if m.Minimize {
		b.WriteString("Minimize\n")
	} else {
		b.WriteString("Maximize\n")
	}
	b.WriteString(" obj: ")
	b.WriteString(formatLinearExpr(m.Objective))
	b.WriteString("\nSubject To\n")

	for _, c := range m.Constraints {
		b.WriteString(" ")
		b.WriteString(sanitizeName(c.Name))
		b.WriteString(": ")
		b.WriteString(formatLinearExpr(c.Expr))
		switch c.Sense {
		case SenseLE:
			b.WriteString(" <= ")
		case SenseGE:
			b.WriteString(" >= ")
		case SenseEQ:
			b.WriteString(" = ")
		}
		b.WriteString(formatNumber(c.RHS))
		b.WriteString("\n")
	}

	allVars := m.allVarNames()
	if len(allVars) > 0 {
		b.WriteString("Bounds\n")
		for _, v := range allVars {
			lo, hasLo := m.LowerBounds[v]
			hi, hasHi := m.UpperBounds[v]
			if _, isBin := m.BinaryVars[v]; isBin {
				continue
			}
			switch {
			case hasLo && hasHi:
				if lo == hi {
					b.WriteString(fmt.Sprintf(" %s = %s\n", v, formatNumber(lo)))
				} else {
					b.WriteString(fmt.Sprintf(" %s <= %s\n", formatNumber(lo), v))
					if hasHi {
						b.WriteString(fmt.Sprintf(" %s <= %s\n", v, formatNumber(hi)))
					}
				}
			case hasLo:
				b.WriteString(fmt.Sprintf(" %s <= %s\n", formatNumber(lo), v))
			case hasHi:
				b.WriteString(fmt.Sprintf(" %s <= %s\n", v, formatNumber(hi)))
			}
		}
	}

	binaries := sortedKeys(m.BinaryVars)
	if len(binaries) > 0 {
		b.WriteString("Binaries\n")
		for _, v := range binaries {
			b.WriteString(" " + v + "\n")
		}
	}

	b.WriteString("End\n")
	return os.WriteFile(path, []byte(b.String()), 0o644)
}

func (m *Model) allVarNames() []string {
	seen := map[string]struct{}{}
	for v := range m.Objective {
		seen[v] = struct{}{}
	}
	for _, c := range m.Constraints {
		for v := range c.Expr {
			seen[v] = struct{}{}
		}
	}
	for v := range m.LowerBounds {
		seen[v] = struct{}{}
	}
	for v := range m.UpperBounds {
		seen[v] = struct{}{}
	}
	return sortedKeys(seen)
}

// Solve menulis model ke file sementara, memanggil CBC, lalu parse solusi.
func (m *Model) Solve(opts SolveOptions) (*SolveResult, error) {
	cbcPath, err := findCBC()
	if err != nil {
		return nil, err
	}

	dir, err := os.MkdirTemp("", "pwl2-solver-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)

	lpPath := filepath.Join(dir, "model.lp")
	solPath := filepath.Join(dir, "solution.txt")
	if err := m.WriteLP(lpPath); err != nil {
		return nil, err
	}

	args := []string{lpPath, "solve", "solu", solPath}
	if opts.TimeLimitSeconds > 0 {
		args = append(args, "sec", fmt.Sprintf("%d", opts.TimeLimitSeconds))
	}
	if opts.RelativeGap > 0 {
		args = append(args, "ratio", fmt.Sprintf("%g", opts.RelativeGap))
	}
	if opts.Threads > 0 {
		args = append(args, "threads", fmt.Sprintf("%d", opts.Threads))
	}

	cmd := exec.Command(cbcPath, args...)
	output, runErr := cmd.CombinedOutput()
	if runErr != nil {
		return nil, fmt.Errorf("cbc execution failed: %w\n%s", runErr, string(output))
	}

	result, parseErr := parseSolutionFile(solPath, m.VarOrder)
	if parseErr != nil {
		return nil, fmt.Errorf("parse solution: %w\nCBC output:\n%s", parseErr, string(output))
	}
	return result, nil
}

func findCBC() (string, error) {
	// Urutan pencarian: env SOLVER_CBC_PATH, PATH, PuLP bundled CBC, lokasi umum.
	if p := os.Getenv("SOLVER_CBC_PATH"); p != "" {
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}
	if p, err := exec.LookPath("cbc"); err == nil {
		return p, nil
	}
	for _, p := range pulpCBCCandidates() {
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}
	candidates := []string{
		`C:\Program Files\cbc\bin\cbc.exe`,
		`C:\cbc\bin\cbc.exe`,
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}
	return "", fmt.Errorf("CBC solver not found: install COIN-OR CBC or set SOLVER_CBC_PATH")
}

// pulpCBCCandidates mengembalikan path CBC yang dibundel PuLP (referensi backend Python).
func pulpCBCCandidates() []string {
	var out []string
	if home, err := os.UserHomeDir(); err == nil {
		patterns := []string{
			filepath.Join(home, "AppData", "Local", "Packages", "PythonSoftwareFoundation.Python.*", "LocalCache", "local-packages", "Python*", "site-packages", "pulp", "solverdir", "cbc", "win", "i64", "cbc.exe"),
		}
		for _, pattern := range patterns {
			matches, _ := filepath.Glob(pattern)
			out = append(out, matches...)
		}
	}
	// Relatif dari root repo jika dijalankan dari solver/.
	repoRoots := []string{"..", "../..", "."}
	for _, root := range repoRoots {
		pattern := filepath.Join(root, "backend", "venv", "Lib", "site-packages", "pulp", "solverdir", "cbc", "win", "i64", "cbc.exe")
		if abs, err := filepath.Abs(pattern); err == nil {
			out = append(out, abs)
		}
	}
	return out
}

func parseSolutionFile(path string, varOrder []string) (*SolveResult, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(data), "\n")
	result := &SolveResult{Values: map[string]float64{}}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		lower := strings.ToLower(line)
		if strings.HasPrefix(lower, "optimal") || strings.HasPrefix(lower, "infeasible") ||
			strings.HasPrefix(lower, "stopped") || strings.HasPrefix(lower, "unbounded") {
			result.Status = strings.Fields(line)[0]
			if idx := strings.Index(lower, "objective value"); idx >= 0 {
				var obj float64
				fmt.Sscanf(line[idx:], "objective value %f", &obj)
				result.Objective = obj
			}
			continue
		}

		// Format file .sol CBC: "<index> <varname> <value> <reduced_cost>"
		parts := strings.Fields(line)
		if len(parts) >= 3 {
			var index int
			var val float64
			if _, err := fmt.Sscanf(parts[0], "%d", &index); err == nil {
				if _, err := fmt.Sscanf(parts[2], "%f", &val); err == nil {
					name := parts[1]
					// CBC kadang menulis nama internal x0, x1 — map ke nama asli via urutan.
					if strings.HasPrefix(name, "x") && index >= 0 && index < len(varOrder) {
						name = varOrder[index]
					} else if index >= 0 && index < len(varOrder) {
						name = varOrder[index]
					}
					result.Values[name] = val
					continue
				}
			}
		}

		if len(parts) == 2 {
			var val float64
			if _, err := fmt.Sscanf(parts[1], "%f", &val); err == nil {
				result.Values[parts[0]] = val
			}
		}
	}
	if result.Status == "" {
		result.Status = "Unknown"
	}
	return result, nil
}

func sanitizeName(name string) string {
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, "-", "_")
	return name
}

func formatLinearExpr(expr LinearExpr) string {
	if len(expr) == 0 {
		return "0"
	}
	keys := sortedKeysMap(expr)
	var parts []string
	for _, k := range keys {
		coef := expr[k]
		if coef == 0 {
			continue
		}
		switch {
		case coef == 1:
			parts = append(parts, k)
		case coef == -1:
			parts = append(parts, "-"+k)
		default:
			parts = append(parts, fmt.Sprintf("%g %s", coef, k))
		}
	}
	if len(parts) == 0 {
		return "0"
	}
	out := parts[0]
	for i := 1; i < len(parts); i++ {
		part := parts[i]
		if strings.HasPrefix(part, "-") {
			out += " - " + strings.TrimPrefix(part, "-")
		} else {
			out += " + " + part
		}
	}
	return out
}

func formatNumber(v float64) string {
	if math.Abs(v-math.Round(v)) < 1e-9 {
		return fmt.Sprintf("%.0f", v)
	}
	return fmt.Sprintf("%g", v)
}

func sortedKeys(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func sortedKeysMap(m map[string]float64) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
