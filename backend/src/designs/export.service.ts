import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { DesignResult } from '../engine/index.js';

interface ExportDesign {
  name: string;
  adequate: boolean;
  totalSn: number;
  requiredSn: number;
  totalThicknessMm: number;
  layerCount: number;
  createdAt: Date;
  result: unknown;
}

const SUMMARY_HEADERS = ['Design', 'Verdict', 'Total SN', 'Required SN', 'Total thickness (mm)', 'Layers', 'Created'];
const LAYER_HEADERS = ['Design', '#', 'Layer', 'On top of', 'Thickness (mm)', 'Minimum (mm)', 'a', 'm',
  'SN added', 'Cumulative SN', 'Required SN', 'Check'];

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r1 = (v: number) => Math.round(v * 10) / 10;

function summaryRow(d: ExportDesign) {
  return [d.name, d.adequate ? 'ADEQUATE' : 'NOT ADEQUATE', r3(d.totalSn), r3(d.requiredSn), r1(d.totalThicknessMm),
    d.layerCount, d.createdAt.toISOString().slice(0, 10)];
}

function layerRows(d: ExportDesign) {
  return (d.result as DesignResult).layers.map((l) => [d.name, l.number, l.name, l.supports, r1(l.thicknessMm),
    r1(l.minThicknessMm), l.a, l.key === 'ac' || l.key === 'dbm' ? '' : l.m, r3(l.snContribution), r3(l.cumulativeSn), r3(l.requiredSn),
    l.checkOk ? 'OK' : 'NOT OK']);
}

/** Quote a CSV cell when needed (commas, quotes, line breaks). */
function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

@Injectable()
export class ExportService {
  /** One CSV: a layer table for every design, then a short summary block. */
  toCsv(projectName: string, designs: ExportDesign[]): string {
    const lines = [[`Project: ${projectName}`], LAYER_HEADERS, ...designs.flatMap(layerRows), [], SUMMARY_HEADERS,
      ...designs.map(summaryRow), [], ['Prepared with the AASHTO 1993 Pavement Design app by Abenezer Tilahun']];
    return '﻿' + lines.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'; // BOM: Excel opens UTF-8 correctly
  }

  /** Excel workbook with a "Summary" and a "Layers" sheet. */
  async toXlsx(projectName: string, designs: ExportDesign[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AASHTO 1993 Pavement Design — Abenezer Tilahun';
    const sheets: Array<[string, string[], unknown[][]]> = [
      ['Summary', SUMMARY_HEADERS, designs.map(summaryRow)],
      ['Layers', LAYER_HEADERS, designs.flatMap(layerRows)],
    ];
    for (const [title, headers, rows] of sheets) {
      const sheet = workbook.addWorksheet(title);
      sheet.addRow([`Project: ${projectName}`]).font = { bold: true, size: 13 };
      const header = sheet.addRow(headers);
      header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      header.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563A8' } };
      });
      for (const row of rows) {
        const added = sheet.addRow(row);
        const verdict = String(row[title === 'Summary' ? 1 : row.length - 1]);
        added.getCell(title === 'Summary' ? 2 : row.length).font = {
          bold: true, color: { argb: verdict.startsWith('NOT') ? 'FFB42318' : 'FF1F7A3D' },
        };
      }
      sheet.columns.forEach((column, i) => { column.width = Math.max(10, headers[i]?.length ?? 10) + 4; });
      sheet.views = [{ state: 'frozen', ySplit: 2 }];
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
