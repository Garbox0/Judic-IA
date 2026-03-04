const fs = require('fs');

const filePath = 'd:\\Antigravity\\Judic-IA\\app\\dashboard\\research\\ResearchContent.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Reemplazar TAB SWITCHER labels y aria
content = content.replace(
    /\/\* TAB SWITCHER \*\/[\s\S]*?<div className="research-tabs">[\s\S]*?<\/div>/,
    `{/* TAB SWITCHER */}
                        <div className="research-tabs" role="tablist" aria-label="Secciones de investigación">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === 'jurisprudencia'}
                                className={\`research-tab \${activeTab === 'jurisprudencia' ? 'active' : ''}\`}
                                onClick={() => setActiveTab('jurisprudencia')}
                            >
                                <Search size={15} aria-hidden="true" /> Estrategia
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === 'pjn'}
                                className={\`research-tab \${activeTab === 'pjn' ? 'active' : ''}\`}
                                onClick={() => setActiveTab('pjn')}
                            >
                                <Gavel size={15} aria-hidden="true" /> Resoluciones PJN
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === 'alerts'}
                                className={\`research-tab \${activeTab === 'alerts' ? 'active' : ''}\`}
                                onClick={() => setActiveTab('alerts')}
                            >
                                <AlertCircle size={15} aria-hidden="true" /> Alertas
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === 'antecedentes'}
                                className={\`research-tab \${activeTab === 'antecedentes' ? 'active' : ''}\`}
                                onClick={() => setActiveTab('antecedentes')}
                            >
                                <ShieldCheck size={15} aria-hidden="true" /> Antecedentes
                            </button>
                        </div>`
);

// 2. Eliminar bloque desde juris-mode-tabs hasta el inicio de jurisdiction-selector
const startString = '<div className="juris-mode-tabs">';
const endString = '<div className="jurisdiction-selector">';

const startIndex = content.indexOf(startString);
const endIndex = content.indexOf(endString);

if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + content.substring(endIndex);
    console.log('Removed manual search html block');
} else {
    console.log('Could not find manual search html block');
}

// 3. Clean up the closing tag of the removed <div style={{ display: jurisprudenciaMode === 'manual' ? 'none' : 'block' }}>
content = content.replace(
    /<\/div>\s*<\/div>\s*\)\}\s*\{\/\* end activeTab === 'jurisprudencia' \*\/\}/,
    `</div>\n                        )} {/* end activeTab === 'jurisprudencia' */}`
);

// 4. Update the IA results condition
content = content.replace(
    /\{activeTab === 'jurisprudencia' && jurisprudenciaMode === 'ia' && results && \(/,
    `{activeTab === 'jurisprudencia' && results && (`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done fixing ResearchContent.js.');
