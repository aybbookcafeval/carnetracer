export type CsvValue = string | number | null | undefined;

function escapeCsvValue(value: CsvValue): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]) {
  const content = [headers, ...rows]
    .map(row => row.map(escapeCsvValue).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const INVENTORY_CSV_HEADERS = [
  "nombre",
  "cantidad",
  "almacen_descuento",
  "almacen_incremento",
];
