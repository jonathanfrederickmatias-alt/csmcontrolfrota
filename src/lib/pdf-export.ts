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
      backgroundColor: '#f0f3f8',
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
  primary: [25, 75, 155] as [number, number, number],     // Blue brand (matching logo)
  primaryDark: [15, 55, 120] as [number, number, number],
  dark: [240, 243, 248] as [number, number, number],       // Light background
  cardBg: [255, 255, 255] as [number, number, number],     // White cards
  headerBg: [230, 235, 245] as [number, number, number],   // Light gray header
  rowAlt: [245, 247, 250] as [number, number, number],     // Light alternating rows
  text: [30, 35, 50] as [number, number, number],          // Dark text
  textMuted: [100, 110, 130] as [number, number, number],  // Muted text
  success: [34, 160, 80] as [number, number, number],
  warning: [220, 140, 10] as [number, number, number],
  danger: [210, 50, 50] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [210, 215, 225] as [number, number, number],
};

/** Truncate text to fit within maxWidth mm at current font size */
function clipText(pdf: jsPDF, text: string, maxWidth: number): string {
  if (!text) return '—';
  if (pdf.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && pdf.getTextWidth(t + '…') > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

// Cache for logo image data
let logoCache: string | null = null;

async function loadLogoAsBase64(): Promise<string | null> {
  if (logoCache) return logoCache;
  try {
    const response = await fetch('/csm-logo.png');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        logoCache = reader.result as string;
        resolve(logoCache);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addHeader(pdf: jsPDF, title: string, subtitle: string, logoData?: string | null) {
  // White header band with blue accent
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), 38, 'F');
  // Blue bottom border
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, 36, pdf.internal.pageSize.getWidth(), 2, 'F');

  // Logo
  if (logoData) {
    pdf.addImage(logoData, 'PNG', 12, 5, 26, 26);
  }

  const textX = logoData ? 42 : 15;

  // Company name in blue
  pdf.setTextColor(...COLORS.primary);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CSM CONSTRUÇÕES', textX, 16);

  // Title
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...COLORS.text);
  pdf.text(title, textX, 25);

  // Subtitle / date
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.textMuted);
  pdf.text(subtitle, textX, 32);

  // Right side - generation date
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.textMuted);
  pdf.text(`Emitido em: ${dateStr}`, pdf.internal.pageSize.getWidth() - 15, 16, { align: 'right' });

  // System name
  pdf.setFontSize(7);
  pdf.setTextColor(...COLORS.primary);
  pdf.text('CSMCONTROLFROTA', pdf.internal.pageSize.getWidth() - 15, 25, { align: 'right' });
}

function addFooter(pdf: jsPDF, pageNum: number, totalPages: number) {
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(245, 247, 250);
  pdf.rect(0, ph - 12, pw, 12, 'F');
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, ph - 12, pw, 0.5, 'F');
  pdf.setFontSize(7);
  pdf.setTextColor(...COLORS.textMuted);
  pdf.text('CSMCONTROLFROTA — Relatório gerado automaticamente pelo sistema', 15, ph - 5);
  pdf.text(`Página ${pageNum} de ${totalPages}`, pw - 15, ph - 5, { align: 'right' });
}

function checkPageBreak(pdf: jsPDF, y: number, needed: number): number {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 18) {
    pdf.addPage();
    pdf.setFillColor(...COLORS.dark);
    pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');
    return 15;
  }
  return y;
}

function drawSummaryCard(pdf: jsPDF, x: number, y: number, w: number, label: string, value: string, color: [number, number, number]) {
  // Card background with border
  pdf.setFillColor(...COLORS.cardBg);
  pdf.roundedRect(x, y, w, 22, 2, 2, 'F');
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(x, y, w, 22, 2, 2, 'S');

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
export async function exportMaintenancePlansPDF(
  plans: PlanRow[],
  filterName: string
) {
  const logoData = await loadLogoAsBase64();
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pageWidth = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // Background
  pdf.setFillColor(...COLORS.dark);
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');

  const subtitleParts = [`Filtro: ${filterName}`];
  addHeader(pdf, 'Relatório de Planos de Manutenção Preventiva', subtitleParts.join(' | '), logoData);

  let y = 46;

  // Summary cards
  const okCount = plans.filter(p => p.status === 'ok').length;
  const approachingCount = plans.filter(p => p.status === 'approaching').length;
  const overdueCount = plans.filter(p => p.status === 'overdue').length;
  const cardW = (contentWidth - 9) / 4;

  drawSummaryCard(pdf, margin, y, cardW, 'Total de Planos', String(plans.length), COLORS.primary);
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

    pdf.setTextColor(...COLORS.text);
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
    const colWidths = [120, 22, 22, 24, 24, 24, 37];
    const colHeaders = ['Serviço', 'Intervalo', 'Próxima', 'Faltam', 'Status', 'Última (h)', 'Última Execução'];
    const colX = [margin];
    for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);

    pdf.setFillColor(220, 228, 240);
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
      pdf.text(clipText(pdf, plan.description, colWidths[0] - 4), colX[0] + 2, y + 4.5);

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
export async function exportMaintenanceRequestsPDF(
  requests: RequestRow[],
  filterName: string
) {
  const logoData = await loadLogoAsBase64();
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  pdf.setFillColor(...COLORS.dark);
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');

  addHeader(pdf, 'Relatório de Pedidos de Manutenção', `Filtro: ${filterName}`, logoData);

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

  pdf.setFillColor(220, 228, 240);
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
    pdf.text(clipText(pdf, r.equipment, colWidths[0] - 4), colX[0] + 2, y + 4.5);
    pdf.text(clipText(pdf, r.description, colWidths[1] - 4), colX[1] + 2, y + 4.5);

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
    pdf.text(clipText(pdf, r.operator, colWidths[4] - 4), colX[4] + 2, y + 4.5);
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
export async function exportMaintenanceHistoryPDF(
  records: HistoryRow[],
  filterName: string
) {
  const logoData = await loadLogoAsBase64();
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  pdf.setFillColor(...COLORS.dark);
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');

  addHeader(pdf, 'Relatório de Histórico de Manutenção', `Filtro: ${filterName} | Total: ${records.length} registros`, logoData);

  let y = 46;

  // Summary card
  drawSummaryCard(pdf, margin, y, contentWidth, 'Total de Manutenções Registradas', String(records.length), COLORS.primary);
  y += 30;

  // Table
  const colWidths = [35, 40, 18, 25, 25, 43];
  const colHeaders = ['Equipamento', 'Descrição', 'Horímetro', 'Data', 'Responsável', 'Plano Vinculado'];
  const colX = [margin];
  for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);

  pdf.setFillColor(220, 228, 240);
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
    pdf.text(clipText(pdf, r.equipment, colWidths[0] - 4), colX[0] + 2, y + 4.5);
    pdf.text(clipText(pdf, r.description, colWidths[1] - 4), colX[1] + 2, y + 4.5);

    pdf.setTextColor(...COLORS.textMuted);
    pdf.text(`${r.hourMeter}h`, colX[2] + 2, y + 4.5);
    pdf.text(r.executedAt, colX[3] + 2, y + 4.5);
    pdf.text(clipText(pdf, r.operator || '—', colWidths[4] - 4), colX[4] + 2, y + 4.5);
    pdf.text(clipText(pdf, r.planDescription || '—', colWidths[5] - 4), colX[5] + 2, y + 4.5);

    y += 6.5;
  });

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter(pdf, i, totalPages);
  }

  pdf.save(`Historico_Manutencao_${filterName.replace(/\s/g, '_')}.pdf`);
}

// ===== WORK ORDERS (OS) REPORT =====
interface WorkOrderRow {
  osNumber: number;
  equipment: string;
  description: string;
  priority: string;
  status: string;
  mechanic: string;
  parts?: string;
  date: string;
  startedAt?: string;
  completedAt?: string;
}

export async function exportWorkOrdersPDF(
  orders: WorkOrderRow[],
  filterName: string
) {
  const logoData = await loadLogoAsBase64();
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  pdf.setFillColor(...COLORS.dark);
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');

  addHeader(pdf, 'Relatório de Ordens de Serviço', `Filtro: ${filterName} | Total: ${orders.length} OS`, logoData);

  let y = 46;

  const openCount = orders.filter(o => o.status === 'Aberta').length;
  const progressCount = orders.filter(o => o.status === 'Em andamento').length;
  const doneCount = orders.filter(o => o.status === 'Concluída').length;
  const cardW = (contentWidth - 6) / 3;

  drawSummaryCard(pdf, margin, y, cardW, 'Abertas', String(openCount), COLORS.warning);
  drawSummaryCard(pdf, margin + cardW + 3, y, cardW, 'Em andamento', String(progressCount), COLORS.primary);
  drawSummaryCard(pdf, margin + (cardW + 3) * 2, y, cardW, 'Concluídas', String(doneCount), COLORS.success);

  y += 30;

  const colWidths = [10, 26, 30, 16, 18, 20, 26, 18, 22];
  const colHeaders = ['OS #', 'Equipamento', 'Descrição', 'Prioridade', 'Status', 'Mecânico', 'Peças', 'Início', 'Concl.'];
  const colX = [margin];
  for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);

  pdf.setFillColor(220, 228, 240);
  pdf.rect(margin, y, contentWidth, 6, 'F');
  pdf.setTextColor(...COLORS.textMuted);
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'bold');
  colHeaders.forEach((h, i) => pdf.text(h, colX[i] + 2, y + 4));
  y += 6;

  orders.forEach((o, idx) => {
    y = checkPageBreak(pdf, y, 7);

    if (idx % 2 === 1) {
      pdf.setFillColor(...COLORS.rowAlt);
      pdf.rect(margin, y, contentWidth, 6.5, 'F');
    }

    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...COLORS.primary);
    pdf.text(String(o.osNumber), colX[0] + 2, y + 4.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...COLORS.text);
    pdf.text(clipText(pdf, o.equipment, colWidths[1] - 4), colX[1] + 2, y + 4.5);
    pdf.text(clipText(pdf, o.description, colWidths[2] - 4), colX[2] + 2, y + 4.5);

    const prioColor = o.priority === 'Urgente' ? COLORS.danger : o.priority === 'Alta' ? COLORS.warning : o.priority === 'Média' ? COLORS.primary : COLORS.textMuted;
    pdf.setTextColor(...prioColor);
    pdf.setFont('helvetica', 'bold');
    pdf.text(o.priority, colX[3] + 2, y + 4.5);

    const statusColor = o.status === 'Concluída' ? COLORS.success : o.status === 'Em andamento' ? COLORS.primary : COLORS.textMuted;
    pdf.setTextColor(...statusColor);
    pdf.text(o.status, colX[4] + 2, y + 4.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...COLORS.textMuted);
    pdf.text(clipText(pdf, o.mechanic || '—', colWidths[5] - 4), colX[5] + 2, y + 4.5);
    pdf.text(clipText(pdf, o.parts || '—', colWidths[6] - 4), colX[6] + 2, y + 4.5);
    pdf.text(o.startedAt || '—', colX[7] + 2, y + 4.5);
    pdf.text(o.completedAt || '—', colX[8] + 2, y + 4.5);

    y += 6.5;
  });

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter(pdf, i, totalPages);
  }

  pdf.save(`Ordens_Servico_${filterName.replace(/\s/g, '_')}.pdf`);
}

// ===== GENERAL REPORTS PDF =====
interface GeneralReportData {
  period: string;
  filterName: string;
  totalFuel: number;
  totalChecklists: number;
  activeEquipments: number;
  overdueMaintenances: number;
  fuelByEquipment: { name: string; litros: number }[];
  fuelByDay: { date: string; litros: number }[];
  hoursByEquipment: { name: string; horimetro: number }[];
  checklistStatus: { name: string; value: number }[];
  maintenanceStatus: { name: string; value: number; color: string }[];
  fuelRecords: { date: string; equipment: string; combo: string; liters: number; operator: string }[];
  checklistRecords: { date: string; equipment: string; operator: string; hourMeter: number; status: string }[];
  maintenancePlans: { equipment: string; description: string; interval: number; nextDue: number; status: string; lastExec: string }[];
}

export async function exportGeneralReportsPDF(data: GeneralReportData) {
  const logoData = await loadLogoAsBase64();
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  pdf.setFillColor(...COLORS.dark);
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');

  addHeader(pdf, 'Relatório Geral de Frota e Operações', `Período: ${data.period} | Equipamento: ${data.filterName}`, logoData);

  let y = 46;

  // KPI Summary Cards
  const cardW = (contentWidth - 9) / 4;
  drawSummaryCard(pdf, margin, y, cardW, 'Combustível (L)', data.totalFuel.toLocaleString('pt-BR'), COLORS.primary);
  drawSummaryCard(pdf, margin + cardW + 3, y, cardW, 'Checklists', String(data.totalChecklists), COLORS.success);
  drawSummaryCard(pdf, margin + (cardW + 3) * 2, y, cardW, 'Manutenções Atrasadas', String(data.overdueMaintenances), COLORS.danger);
  drawSummaryCard(pdf, margin + (cardW + 3) * 3, y, cardW, 'Equipamentos Ativos', String(data.activeEquipments), COLORS.warning);
  y += 30;

  // === FUEL BY EQUIPMENT TABLE ===
  if (data.fuelByEquipment.length > 0) {
    y = checkPageBreak(pdf, y, 20);
    pdf.setFillColor(...COLORS.headerBg);
    pdf.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    pdf.setFillColor(...COLORS.primary);
    pdf.rect(margin, y, 3, 8, 'F');
    pdf.setTextColor(...COLORS.text);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Consumo de Combustível por Equipamento', margin + 6, y + 5.5);
    y += 10;

    const fColW = [90, 96];
    const fColX = [margin, margin + fColW[0]];
    pdf.setFillColor(220, 228, 240);
    pdf.rect(margin, y, contentWidth, 6, 'F');
    pdf.setTextColor(...COLORS.textMuted);
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Equipamento', fColX[0] + 2, y + 4);
    pdf.text('Litros Consumidos', fColX[1] + 2, y + 4);
    y += 6;

    data.fuelByEquipment.forEach((item, idx) => {
      y = checkPageBreak(pdf, y, 7);
      if (idx % 2 === 1) { pdf.setFillColor(...COLORS.rowAlt); pdf.rect(margin, y, contentWidth, 6.5, 'F'); }
      pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.text);
      pdf.text(item.name, fColX[0] + 2, y + 4.5);
      pdf.setTextColor(...COLORS.primary);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${item.litros.toLocaleString('pt-BR')}L`, fColX[1] + 2, y + 4.5);
      y += 6.5;
    });
    y += 6;
  }

  // === FUEL BY DAY TABLE ===
  if (data.fuelByDay.length > 0) {
    y = checkPageBreak(pdf, y, 20);
    pdf.setFillColor(...COLORS.headerBg);
    pdf.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    pdf.setFillColor(...COLORS.primary);
    pdf.rect(margin, y, 3, 8, 'F');
    pdf.setTextColor(...COLORS.text);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Consumo Diário de Combustível', margin + 6, y + 5.5);
    y += 10;

    const dColW = [90, 96];
    const dColX = [margin, margin + dColW[0]];
    pdf.setFillColor(220, 228, 240);
    pdf.rect(margin, y, contentWidth, 6, 'F');
    pdf.setTextColor(...COLORS.textMuted);
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Data', dColX[0] + 2, y + 4);
    pdf.text('Litros', dColX[1] + 2, y + 4);
    y += 6;

    data.fuelByDay.forEach((item, idx) => {
      y = checkPageBreak(pdf, y, 7);
      if (idx % 2 === 1) { pdf.setFillColor(...COLORS.rowAlt); pdf.rect(margin, y, contentWidth, 6.5, 'F'); }
      pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.text);
      pdf.text(item.date, dColX[0] + 2, y + 4.5);
      pdf.setTextColor(...COLORS.warning);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${item.litros.toLocaleString('pt-BR')}L`, dColX[1] + 2, y + 4.5);
      y += 6.5;
    });
    y += 6;
  }

  // === HORIMETER TABLE ===
  if (data.hoursByEquipment.length > 0) {
    y = checkPageBreak(pdf, y, 20);
    pdf.setFillColor(...COLORS.headerBg);
    pdf.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    pdf.setFillColor(...COLORS.warning);
    pdf.rect(margin, y, 3, 8, 'F');
    pdf.setTextColor(...COLORS.text);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Horímetro Atual por Equipamento', margin + 6, y + 5.5);
    y += 10;

    const hColW = [90, 96];
    const hColX = [margin, margin + hColW[0]];
    pdf.setFillColor(220, 228, 240);
    pdf.rect(margin, y, contentWidth, 6, 'F');
    pdf.setTextColor(...COLORS.textMuted);
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Equipamento', hColX[0] + 2, y + 4);
    pdf.text('Horímetro (h)', hColX[1] + 2, y + 4);
    y += 6;

    data.hoursByEquipment.forEach((item, idx) => {
      y = checkPageBreak(pdf, y, 7);
      if (idx % 2 === 1) { pdf.setFillColor(...COLORS.rowAlt); pdf.rect(margin, y, contentWidth, 6.5, 'F'); }
      pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.text);
      pdf.text(item.name, hColX[0] + 2, y + 4.5);
      pdf.setTextColor(...COLORS.warning);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${item.horimetro.toLocaleString('pt-BR')}h`, hColX[1] + 2, y + 4.5);
      y += 6.5;
    });
    y += 6;
  }

  // === CHECKLIST STATUS SUMMARY ===
  if (data.checklistStatus.length > 0) {
    y = checkPageBreak(pdf, y, 30);
    pdf.setFillColor(...COLORS.headerBg);
    pdf.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    pdf.setFillColor(...COLORS.success);
    pdf.rect(margin, y, 3, 8, 'F');
    pdf.setTextColor(...COLORS.text);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Status dos Checklists', margin + 6, y + 5.5);
    y += 12;

    const statusColors: Record<string, [number, number, number]> = { 'OK': COLORS.success, 'Atenção': COLORS.warning, 'Crítico': COLORS.danger };
    const totalCL = data.checklistStatus.reduce((s, c) => s + c.value, 0);
    data.checklistStatus.forEach(item => {
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...(statusColors[item.name] || COLORS.text));
      const pct = totalCL > 0 ? ((item.value / totalCL) * 100).toFixed(0) : '0';
      pdf.text(`${item.name}: ${item.value} (${pct}%)`, margin + 4, y);
      y += 6;
    });
    y += 4;
  }

  // === MAINTENANCE STATUS SUMMARY ===
  if (data.maintenanceStatus.some(s => s.value > 0)) {
    y = checkPageBreak(pdf, y, 30);
    pdf.setFillColor(...COLORS.headerBg);
    pdf.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    pdf.setFillColor(...COLORS.warning);
    pdf.rect(margin, y, 3, 8, 'F');
    pdf.setTextColor(...COLORS.text);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Status dos Planos de Manutenção', margin + 6, y + 5.5);
    y += 12;

    const mStatusColors: Record<string, [number, number, number]> = { 'OK': COLORS.success, 'Próxima': COLORS.warning, 'Atrasada': COLORS.danger };
    data.maintenanceStatus.forEach(item => {
      if (item.value > 0) {
        pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...(mStatusColors[item.name] || COLORS.text));
        pdf.text(`${item.name}: ${item.value}`, margin + 4, y);
        y += 6;
      }
    });
    y += 4;
  }

  // === DETAILED FUEL RECORDS ===
  if (data.fuelRecords.length > 0) {
    y = checkPageBreak(pdf, y, 20);
    pdf.setFillColor(...COLORS.headerBg);
    pdf.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    pdf.setFillColor(...COLORS.primary);
    pdf.rect(margin, y, 3, 8, 'F');
    pdf.setTextColor(...COLORS.text);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Detalhamento de Abastecimentos', margin + 6, y + 5.5);
    y += 10;

    const rColW = [22, 45, 45, 22, 52];
    const rColX = [margin];
    for (let i = 1; i < rColW.length; i++) rColX.push(rColX[i - 1] + rColW[i - 1]);
    const rHeaders = ['Data', 'Equipamento', 'Comboio', 'Litros', 'Responsável'];

    pdf.setFillColor(220, 228, 240);
    pdf.rect(margin, y, contentWidth, 6, 'F');
    pdf.setTextColor(...COLORS.textMuted);
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    rHeaders.forEach((h, i) => pdf.text(h, rColX[i] + 2, y + 4));
    y += 6;

    data.fuelRecords.forEach((r, idx) => {
      y = checkPageBreak(pdf, y, 7);
      if (idx % 2 === 1) { pdf.setFillColor(...COLORS.rowAlt); pdf.rect(margin, y, contentWidth, 6.5, 'F'); }
      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.text);
      pdf.text(r.date, rColX[0] + 2, y + 4.5);
      pdf.text(clipText(pdf, r.equipment, rColW[1] - 4), rColX[1] + 2, y + 4.5);
      pdf.text(clipText(pdf, r.combo, rColW[2] - 4), rColX[2] + 2, y + 4.5);
      pdf.setTextColor(...COLORS.primary);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${r.liters}L`, rColX[3] + 2, y + 4.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.textMuted);
      pdf.text(clipText(pdf, r.operator, rColW[4] - 4), rColX[4] + 2, y + 4.5);
      y += 6.5;
    });
    y += 6;
  }

  // === DETAILED CHECKLISTS ===
  if (data.checklistRecords.length > 0) {
    y = checkPageBreak(pdf, y, 20);
    pdf.setFillColor(...COLORS.headerBg);
    pdf.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    pdf.setFillColor(...COLORS.success);
    pdf.rect(margin, y, 3, 8, 'F');
    pdf.setTextColor(...COLORS.text);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Detalhamento de Checklists', margin + 6, y + 5.5);
    y += 10;

    const cColW = [22, 50, 42, 28, 44];
    const cColX = [margin];
    for (let i = 1; i < cColW.length; i++) cColX.push(cColX[i - 1] + cColW[i - 1]);
    const cHeaders = ['Data', 'Equipamento', 'Operador', 'Horímetro', 'Status'];

    pdf.setFillColor(220, 228, 240);
    pdf.rect(margin, y, contentWidth, 6, 'F');
    pdf.setTextColor(...COLORS.textMuted);
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    cHeaders.forEach((h, i) => pdf.text(h, cColX[i] + 2, y + 4));
    y += 6;

    data.checklistRecords.forEach((c, idx) => {
      y = checkPageBreak(pdf, y, 7);
      if (idx % 2 === 1) { pdf.setFillColor(...COLORS.rowAlt); pdf.rect(margin, y, contentWidth, 6.5, 'F'); }
      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.text);
      pdf.text(c.date, cColX[0] + 2, y + 4.5);
      pdf.text(clipText(pdf, c.equipment, cColW[1] - 4), cColX[1] + 2, y + 4.5);
      pdf.text(clipText(pdf, c.operator, cColW[2] - 4), cColX[2] + 2, y + 4.5);
      pdf.setTextColor(...COLORS.textMuted);
      pdf.text(`${c.hourMeter}h`, cColX[3] + 2, y + 4.5);
      const sColor = c.status === 'OK' ? COLORS.success : c.status === 'Atenção' ? COLORS.warning : COLORS.danger;
      pdf.setTextColor(...sColor);
      pdf.setFont('helvetica', 'bold');
      pdf.text(c.status, cColX[4] + 2, y + 4.5);
      y += 6.5;
    });
    y += 6;
  }

  // === MAINTENANCE PLANS ===
  if (data.maintenancePlans.length > 0) {
    y = checkPageBreak(pdf, y, 20);
    pdf.setFillColor(...COLORS.headerBg);
    pdf.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    pdf.setFillColor(...COLORS.warning);
    pdf.rect(margin, y, 3, 8, 'F');
    pdf.setTextColor(...COLORS.text);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Planos de Manutenção', margin + 6, y + 5.5);
    y += 10;

    const mColW = [40, 42, 22, 22, 22, 38];
    const mColX = [margin];
    for (let i = 1; i < mColW.length; i++) mColX.push(mColX[i - 1] + mColW[i - 1]);
    const mHeaders = ['Equipamento', 'Descrição', 'Intervalo', 'Próxima', 'Status', 'Última Execução'];

    pdf.setFillColor(220, 228, 240);
    pdf.rect(margin, y, contentWidth, 6, 'F');
    pdf.setTextColor(...COLORS.textMuted);
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    mHeaders.forEach((h, i) => pdf.text(h, mColX[i] + 2, y + 4));
    y += 6;

    data.maintenancePlans.forEach((p, idx) => {
      y = checkPageBreak(pdf, y, 7);
      if (idx % 2 === 1) { pdf.setFillColor(...COLORS.rowAlt); pdf.rect(margin, y, contentWidth, 6.5, 'F'); }
      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.text);
      pdf.text(clipText(pdf, p.equipment, mColW[0] - 4), mColX[0] + 2, y + 4.5);
      pdf.text(clipText(pdf, p.description, mColW[1] - 4), mColX[1] + 2, y + 4.5);
      pdf.setTextColor(...COLORS.textMuted);
      pdf.text(`${p.interval}h`, mColX[2] + 2, y + 4.5);
      pdf.text(`${p.nextDue}h`, mColX[3] + 2, y + 4.5);
      const sColor = p.status === 'OK' ? COLORS.success : p.status === 'Próxima' ? COLORS.warning : COLORS.danger;
      pdf.setTextColor(...sColor);
      pdf.setFont('helvetica', 'bold');
      pdf.text(p.status, mColX[4] + 2, y + 4.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.textMuted);
      pdf.text(p.lastExec, mColX[5] + 2, y + 4.5);
      y += 6.5;
    });
  }

  // Page numbers
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter(pdf, i, totalPages);
  }

  pdf.save(`CSM_Relatorio_Geral_${data.period}_${data.filterName.replace(/\s/g, '_')}.pdf`);
}
