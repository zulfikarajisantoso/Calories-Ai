import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { NutritionalData, ChartData } from '../types';

interface NutritionChartProps {
  data: NutritionalData;
}

const NutritionChart: React.FC<NutritionChartProps> = ({ data }) => {
  const chartData: ChartData[] = [
    { name: 'Protein', value: data.protein, fill: '#3b82f6' }, // Blue
    { name: 'Carbs', value: data.carbs, fill: '#10b981' },    // Green
    { name: 'Fat', value: data.fat, fill: '#f59e0b' },       // Amber
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [`${value}g`, '']}
            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NutritionChart;