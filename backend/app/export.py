import io
import csv
import json
from typing import List, Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_csv_report(files: List[Any]) -> str:
    """Generates a CSV string containing codebase metrics for all indexed files."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "File Path", "File Name", "Extension", "Language", 
        "Size (Bytes)", "Lines of Code (LOC)", 
        "Cyclomatic Complexity", "Maintainability Index",
        "Commits Count", "Primary Owner", "Ownership %"
    ])
    
    # Write files data
    for file in files:
        writer.writerow([
            file.path, file.name, file.extension, file.language,
            file.size_bytes, file.loc, file.complexity, file.maintainability,
            file.commits_count, file.primary_owner or "Unknown", file.ownership_percent
        ])
        
    return output.getvalue()

def generate_json_report(repo: Any, files: List[Any], dependencies: List[Any], symbols: List[Any], contributors: List[Any], vulnerabilities: List[Any], smells: List[Dict[str, Any]], summary: str) -> str:
    """Generates a comprehensive JSON dump of all analysis databases."""
    data = {
        "repository": {
            "id": repo.id,
            "name": repo.name,
            "path": repo.path,
            "source_type": repo.source_type,
            "files_count": repo.files_count,
            "folders_count": repo.folders_count,
            "size_bytes": repo.size_bytes,
            "created_at": repo.created_at.isoformat() if repo.created_at else None
        },
        "metrics": {
            "average_complexity": sum(f.complexity for f in files) / len(files) if files else 0.0,
            "average_maintainability": sum(f.maintainability for f in files) / len(files) if files else 100.0,
        },
        "files": [
            {
                "path": f.path,
                "name": f.name,
                "language": f.language,
                "size_bytes": f.size_bytes,
                "loc": f.loc,
                "complexity": f.complexity,
                "maintainability": f.maintainability,
                "commits_count": f.commits_count,
                "primary_owner": f.primary_owner,
                "ownership_percent": f.ownership_percent
            } for f in files
        ],
        "dependencies": [
            {
                "source": d.source_file,
                "target": d.target_file,
                "type": d.type
            } for d in dependencies
        ],
        "symbols": [
            {
                "name": s.name,
                "type": s.type,
                "file_path": s.file_index.path if hasattr(s, "file_index") and s.file_index else None,
                "line": s.line_number
            } for s in symbols
        ],
        "contributors": [
            {
                "name": c.name,
                "email": c.email,
                "commits_count": c.commits_count,
                "additions": c.additions,
                "deletions": c.deletions
            } for c in contributors
        ],
        "security_vulnerabilities": [
            {
                "file": v.file_path,
                "line": v.line_number,
                "severity": v.severity,
                "category": v.category,
                "description": v.description
            } for v in vulnerabilities
        ],
        "architectural_smells": smells,
        "ai_summary": summary
    }
    return json.dumps(data, indent=2)

def generate_markdown_report(repo: Any, files: List[Any], smells: List[Dict[str, Any]], summary: str) -> str:
    """Generates an extensive Markdown engineering report."""
    md = f"""# RepoScope Analysis Report: {repo.name}

Generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S") if 'datetime' in globals() else "2026-06-08"}
Source path: `{repo.path}`

## 1. Repository Overview
- **Total Files**: {repo.files_count}
- **Total Folders**: {repo.folders_count}
- **Total Code Volume**: {round(repo.size_bytes / 1024, 2)} KB
- **Average Maintainability Index**: {round(sum(f.maintainability for f in files) / len(files), 2) if files else 100.0} / 100
- **Average Cyclomatic Complexity**: {round(sum(f.complexity for f in files) / len(files), 2) if files else 1.0}

---

## 2. AI Architecture Onboarding Summary
{summary}

---

## 3. Codebase Architectural Smells
A total of {len(smells)} structural health flags were raised.

| Category | Location | Details |
| --- | --- | --- |
"""
    for s in smells:
        md += f"| {s['category']} | `{s['location']}` | {s['description']} |\n"
        
    md += "\n\n## 4. Top 15 Largest Files\n"
    md += "| File Path | Language | LOC | Size (KB) | Maintainability |\n| --- | --- | --- | --- | --- |\n"
    
    sorted_files = sorted(files, key=lambda x: x.loc, reverse=True)[:15]
    for f in sorted_files:
        md += f"| `{f.path}` | {f.language} | {f.loc} | {round(f.size_bytes / 1024, 1)} | {f.maintainability} |\n"
        
    return md

def generate_pdf_report(repo: Any, files: List[Any], vulnerabilities: List[Any], smells: List[Dict[str, Any]], summary: str) -> bytes:
    """
    Generates a professionally styled PDF report using ReportLab platypus layouts.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []
    
    styles = getSampleStyleSheet()
    
    # Custom Palette Style definitions
    title_style = ParagraphStyle(
        'PDFTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#1e1b4b'), # Deep Indigo
        spaceAfter=15
    )
    
    h2_style = ParagraphStyle(
        'PDFH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#312e81'),
        spaceBefore=15,
        spaceAfter=10
    )
    
    body_style = ParagraphStyle(
        'PDFBody',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#374151')
    )
    
    bold_body_style = ParagraphStyle(
        'PDFBoldBody',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    
    code_style = ParagraphStyle(
        'PDFCode',
        parent=body_style,
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#1f2937')
    )
    
    # Header
    story.append(Paragraph(f"RepoScope Engineering Report: {repo.name}", title_style))
    story.append(Paragraph(f"<b>Scanned Directory:</b> {repo.path}", body_style))
    story.append(Paragraph(f"<b>Files Indexed:</b> {repo.files_count} | <b>Folders:</b> {repo.folders_count}", body_style))
    story.append(Spacer(1, 15))
    
    # Metrics Table
    story.append(Paragraph("Codebase Health Summary", h2_style))
    avg_mi = round(sum(f.maintainability for f in files) / len(files), 2) if files else 100.0
    avg_cc = round(sum(f.complexity for f in files) / len(files), 2) if files else 1.0
    
    data = [
        [Paragraph("Metric", bold_body_style), Paragraph("Value", bold_body_style), Paragraph("Threshold Standard", bold_body_style)],
        [Paragraph("Average Maintainability Index", body_style), Paragraph(f"{avg_mi} / 100", body_style), Paragraph("Healthy: > 65.0", body_style)],
        [Paragraph("Average Cyclomatic Complexity", body_style), Paragraph(str(avg_cc), body_style), Paragraph("Low risk: < 15.0", body_style)],
        [Paragraph("Security Issues Flagged", body_style), Paragraph(str(len(vulnerabilities)), body_style), Paragraph("Safe: 0", body_style)],
        [Paragraph("Architectural Smells Detected", body_style), Paragraph(str(len(smells)), body_style), Paragraph("Standard: < 5", body_style)]
    ]
    
    t = Table(data, colWidths=[180, 100, 220])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e0e7ff')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 15))
    
    # AI Summary
    story.append(Paragraph("Architecture Explanation Summary", h2_style))
    summary_clean = summary.replace("#", "").replace("*", "") # strip formatting
    for para in summary_clean.split("\n\n")[:5]: # Take first few sections for PDF brevity
        if para.strip():
            story.append(Paragraph(para.strip(), body_style))
            story.append(Spacer(1, 6))
            
    # Security issues
    story.append(Spacer(1, 10))
    story.append(Paragraph("Security Vulnerability Audit", h2_style))
    if vulnerabilities:
        sec_data = [[Paragraph("File Path", bold_body_style), Paragraph("Severity", bold_body_style), Paragraph("Issue Details", bold_body_style)]]
        for v in vulnerabilities[:10]: # Cap to 10
            sec_data.append([
                Paragraph(v.file_path, code_style),
                Paragraph(v.severity, ParagraphStyle('Sev', parent=body_style, textColor=colors.HexColor('#b91c1c') if v.severity in ['Critical', 'High'] else colors.HexColor('#d97706'))),
                Paragraph(v.description, body_style)
            ])
        sec_table = Table(sec_data, colWidths=[150, 70, 280])
        sec_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#fee2e2')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('PADDING', (0,0), (-1,-1), 6),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        story.append(sec_table)
    else:
        story.append(Paragraph("No security vulnerabilities were identified in the source files.", body_style))
        
    # Build Document
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes
