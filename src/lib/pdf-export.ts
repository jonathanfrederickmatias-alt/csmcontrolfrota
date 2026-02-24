import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function exportElementToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element "${elementId}" not found`);
    return;
  }

  const originalOverflow = element.style.overflow;
  element.style.overflow = 'visible';

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#0f1117',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const imgWidth = 190;
    const pageHeight = 277;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    element.style.overflow = originalOverflow;
  }
}

// ========== Professional Report PDF ==========

interface PlanRow {
  equipment: string;
  description: string;
  intervalHours: number;
  nextDueAt: number;
  lastDoneAt: number;
  currentHM: number;
  remaining: number;
  status: 'ok' | 'approaching' | 'overdue';
  lastExecuted?: string;
}

interface RequestRow {
  equipment: string;
  description: string;
  priority: string;
  status: string;
  operator: string;
  date: string;
  resolvedAt?: string;
  notes?: string;
}

interface HistoryRow {
  equipment: string;
  description: string;
  hourMeter: number;
  executedAt: string;
  operator?: string;
  notes?: string;
  planDescription?: string;
}

const COLORS = {
  primary: [220, 40, 40] as [number, number, number],     // Red brand
  primaryDark: [180, 30, 30] as [number, number, number],
  dark: [15, 17, 23] as [number, number, number],
  cardBg: [22, 25, 35] as [number, number, number],
  headerBg: [30, 34, 48] as [number, number, number],
  rowAlt: [18, 21, 30] as [number, number, number],
  text: [230, 230, 235] as [number, number, number],
  textMuted: [140, 145, 160] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [45, 50, 65] as [number, number, number],
};

function addHeader(pdf: jsPDF, title: string, subtitle: string) {
  // Dark background header band
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, 0, 210, 38, 'F');

  // Company name
  pdf.setTextColor(...COLORS.white);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CSM CONTROL', 15, 16);

  // Title
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(title, 15, 25);

  // Subtitle / date
  pdf.setFontSize(8);
  pdf.setTextColor(255, 220, 220);
  pdf.text(subtitle, 15, 32);

  // Right side - generation date
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.white);
  pdf.text(`Emitido em: ${dateStr}`, 195, 16, { align: 'right' });

  // Logo placeholder text
  pdf.setFontSize(7);
  pdf.setTextColor(255, 200, 200);
  pdf.text('Sistema de Gestão de Frota', 195, 25, { align: 'right' });
}

function addFooter(pdf: jsPDF, pageNum: number, totalPages: number) {
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(...COLORS.headerBg);
  pdf.rect(0, pageHeight - 12, 210, 12, 'F');
  pdf.setFontSize(7);
  pdf.setTextColor(...COLORS.textMuted);
  pdf.text('CSM CONTROL — Relatório gerado automaticamente pelo sistema', 15, pageHeight - 5);
  pdf.text(`Página ${pageNum} de ${totalPages}`, 195, pageHeight - 5, { align: 'right' });
}

function checkPageBreak(pdf: jsPDF, y: number, needed: number): number {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 18) {
    pdf.addPage();
    pdf.setFillColor(...COLORS.dark);
    pdf.rect(0, 0, 210, pdf.internal.pageSize.getHeight(), 'F');
    return 15;
  }
  return y;
}

function drawSummaryCard(pdf: jsPDF, x: number, y: number, w: number, label: string, value: string, color: [number, number, number]) {
  // Card background
  pdf.setFillColor(...COLORS.cardBg);
  pdf.roundedRect(x, y, w, 22, 2, 2, 'F');

  // Color accent line on top
  pdf.setFillColor(...color);
  pdf.rect(x, y, w, 2, 'F');

  // Value
  pdf.setTextColor(...color);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(value, x + w / 2, y + 11, { align: 'center' });

  // Label
  pdf.setTextColor(...COLORS.textMuted);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text(label, x + w / 2, y + 18, { align: 'center' });
}

// ===== PLANS REPORT =====
export function exportMaintenancePlansPDF(
  plans: PlanRow[],
  filterName: string
) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // Background
  pdf.setFillColor(...COLORS.dark);
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');

  const subtitleParts = [`Filtro: ${filterName}`];
  addHeader(pdf, 'Relatório de Planos de Manutenção Preventiva', subtitleParts.join(' | '));

  let y = 46;

  // Summary cards
  const okCount = plans.filter(p => p.status === 'ok').length;
  const approachingCount = plans.filter(p => p.status === 'approaching').length;
  const overdueCount = plans.filter(p => p.status === 'overdue').length;
  const cardW = (contentWidth - 9) / 4;

  drawSummaryCard(pdf, margin, y, cardW, 'Total de Planos', String(plans.length), COLORS.white);
  drawSummaryCard(pdf, margin + cardW + 3, y, cardW, 'Em dia (OK)', String(okCount), COLORS.success);
  drawSummaryCard(pdf, margin + (cardW + 3) * 2, y, cardW, 'Próximas', String(approachingCount), COLORS.warning);
  drawSummaryCard(pdf, margin + (cardW + 3) * 3, y, cardW, 'Atrasadas', String(overdueCount), COLORS.danger);

  y += 30;

  // Group plans by equipment
  const grouped: Record<string, PlanRow[]> = {};
  plans.forEach(p => {
    if (!grouped[p.equipment]) grouped[p.equipment] = [];
    grouped[p.equipment].push(p);
  });

  const equipNames = Object.keys(grouped).sort();

  for (const equipName of equipNames) {
    const eqPlans = grouped[equipName];

    y = checkPageBreak(pdf, y, 30);

    // Equipment header
    pdf.setFillColor(...COLORS.headerBg);
    pdf.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    pdf.setFillColor(...COLORS.primary);
    pdf.rect(margin, y, 3, 8, 'F');

    pdf.setTextColor(...COLORS.white);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text(equipName, margin + 6, y + 5.5);

    // Equipment horimiter
    if (eqPlans.length > 0) {
      pdf.setTextColor(...COLORS.textMuted);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Horímetro atual: ${eqPlans[0].currentHM}h`, margin + contentWidth - 2, y + 5.5, { align: 'right' });
    }

    y += 10;

    // Table header
    const colWidths = [50, 18, 18, 20, 22, 22, 36];
    const colHeaders = ['Serviço', 'Intervalo', 'Próxima', 'Faltam', 'Status', 'Última (h)', 'Última Execução'];
    const colX = [margin];
    for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);

    pdf.setFillColor(35, 38, 52);
    pdf.rect(margin, y, contentWidth, 6, 'F');
    pdf.setTextColor(...COLORS.textMuted);
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    colHeaders.forEach((h, i) => {
      pdf.text(h, colX[i] + 2, y + 4);
    });
    y += 6;

    // Rows
    eqPlans.forEach((plan, idx) => {
      y = checkPageBreak(pdf, y, 7);

      if (idx % 2 === 1) {
        pdf.setFillColor(...COLORS.rowAlt);
        pdf.rect(margin, y, contentWidth, 6.5, 'F');
      }

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.text);
      pdf.text(plan.description, colX[0] + 2, y + 4.5);

      pdf.setTextColor(...COLORS.textMuted);
      pdf.text(`${plan.intervalHours}h`, colX[1] + 2, y + 4.5);
      pdf.text(`${plan.nextDueAt}h`, colX[2] + 2, y + 4.5);

      // Remaining with color
      const remaining = plan.remaining;
      if (remaining <= 0) {
        pdf.setTextColor(...COLORS.danger);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${Math.abs(remaining)}h atrás`, colX[3] + 2, y + 4.5);
      } else if (plan.status === 'approaching') {
        pdf.setTextColor(...COLORS.warning);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${remaining}h`, colX[3] + 2, y + 4.5);
      } else {
        pdf.setTextColor(...COLORS.success);
        pdf.text(`${remaining}h`, colX[3] + 2, y + 4.5);
      }

      // Status badge
      const statusLabel = plan.status === 'ok' ? 'OK' : plan.status === 'approaching' ? 'Próxima' : 'Atrasada';
      const statusColor = plan.status === 'ok' ? COLORS.success : plan.status === 'approaching' ? COLORS.warning : COLORS.danger;
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...statusColor);
      pdf.text(statusLabel, colX[4] + 2, y + 4.5);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.textMuted);
      pdf.text(`${plan.lastDoneAt}h`, colX[5] + 2, y + 4.5);
      pdf.text(plan.lastExecuted || '—', colX[6] + 2, y + 4.5);

      y += 6.5;
    });

    y += 5;
  }

  // Add page numbers
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    if (i > 1) {
      pdf.setFillColor(...COLORS.dark);
      // Re-fill bg for added pages is already handled in checkPageBreak
    }
    addFooter(pdf, i, totalPages);
  }

  pdf.save(`Planos_Manutencao_${filterName.replace(/\s/g, '_')}.pdf`);
}

// ===== REQUESTS REPORT =====
export function exportMaintenanceRequestsPDF(
  requests: RequestRow[],
  filterName: string
) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  pdf.setFillColor(...COLORS.dark);
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');

  addHeader(pdf, 'Relatório de Pedidos de Manutenção', `Filtro: ${filterName}`);

  let y = 46;

  // Summary
  const openCount = requests.filter(r => r.status === 'Aberto').length;
  const progressCount = requests.filter(r => r.status === 'Em andamento').length;
  const doneCount = requests.filter(r => r.status === 'Concluído').length;
  const cardW = (contentWidth - 6) / 3;

  drawSummaryCard(pdf, margin, y, cardW, 'Abertos', String(openCount), COLORS.warning);
  drawSummaryCard(pdf, margin + cardW + 3, y, cardW, 'Em andamento', String(progressCount), COLORS.primary);
  drawSummaryCard(pdf, margin + (cardW + 3) * 2, y, cardW, 'Concluídos', String(doneCount), COLORS.success);

  y += 30;

  // Table header
  const colWidths = [40, 42, 20, 22, 25, 22, 15];
  const colHeaders = ['Equipamento', 'Descrição', 'Prioridade', 'Status', 'Operador', 'Data', 'Concl.'];
  const colX = [margin];
  for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);

  pdf.setFillColor(35, 38, 52);
  pdf.rect(margin, y, contentWidth, 6, 'F');
  pdf.setTextColor(...COLORS.textMuted);
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'bold');
  colHeaders.forEach((h, i) => pdf.text(h, colX[i] + 2, y + 4));
  y += 6;

  requests.forEach((r, idx) => {
    y = checkPageBreak(pdf, y, 7);

    if (idx % 2 === 1) {
      pdf.setFillColor(...COLORS.rowAlt);
      pdf.rect(margin, y, contentWidth, 6.5, 'F');
    }

    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...COLORS.text);
    pdf.text(r.equipment.substring(0, 24), colX[0] + 2, y + 4.5);
    pdf.text(r.description.substring(0, 28), colX[1] + 2, y + 4.5);

    // Priority with color
    const prioColor = r.priority === 'Urgente' ? COLORS.danger : r.priority === 'Alta' ? COLORS.warning : r.priority === 'Média' ? COLORS.primary : COLORS.textMuted;
    pdf.setTextColor(...prioColor);
    pdf.setFont('helvetica', 'bold');
    pdf.text(r.priority, colX[2] + 2, y + 4.5);

    const statusColor = r.status === 'Concluído' ? COLORS.success : r.status === 'Em andamento' ? COLORS.primary : COLORS.textMuted;
    pdf.setTextColor(...statusColor);
    pdf.text(r.status, colX[3] + 2, y + 4.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...COLORS.textMuted);
    pdf.text(r.operator.substring(0, 16), colX[4] + 2, y + 4.5);
    pdf.text(r.date, colX[5] + 2, y + 4.5);
    pdf.text(r.resolvedAt || '—', colX[6] + 2, y + 4.5);

    y += 6.5;
  });

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter(pdf, i, totalPages);
  }

  pdf.save(`Pedidos_Manutencao_${filterName.replace(/\s/g, '_')}.pdf`);
}

// ===== HISTORY REPORT =====
export function exportMaintenanceHistoryPDF(
  records: HistoryRow[],
  filterName: string
) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  pdf.setFillColor(...COLORS.dark);
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');

  addHeader(pdf, 'Relatório de Histórico de Manutenção', `Filtro: ${filterName} | Total: ${records.length} registros`);

  let y = 46;

  // Summary card
  drawSummaryCard(pdf, margin, y, contentWidth, 'Total de Manutenções Registradas', String(records.length), COLORS.primary);
  y += 30;

  // Table
  const colWidths = [35, 40, 18, 25, 25, 43];
  const colHeaders = ['Equipamento', 'Descrição', 'Horímetro', 'Data', 'Responsável', 'Plano Vinculado'];
  const colX = [margin];
  for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);

  pdf.setFillColor(35, 38, 52);
  pdf.rect(margin, y, contentWidth, 6, 'F');
  pdf.setTextColor(...COLORS.textMuted);
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'bold');
  colHeaders.forEach((h, i) => pdf.text(h, colX[i] + 2, y + 4));
  y += 6;

  records.forEach((r, idx) => {
    y = checkPageBreak(pdf, y, 7);

    if (idx % 2 === 1) {
      pdf.setFillColor(...COLORS.rowAlt);
      pdf.rect(margin, y, contentWidth, 6.5, 'F');
    }

    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...COLORS.text);
    pdf.text(r.equipment.substring(0, 22), colX[0] + 2, y + 4.5);
    pdf.text(r.description.substring(0, 26), colX[1] + 2, y + 4.5);

    pdf.setTextColor(...COLORS.textMuted);
    pdf.text(`${r.hourMeter}h`, colX[2] + 2, y + 4.5);
    pdf.text(r.executedAt, colX[3] + 2, y + 4.5);
    pdf.text((r.operator || '—').substring(0, 16), colX[4] + 2, y + 4.5);
    pdf.text((r.planDescription || '—').substring(0, 28), colX[5] + 2, y + 4.5);

    y += 6.5;
  });

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter(pdf, i, totalPages);
  }

  pdf.save(`Historico_Manutencao_${filterName.replace(/\s/g, '_')}.pdf`);
}
