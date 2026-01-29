import jsPDF from 'jspdf';

export const generateResearchPDF = (results, userProfile, currentUser, a, b, c, d) => {
    if (!results) return;

    // Backward compatibility: Support both (scope, province...) string args AND options object
    const opts = (a && typeof a === 'object')
        ? a
        : { scope: a, province: b, query: c, logoBase64: d };

    const {
        scope = results?.jurisdiction_scope ?? 'nacional',
        province = results?.jurisdiction_province ?? 'Buenos Aires',
        query = results?.query ?? 'General',
        logoBase64 = null,
        format = 'a4',
        unit = 'mm'
    } = opts;

    const doc = new jsPDF({ unit, format });

    // --- LAYOUT CONSTANTS (Dynamic) ---
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const marginX = 20;          // Generous margin for better readability
    const marginTop = 15;
    const marginBottom = 15;

    // VERY conservative width - jsPDF font metrics are unreliable
    // A4 = 210mm, so 140mm leaves 70mm total margin (35mm each side)
    const contentWidth = 140;
    const maxY = pageHeight - marginBottom; // Maximum Y before page break

    const timestamp = new Date().toLocaleDateString();
    let pageNumber = 1;

    // --- 1. HEADER LOGIC ---
    const addHeader = (pdf, { isFirstPage = false } = {}) => {
        // Watermark (Background)
        if (logoBase64) {
            try {
                pdf.setGState(new pdf.GState({ opacity: 0.05 }));
                pdf.addImage(logoBase64, 'PNG', 45, 80, 120, 120, undefined, 'FAST');
                pdf.setGState(new pdf.GState({ opacity: 1 }));
            } catch (e) {
                // console.log("Watermark opacity skip", e);
            }
        }

        // --- Persistent Header (All Pages) ---
        if (logoBase64) {
            pdf.addImage(logoBase64, 'PNG', marginX, 10, 12, 16);
        }

        // Title
        pdf.setFontSize(13);
        pdf.setTextColor(15, 23, 42);
        pdf.text("Judic-IA: Informe Legal", marginX + 16, 16);

        // Page number (Right Aligned)
        pdf.setFontSize(9);
        pdf.setTextColor(100);
        pdf.text(`Página ${pageNumber}`, pageWidth - marginX, 16, { align: 'right' });

        pdf.setDrawColor(226, 232, 240);
        pdf.line(marginX, 22, pageWidth - marginX, 22);

        // --- First Page Specifics (Metadata) ---
        if (isFirstPage) {
            if (userProfile || currentUser) {
                pdf.setFontSize(9);
                pdf.setTextColor(71, 85, 105);

                const name = userProfile?.full_name || currentUser?.user_metadata?.full_name || 'Dr./Dra. Judic-IA';
                const matriculaRaw = userProfile?.matricula || currentUser?.user_metadata?.matricula;
                const matriculaText = matriculaRaw ? `Matrícula: ${matriculaRaw}` : null;

                // Right aligned metadata
                const lawyerLines = [name];
                if (matriculaText) lawyerLines.push(matriculaText);
                else lawyerLines.push('Matrícula: (Pendiente de registro)');

                pdf.text(lawyerLines, pageWidth - marginX, 28, { align: 'right' });
            }

            pdf.setFontSize(10);
            pdf.setTextColor(100);
            pdf.text(`Fecha: ${timestamp}`, marginX, 30);
            pdf.text(`Jurisdicción: ${scope === 'nacional' ? 'Nacional/Federal' : province}`, marginX, 35);

            pdf.setFontSize(9);
            const queryText = `Consulta: ${query || "General"}`;
            const splitQuery = pdf.splitTextToSize(queryText, contentWidth);
            pdf.text(splitQuery, marginX, 42);

            return 55; // Initial Y for First Page
        }

        return 30; // Initial Y for Subsequent Pages
    };

    let yPos = addHeader(doc, { isFirstPage: true });

    // --- 2. CONTENT UTILS ---
    const safeRender = (content) => {
        if (!content) return "";
        let text = "";
        if (typeof content === 'string') text = content;
        else if (Array.isArray(content)) {
            if (content.length > 0 && content[0].title) {
                text = content.map(c => `• ${c.title}\n  ${c.summary}\n  (Fuente: ${c.source})`).join('\n\n');
            } else {
                text = content.join('\n');
            }
        } else if (typeof content === 'object') {
            text = Object.entries(content).map(([k, v]) => `${k.toUpperCase()}:\n${v}`).join('\n\n');
        } else {
            text = String(content);
        }

        return text
            .replace(/\*\*/g, '')
            .replace(/###\s?/g, '');
    };

    const sections = [
        { title: "Normativa Aplicable", content: safeRender(results.laws) },
        { title: "Análisis de Jurisprudencia", content: safeRender(results.cases) },
        { title: "Liquidación Estimativa", content: safeRender(results.calculation) },
        { title: "Puntos de Prueba", content: safeRender(results.evidence) },
        { title: "Estrategia Recomendada", content: safeRender(results.strategy) }
    ];

    // --- 3. RENDER SECTIONS ---
    sections.forEach(section => {
        if (section.content) {
            const splitContent = doc.splitTextToSize(section.content, contentWidth);
            const sectionHeight = (splitContent.length * 5) + 15; // 5 units per line approx + header space

            if (yPos + sectionHeight > maxY) {
                doc.addPage();
                pageNumber++;
                yPos = addHeader(doc);
            }

            doc.setFontSize(14);
            doc.setTextColor(30, 41, 59);
            doc.text(section.title, marginX, yPos);

            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text(splitContent, marginX, yPos + 8);

            yPos += sectionHeight + 5;
        }
    });

    // --- 4. RENDER LINKS (Smart Wrap) ---
    if (results.links && results.links.length > 0) {
        // Section Header
        if (yPos + 15 > maxY) {
            doc.addPage();
            pageNumber++;
            yPos = addHeader(doc);
        } else {
            yPos += 10;
        }

        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        doc.text("Recursos y Enlaces Útiles", marginX, yPos);

        let linkY = yPos + 10;

        results.links.forEach(link => {
            const titleLines = doc.splitTextToSize(`• ${link.title}`, contentWidth);

            const displayUrl = link.url.length > 110 ? link.url.slice(0, 107) + "..." : link.url;
            // Indent URL slightly (marginX + 4) => reduce width
            const urlWidth = contentWidth - 4;
            const urlLines = doc.splitTextToSize(displayUrl, urlWidth);

            const neededHeight = (titleLines.length * 5) + (urlLines.length * 4) + 6;

            if (linkY + neededHeight > maxY) {
                doc.addPage();
                pageNumber++;
                linkY = addHeader(doc);
            }

            // Render Title
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text(titleLines, marginX, linkY);

            linkY += (titleLines.length * 5);

            // Render URL (Clickable)
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 255);

            // First line clickable
            doc.textWithLink(urlLines[0], marginX + 4, linkY, { url: link.url });

            if (urlLines.length > 1) {
                doc.text(urlLines.slice(1), marginX + 4, linkY + 4);
            }

            linkY += (urlLines.length * 4) + 6;
        });
    }

    doc.save(`Informe_JudicIA_${new Date().getTime()}.pdf`);
};
