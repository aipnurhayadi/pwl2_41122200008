import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { buildDatasetTimetableAnalytics } from "@/lib/mockTimetableAnalytics";

const chartClassName = "h-[240px] w-full aspect-auto";

const weightChartConfig = {
  weight: { label: "Bobot", color: "var(--chart-1)" },
};

const constraintChartConfig = {
  satisfied: { label: "Terpenuhi", color: "var(--chart-2)" },
  violated: { label: "Pelanggaran", color: "var(--chart-4)" },
};

const dayChartConfig = {
  sessions: { label: "Sesi", color: "var(--chart-1)" },
};

const pieChartConfig = {
  sessions: { label: "Sesi" },
  mon: { label: "Senin", color: "var(--chart-1)" },
  tue: { label: "Selasa", color: "var(--chart-2)" },
  wed: { label: "Rabu", color: "var(--chart-3)" },
  thu: { label: "Kamis", color: "var(--chart-4)" },
  fri: { label: "Jumat", color: "var(--chart-5)" },
};

const penaltyChartConfig = {
  penalty: { label: "Penalty", color: "var(--chart-3)" },
};

const runHistoryChartConfig = {
  objective: { label: "Objective", color: "var(--chart-1)" },
  penalty: { label: "Total Penalty", color: "var(--chart-4)" },
};

const lecturerChartConfig = {
  sessions: { label: "Sesi", color: "var(--chart-2)" },
};

const penaltyBreakdownChartConfig = {
  idle_gap: { label: "Idle Gap", color: "var(--chart-1)" },
  mobility: { label: "Mobilitas", color: "var(--chart-2)" },
  daily_load: { label: "Beban Harian", color: "var(--chart-3)" },
  balance: { label: "Balance", color: "var(--chart-4)" },
};

const radarChartConfig = {
  score: { label: "Skor Kepuasan", color: "var(--chart-1)" },
};

const radialChartConfig = {
  fulfillment: { label: "Terpenuhi" },
  scheduled: { label: "Terpenuhi", color: "var(--chart-2)" },
};

function fmtNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

export default function TimetableAnalyticsSection({ dataset, tree }) {
  const analytics = useMemo(
    () => buildDatasetTimetableAnalytics(dataset, tree),
    [dataset, tree],
  );

  const { run } = analytics;
  const totalPieSessions = analytics.pieByDay.reduce(
    (sum, row) => sum + row.sessions,
    0,
  );

  const radialData = [
    {
      name: "scheduled",
      fulfillment: run.fulfillment_percent,
      fill: "var(--color-scheduled)",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Analitik Timetable Dataset</h2>
            <Badge variant="outline">Data Dummy</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Visualisasi hasil run terakhir untuk dataset{" "}
            <span className="font-medium text-foreground">{run.dataset_name}</span>{" "}
            (<code className="text-xs">{run.dataset_code}</code>). Chart mengikuti pola{" "}
            <a
              href="https://ui.shadcn.com/charts/bar"
              className="underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              shadcn/ui charts
            </a>
            .
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs space-y-0.5">
          <p>
            Run #{run.id} · <Badge variant="secondary">{run.status}</Badge>
          </p>
          <p className="text-muted-foreground">
            {run.assignment_count} assignment · {run.lecturer_count} dosen ·{" "}
            {run.class_count} kelas · {run.course_count} MK
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bobot Soft Constraint</CardTitle>
            <CardDescription>
              Bar chart · sumber <code className="text-xs">timetable_run_weights</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={weightChartConfig} className={chartClassName}>
              <BarChart data={analytics.weights} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid horizontal={false} />
                <YAxis
                  dataKey="label"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={88}
                  tick={{ fontSize: 11 }}
                />
                <XAxis type="number" hide domain={[0, 0.4]} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="weight" fill="var(--color-weight)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kepuasan vs Pelanggaran</CardTitle>
            <CardDescription>
              Stacked bar · sumber <code className="text-xs">timetable_run_constraint_summaries</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={constraintChartConfig} className={chartClassName}>
              <BarChart data={analytics.constraintSummaries}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="criterion" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="satisfied" stackId="a" fill="var(--color-satisfied)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="violated" stackId="a" fill="var(--color-violated)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Sesi per Hari</CardTitle>
            <CardDescription>
              Area chart · agregasi <code className="text-xs">timetable_assignments</code> dataset ini
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dayChartConfig} className={chartClassName}>
              <AreaChart data={analytics.assignmentsByDay}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  stroke="var(--color-sessions)"
                  fill="var(--color-sessions)"
                  fillOpacity={0.35}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proporsi Sesi per Hari</CardTitle>
            <CardDescription>
              Pie chart · distribusi assignment dataset {run.dataset_code}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pieChartConfig} className={chartClassName}>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="day" />} />
                <Pie
                  data={analytics.pieByDay}
                  dataKey="sessions"
                  nameKey="label"
                  innerRadius={56}
                  strokeWidth={4}
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Total {totalPieSessions} sesi terjadwal pada dataset ini
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Penalty per Kriteria</CardTitle>
            <CardDescription>
              Bar chart · <code className="text-xs">timetable_run_constraint_summaries.total_penalty</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={penaltyChartConfig} className={chartClassName}>
              <BarChart data={analytics.penaltyByCriterion}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="criterion" tickLine={false} axisLine={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="penalty" fill="var(--color-penalty)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat Run Dataset</CardTitle>
            <CardDescription>
              Line chart · objective & penalty dari run sebelumnya dataset yang sama
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={runHistoryChartConfig} className={chartClassName}>
              <LineChart data={analytics.runHistory}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="run" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="objective" stroke="var(--color-objective)" strokeWidth={2} dot />
                <Line type="monotone" dataKey="penalty" stroke="var(--color-penalty)" strokeWidth={2} dot />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Beban Sesi Dosen</CardTitle>
            <CardDescription>
              Bar chart · <code className="text-xs">timetable_run_lecturer_summaries</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={lecturerChartConfig} className={chartClassName}>
              <BarChart data={analytics.lecturerSessions}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="lecturer" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="sessions" fill="var(--color-sessions)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Komposisi Penalty Dosen</CardTitle>
            <CardDescription>
              Stacked bar · breakdown penalty per dosen dataset ini
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={penaltyBreakdownChartConfig} className={chartClassName}>
              <BarChart data={analytics.lecturerPenalties}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="lecturer" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="idle_gap" stackId="a" fill="var(--color-idle_gap)" />
                <Bar dataKey="mobility" stackId="a" fill="var(--color-mobility)" />
                <Bar dataKey="daily_load" stackId="a" fill="var(--color-daily_load)" />
                <Bar dataKey="balance" stackId="a" fill="var(--color-balance)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skor Kepuasan Kriteria</CardTitle>
            <CardDescription>
              Radar chart · rasio terpenuhi per soft constraint
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={radarChartConfig} className={chartClassName}>
              <RadarChart data={analytics.radarScores}>
                <ChartTooltip content={<ChartTooltipContent />} />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarGrid />
                <Radar
                  dataKey="score"
                  fill="var(--color-score)"
                  fillOpacity={0.45}
                  stroke="var(--color-score)"
                />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tingkat Pemenuhan Jadwal</CardTitle>
            <CardDescription>
              Radial chart · assignment terpenuhi vs kebutuhan kelas dataset
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={radialChartConfig} className={chartClassName}>
              <RadialBarChart
                data={radialData}
                startAngle={90}
                endAngle={-270}
                innerRadius={70}
                outerRadius={96}
              >
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <PolarGrid
                  gridType="circle"
                  radialLines={false}
                  stroke="none"
                  className="first:fill-muted last:fill-background"
                  polarRadius={[76, 64]}
                />
                <RadialBar dataKey="fulfillment" background cornerRadius={8} />
                <PolarRadiusAxis tick={false} axisLine={false}>
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                              {run.fulfillment_percent}%
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 18} className="fill-muted-foreground text-xs">
                              Terjadwal
                            </tspan>
                          </text>
                        );
                      }
                      return null;
                    }}
                  />
                </PolarRadiusAxis>
              </RadialBarChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Objective run terakhir: {fmtNumber(run.objective_value, 3)} · Solver {run.solver_name}
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
