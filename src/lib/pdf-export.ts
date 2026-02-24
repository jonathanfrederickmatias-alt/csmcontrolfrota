import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function exportElementToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element "${elementId}" not found`);
    return;
  }

  // Temporarily make element fully visible for capture
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
