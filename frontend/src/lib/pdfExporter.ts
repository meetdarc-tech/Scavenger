import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface WasteData {
  id: string;
  type: string;
  weight: number;
  status: string;
  date: Date;
  location?: {
    lat: number;
    lon: number;
  };
  verificationStatus?: string;
  notes?: string;
}

export interface PDFExportOptions {
  title?: string;
  includeMetadata?: boolean;
  includeCharts?: boolean;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter';
}

export class PDFExporter {
  private doc: jsPDF;

  constructor(options: PDFExportOptions = {}) {
    this.doc = new jsPDF({
      orientation: options.orientation || 'portrait',
      unit: 'mm',
      format: options.format || 'a4',
    });
  }

  private addHeader(title: string): void {
    this.doc.setFontSize(20);
    this.doc.text(title, 15, 20);

    this.doc.setFontSize(10);
    this.doc.setTextColor(100);
    this.doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 28);

    this.doc.setDrawColor(200);
    this.doc.line(15, 32, 195, 32);
  }

  private addFooter(): void {
    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(150);
      this.doc.text(
        `Page ${i} of ${pageCount}`,
        this.doc.internal.pageSize.getWidth() / 2,
        this.doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
  }

  exportWasteData(
    wastes: WasteData[],
    options: PDFExportOptions = {}
  ): jsPDF {
    const title = options.title || 'Waste Report';
    this.addHeader(title);

    let yPosition = 40;

    // Summary Section
    if (options.includeMetadata) {
      this.doc.setFontSize(12);
      this.doc.setTextColor(0);
      this.doc.text('Summary', 15, yPosition);
      yPosition += 8;

      this.doc.setFontSize(10);
      this.doc.setTextColor(80);
      const totalWeight = wastes.reduce((sum, w) => sum + w.weight, 0);
      const verifiedCount = wastes.filter(
        (w) => w.verificationStatus === 'verified'
      ).length;

      this.doc.text(`Total Items: ${wastes.length}`, 15, yPosition);
      yPosition += 6;
      this.doc.text(`Total Weight: ${totalWeight.toFixed(2)} kg`, 15, yPosition);
      yPosition += 6;
      this.doc.text(`Verified Items: ${verifiedCount}`, 15, yPosition);
      yPosition += 12;
    }

    // Data Table
    const tableData = wastes.map((waste) => [
      waste.id,
      waste.type,
      waste.weight.toFixed(2),
      waste.status,
      new Date(waste.date).toLocaleDateString(),
      waste.verificationStatus || 'N/A',
    ]);

    (this.doc as any).autoTable({
      head: [['ID', 'Type', 'Weight (kg)', 'Status', 'Date', 'Verification']],
      body: tableData,
      startY: yPosition,
      margin: { top: 10, right: 15, bottom: 20, left: 15 },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    });

    this.addFooter();
    return this.doc;
  }

  exportAnalytics(
    data: {
      totalWaste: number;
      wasteByType: Record<string, number>;
      verificationRate: number;
      averageWeight: number;
    },
    options: PDFExportOptions = {}
  ): jsPDF {
    const title = options.title || 'Analytics Report';
    this.addHeader(title);

    let yPosition = 40;

    this.doc.setFontSize(12);
    this.doc.setTextColor(0);
    this.doc.text('Key Metrics', 15, yPosition);
    yPosition += 8;

    this.doc.setFontSize(10);
    this.doc.setTextColor(80);

    const metrics = [
      `Total Waste Items: ${data.totalWaste}`,
      `Average Weight: ${data.averageWeight.toFixed(2)} kg`,
      `Verification Rate: ${(data.verificationRate * 100).toFixed(1)}%`,
    ];

    metrics.forEach((metric) => {
      this.doc.text(metric, 15, yPosition);
      yPosition += 6;
    });

    yPosition += 6;
    this.doc.setFontSize(12);
    this.doc.text('Waste by Type', 15, yPosition);
    yPosition += 8;

    const typeData = Object.entries(data.wasteByType).map(([type, count]) => [
      type,
      count.toString(),
    ]);

    (this.doc as any).autoTable({
      head: [['Waste Type', 'Count']],
      body: typeData,
      startY: yPosition,
      margin: { top: 10, right: 15, bottom: 20, left: 15 },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
      },
    });

    this.addFooter();
    return this.doc;
  }

  save(filename: string): void {
    this.doc.save(filename);
  }

  getBlob(): Blob {
    return this.doc.output('blob');
  }
}

export default PDFExporter;
