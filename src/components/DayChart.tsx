"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DayChart({ data, labels }: { data: { day: string; calls: number; contacts: number }[]; labels: { calls: string; contacts: string } }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="calls" name={labels.calls} fill="#93c5fd" radius={[3, 3, 0, 0]} />
          <Bar dataKey="contacts" name={labels.contacts} fill="#1d4ed8" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
