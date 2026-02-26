import jsPDF from 'jspdf';
import { domToPng } from 'modern-screenshot';

/**
 * Captures an HTML element and exports it as a PDF
 * @param {string} elementId - The ID of the HTML element to capture
 * @param {string} filename - The name of the PDF file
 */
export const exportToPDF = async (elementId, filename = 'financial-report.pdf') => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with id ${elementId} not found`);
        return;
    }

    try {
        // Hide elements that shouldn't be in the PDF (like action buttons)
        const actionButtons = element.querySelectorAll('.pdf-hide');
        actionButtons.forEach(btn => {
            btn.dataset.prevDisplay = btn.style.display;
            btn.style.display = 'none';
        });

        // Use modern-screenshot to handle oklch colors and modern CSS
        const imgData = await domToPng(element, {
            scale: 2,
            backgroundColor: '#050511', // Match app background precisely
            quality: 1
        });

        // Restore hidden elements
        actionButtons.forEach(btn => {
            btn.style.display = btn.dataset.prevDisplay || '';
        });

        const pdf = new jsPDF({
            orientation: element.offsetWidth > element.offsetHeight ? 'l' : 'p',
            unit: 'px',
            format: [element.offsetWidth * 2, element.offsetHeight * 2]
        });

        const width = pdf.internal.pageSize.getWidth();
        const height = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save(filename);
    } catch (error) {
        console.error('Error generating PDF:', error);
    }
};
