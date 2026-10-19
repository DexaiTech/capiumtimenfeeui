import type { BaseChartProps, ChartDatum, ChartTableColumn, ChartTableData } from './types';

const identity = (value: string | number): string => String(value);

/** Builds the table alternative, formatting the category with `xFormatter` and numbers with `yFormatter`. */
export function buildCartesianTable({
  title,
  data,
  xKey,
  series,
  xFormatter,
  yFormatter,
  tableColumns,
}: Pick<
  BaseChartProps,
  'title' | 'data' | 'xKey' | 'series' | 'xFormatter' | 'yFormatter' | 'tableColumns'
>): ChartTableData {
  const columns: ChartTableColumn[] = tableColumns ?? [
    { key: xKey, label: xKey, align: 'start' },
    ...series.map((item): ChartTableColumn => ({ key: item.key, label: item.label, align: 'end' })),
  ];
  const rows = data.map((datum): ChartDatum => {
    const row: ChartDatum = {};
    for (const column of columns) {
      const value = datum[column.key] ?? null;
      if (value === null) row[column.key] = null;
      else if (column.key === xKey) row[column.key] = (xFormatter ?? identity)(value);
      else if (typeof value === 'number' && yFormatter) row[column.key] = yFormatter(value);
      else row[column.key] = value;
    }
    return row;
  });
  return { caption: title, columns, rows };
}
