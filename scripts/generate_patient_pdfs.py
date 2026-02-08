#!/usr/bin/env python3
"""
Generate Clinical PDF Source Documents for 12 BCBS Patients.

Reads each patient's JSON data and generates professional medical PDFs
matching the style of existing maria_r/david_c reference documents.
Each patient gets 4-5 PDFs as specified in extraction_metadata.extracted_from.

Usage:
    source venv/bin/activate
    python scripts/generate_patient_pdfs.py
"""

import json
import os
import sys
import random
import string
from datetime import datetime, timedelta
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak
)
from reportlab.platypus.flowables import Flowable

# ─── Constants ───────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data" / "patients"

# BCBS patients to generate (exclude maria_r and david_c which already have PDFs)
BCBS_PATIENTS = [
    "sarah_m", "james_o", "linda_n", "diana_k", "catherine_p",
    "margaret_t", "thomas_r", "robert_h", "marcus_b",
    "aiden_f", "ethan_w", "sofia_r"
]

# Colors matching reference PDFs
BCBS_BLUE = colors.HexColor("#003366")
BCBS_LIGHT_BLUE = colors.HexColor("#4A90D9")
SECTION_BG = colors.HexColor("#E8E8E8")
HEADER_BG = colors.HexColor("#003366")
LIGHT_GRAY = colors.HexColor("#F5F5F5")
MEDIUM_GRAY = colors.HexColor("#CCCCCC")
TABLE_HEADER_BG = colors.HexColor("#D9E2F3")
FLAG_RED = colors.HexColor("#CC0000")


# ─── Styles ──────────────────────────────────────────────────────────────────

def get_styles():
    """Build custom paragraph styles matching reference PDF formatting."""
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        'DocTitle', parent=styles['Title'],
        fontSize=16, leading=20, textColor=BCBS_BLUE, spaceAfter=4,
        fontName='Helvetica-Bold', alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        'DocSubtitle', parent=styles['Normal'],
        fontSize=9, leading=11, textColor=colors.gray, alignment=TA_CENTER,
        spaceAfter=2
    ))
    styles.add(ParagraphStyle(
        'SectionHeader', parent=styles['Heading2'],
        fontSize=11, leading=14, textColor=colors.white,
        fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=6,
        backColor=HEADER_BG, borderPadding=(4, 6, 4, 6)
    ))
    styles.add(ParagraphStyle(
        'SectionTitle', parent=styles['Heading2'],
        fontSize=11, leading=14, textColor=BCBS_BLUE,
        fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        'FieldLabel', parent=styles['Normal'],
        fontSize=8, leading=10, fontName='Helvetica-Bold',
        textColor=colors.HexColor("#333333")
    ))
    styles.add(ParagraphStyle(
        'FieldValue', parent=styles['Normal'],
        fontSize=9, leading=11, fontName='Helvetica'
    ))
    styles.add(ParagraphStyle(
        'BodyText9', parent=styles['Normal'],
        fontSize=9, leading=12, fontName='Helvetica', spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        'BodyTextBold', parent=styles['Normal'],
        fontSize=9, leading=12, fontName='Helvetica-Bold', spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        'SmallCenter', parent=styles['Normal'],
        fontSize=7, leading=9, alignment=TA_CENTER, textColor=colors.gray
    ))
    styles.add(ParagraphStyle(
        'SmallText', parent=styles['Normal'],
        fontSize=7, leading=9, textColor=colors.gray
    ))
    styles.add(ParagraphStyle(
        'Letterhead', parent=styles['Title'],
        fontSize=14, leading=18, textColor=BCBS_BLUE,
        fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=2
    ))
    styles.add(ParagraphStyle(
        'InterpretationText', parent=styles['Normal'],
        fontSize=9, leading=12, fontName='Helvetica',
        spaceBefore=4, spaceAfter=4, leftIndent=6, rightIndent=6
    ))
    return styles


# ─── Utility Functions ───────────────────────────────────────────────────────

def gen_accession():
    """Generate a realistic accession number."""
    return f"26{random.randint(100,999)}-{random.randint(100000,999999)}"


def gen_request_id():
    """Generate a PA request ID."""
    return f"PA2026{random.randint(100000,999999)}"


def fmt_date(date_str):
    """Format ISO date to MM/DD/YYYY."""
    if not date_str:
        return "N/A"
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%m/%d/%Y")
    except (ValueError, TypeError):
        return str(date_str)


def fmt_date_long(date_str):
    """Format ISO date to 'January 25, 2026' style."""
    if not date_str:
        return "N/A"
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%B %d, %Y")
    except (ValueError, TypeError):
        return str(date_str)


def safe_get(data, *keys, default=""):
    """Safely navigate nested dict keys."""
    current = data
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key, default)
        else:
            return default
    return current if current is not None else default


def section_bar(text, styles):
    """Create a section header bar matching the reference format."""
    return Paragraph(
        f'<font color="white"><b>{text}</b></font>',
        styles['SectionHeader']
    )


def build_kv_table(pairs, col_widths=None):
    """Build a label-value table from (label, value) pairs."""
    if not col_widths:
        col_widths = [1.8 * inch, 4.7 * inch]
    data = []
    for label, value in pairs:
        data.append([
            Paragraph(f'<b>{label}</b>', ParagraphStyle('lbl', fontSize=8, fontName='Helvetica-Bold')),
            Paragraph(str(value), ParagraphStyle('val', fontSize=9, fontName='Helvetica'))
        ])
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (0, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_GRAY),
    ]))
    return t


def build_lab_table(results, styles):
    """Build a laboratory results table with flag highlighting."""
    header = [
        Paragraph('<b>Test Name</b>', styles['FieldLabel']),
        Paragraph('<b>Result</b>', styles['FieldLabel']),
        Paragraph('<b>Flag</b>', styles['FieldLabel']),
        Paragraph('<b>Units</b>', styles['FieldLabel']),
        Paragraph('<b>Reference Interval</b>', styles['FieldLabel']),
    ]
    data = [header]

    for r in results:
        flag = r.get("flag", "") or ""
        value = str(r.get("value", ""))

        # Bold + color for flagged results
        if flag:
            val_text = f'<b><font color="#CC0000">{value}</font></b>'
            flag_text = f'<b><font color="#CC0000">{flag}</font></b>'
        else:
            val_text = value
            flag_text = ""

        unit = r.get("unit", "") or ""
        ref = r.get("reference_range", "") or ""

        data.append([
            Paragraph(r.get("test", ""), styles['FieldValue']),
            Paragraph(val_text, styles['FieldValue']),
            Paragraph(flag_text, styles['FieldValue']),
            Paragraph(unit, styles['FieldValue']),
            Paragraph(ref, styles['FieldValue']),
        ])

    col_widths = [2.4 * inch, 1.1 * inch, 0.5 * inch, 0.9 * inch, 1.6 * inch]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]
    # Alternate row shading
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), LIGHT_GRAY))
    t.setStyle(TableStyle(style_cmds))
    return t


def footer_block(styles, text_lines):
    """Create a footer/signature block."""
    elements = [
        HRFlowable(width="100%", thickness=0.5, color=colors.gray, spaceAfter=4),
    ]
    for line in text_lines:
        elements.append(Paragraph(line, styles['SmallCenter']))
    return elements


# ─── Document Generators ─────────────────────────────────────────────────────

def generate_pa_form(data, output_path, styles):
    """Generate a BCBS FEP Prior Authorization Request Form (2 pages)."""
    doc = SimpleDocTemplate(
        str(output_path), pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch
    )
    elements = []

    demo = data.get("demographics", {})
    ins = safe_get(data, "insurance", "primary", default={})
    presc = data.get("prescriber", {})
    med = data.get("medication_request", {})
    diags = data.get("diagnoses", [])
    treatments = data.get("prior_treatments", [])
    clinical = data.get("clinical_history", {})
    request_date = safe_get(data, "extraction_metadata", "extraction_date", default="2026-02-01")
    request_id = gen_request_id()

    # ── Header ──
    elements.append(Paragraph("BLUE CROSS BLUE SHIELD", styles['DocTitle']))
    elements.append(Paragraph("Federal Employee Program", styles['DocSubtitle']))
    elements.append(Paragraph("PRIOR AUTHORIZATION REQUEST FORM", ParagraphStyle(
        'PATitle', fontSize=13, fontName='Helvetica-Bold', alignment=TA_CENTER,
        textColor=BCBS_BLUE, spaceAfter=6
    )))

    # Request metadata row
    meta_data = [[
        Paragraph(f'<b>Date of Request:</b>', styles['FieldLabel']),
        Paragraph(fmt_date(request_date), styles['FieldValue']),
        Paragraph(f'<b>Request ID:</b>', styles['FieldLabel']),
        Paragraph(request_id, styles['FieldValue']),
    ]]
    meta_t = Table(meta_data, colWidths=[1.2 * inch, 1.8 * inch, 1.2 * inch, 2.3 * inch])
    meta_t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(meta_t)
    elements.append(Spacer(1, 6))

    # ── Section 1: Member Information ──
    elements.append(section_bar("SECTION 1: MEMBER INFORMATION", styles))
    first_name = demo.get("first_name", "")
    last_name = demo.get("last_name", "")
    gender = demo.get("gender", "")
    dob = demo.get("date_of_birth", "")
    phone = demo.get("phone", "")
    member_id = ins.get("member_id", "")
    group_num = ins.get("group_number", "")
    plan_type = ins.get("plan_type", "PPO")
    addr = demo.get("address", {})
    address_str = f"{addr.get('street', '')}, {addr.get('city', '')}, {addr.get('state', '')} {addr.get('zip', '')}"

    gender_check = f"{'■' if gender == 'Female' else '□'} Female  {'■' if gender == 'Male' else '□'} Male"

    member_data = [
        [Paragraph('<b>Member Last Name:</b>', styles['FieldLabel']),
         Paragraph(last_name.upper(), styles['FieldValue']),
         Paragraph('<b>First Name:</b>', styles['FieldLabel']),
         Paragraph(first_name.upper(), styles['FieldValue']),
         Paragraph('<b>MI:</b>', styles['FieldLabel']),
         Paragraph('', styles['FieldValue'])],
        [Paragraph('<b>Date of Birth:</b>', styles['FieldLabel']),
         Paragraph(dob, styles['FieldValue']),
         Paragraph('<b>Gender:</b>', styles['FieldLabel']),
         Paragraph(gender_check, styles['FieldValue']),
         Paragraph('<b>Phone:</b>', styles['FieldLabel']),
         Paragraph(phone, styles['FieldValue'])],
        [Paragraph('<b>Member ID:</b>', styles['FieldLabel']),
         Paragraph(member_id, styles['FieldValue']),
         Paragraph('<b>Group Number:</b>', styles['FieldLabel']),
         Paragraph(group_num, styles['FieldValue']),
         Paragraph('<b>Plan Type:</b>', styles['FieldLabel']),
         Paragraph(plan_type, styles['FieldValue'])],
        [Paragraph('<b>Address:</b>', styles['FieldLabel']),
         Paragraph(address_str, styles['FieldValue']),
         '', '', '', ''],
    ]
    cw1 = [1.2 * inch, 1.3 * inch, 1.0 * inch, 1.3 * inch, 0.8 * inch, 0.9 * inch]
    t1 = Table(member_data, colWidths=cw1)
    t1.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
        ('SPAN', (1, 3), (5, 3)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_GRAY),
        ('BACKGROUND', (2, 0), (2, 2), LIGHT_GRAY),
        ('BACKGROUND', (4, 0), (4, 2), LIGHT_GRAY),
    ]))
    elements.append(t1)
    elements.append(Spacer(1, 4))

    # Parent/Guardian for pediatric patients
    guardian = demo.get("parent_guardian")
    if guardian:
        elements.append(Paragraph(
            f'<b>Parent/Guardian:</b> {guardian.get("name", "")} ({guardian.get("relationship", "")})'
            f' | Phone: {guardian.get("contact_phone", "")}',
            styles['BodyText9']
        ))
        subscriber = ins.get("subscriber", "")
        if subscriber:
            elements.append(Paragraph(f'<b>Subscriber:</b> {subscriber}', styles['BodyText9']))

    # ── Section 2: Prescriber/Facility Information ──
    elements.append(section_bar("SECTION 2: PRESCRIBER/FACILITY INFORMATION", styles))
    p_addr = presc.get("address", {})
    p_address_str = f"{p_addr.get('street', '')}, {p_addr.get('city', '')}, {p_addr.get('state', '')} {p_addr.get('zip', '')}"
    specialty_str = presc.get("specialty", "")
    if presc.get("subspecialty"):
        specialty_str += f" ({presc['subspecialty']})"

    presc_pairs = [
        ("Prescriber Name:", f"{presc.get('name', '')}, {presc.get('credentials', '')}"),
        ("Specialty:", specialty_str),
        ("Practice Name:", presc.get("practice_name", "")),
        ("NPI:", presc.get("npi", "")),
        ("Address:", p_address_str),
        ("Phone:", presc.get("phone", "")),
        ("Fax:", presc.get("fax", "")),
    ]
    elements.append(build_kv_table(presc_pairs))
    elements.append(Spacer(1, 4))

    # ── Section 3: Medication/Service Requested ──
    elements.append(section_bar("SECTION 3: MEDICATION/SERVICE REQUESTED", styles))
    freq = med.get("frequency", {})
    if isinstance(freq, dict):
        freq_parts = []
        if freq.get("loading"):
            freq_parts.append(f"Loading: {freq['loading']}")
        if freq.get("maintenance"):
            freq_parts.append(f"Maintenance: {freq['maintenance']}")
        if freq.get("schedule"):
            freq_parts.append(freq['schedule'])
        if freq.get("regimen"):
            freq_parts.append(freq['regimen'])
        if freq.get("combination_therapy"):
            freq_parts.append(f"Combination: {freq['combination_therapy']}")
        freq_str = "; ".join(freq_parts) if freq_parts else str(freq)
    else:
        freq_str = str(freq)

    med_pairs = [
        ("Drug Name (Brand/Generic):", f"{med.get('brand_name', '')} ({med.get('medication_name', '')})"),
        ("NDC / J-Code / HCPCS:", med.get("j_code", "")),
        ("Strength / Dose:", med.get("dose", "")),
        ("Route of Administration:", med.get("route", "")),
        ("Frequency:", freq_str),
        ("Duration of Therapy:", med.get("duration_requested", "")),
        ("Quantity Requested:", med.get("quantity_requested", "")),
        ("Site of Service:", med.get("site_of_care", "")),
        ("Requested Start Date:", med.get("start_date_requested", "")),
    ]
    elements.append(build_kv_table(med_pairs))

    if med.get("urgency"):
        elements.append(Paragraph(f'<b>Urgency:</b> {med["urgency"]}', styles['BodyText9']))
    elements.append(Spacer(1, 4))

    # ── Section 4: Diagnosis Information ──
    elements.append(section_bar("SECTION 4: DIAGNOSIS INFORMATION", styles))
    diag_header = [
        Paragraph('<b></b>', styles['FieldLabel']),
        Paragraph('<b>ICD-10 Code</b>', styles['FieldLabel']),
        Paragraph('<b>Diagnosis Description</b>', styles['FieldLabel']),
    ]
    diag_data = [diag_header]
    for d in diags:
        rank = d.get("rank", "").replace("_", " ").title()
        diag_data.append([
            Paragraph(rank, styles['FieldValue']),
            Paragraph(d.get("icd10_code", ""), styles['FieldValue']),
            Paragraph(d.get("description", ""), styles['FieldValue']),
        ])
    dt = Table(diag_data, colWidths=[1.2 * inch, 1.2 * inch, 4.1 * inch])
    dt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(dt)
    elements.append(Spacer(1, 4))

    # ── Section 5: Prior Treatment History / Step Therapy ──
    elements.append(section_bar("SECTION 5: PRIOR TREATMENT HISTORY / STEP THERAPY", styles))
    if treatments:
        tx_header = [
            Paragraph('<b>Medication</b>', styles['FieldLabel']),
            Paragraph('<b>Dose/Route</b>', styles['FieldLabel']),
            Paragraph('<b>Start Date</b>', styles['FieldLabel']),
            Paragraph('<b>End Date</b>', styles['FieldLabel']),
            Paragraph('<b>Outcome</b>', styles['FieldLabel']),
        ]
        tx_data = [tx_header]
        for tx in treatments:
            dose_str = tx.get("dose", tx.get("drug_class", ""))
            if tx.get("cycles_completed"):
                dose_str += f" ({tx['cycles_completed']} cycles)"
            tx_data.append([
                Paragraph(tx.get("medication_name", ""), styles['FieldValue']),
                Paragraph(str(dose_str)[:60], styles['FieldValue']),
                Paragraph(tx.get("start_date", tx.get("administration_date", "")), styles['FieldValue']),
                Paragraph(tx.get("end_date", ""), styles['FieldValue']),
                Paragraph(tx.get("outcome", "").replace("_", " ").title(), styles['FieldValue']),
            ])
        tt = Table(tx_data, colWidths=[1.6 * inch, 1.6 * inch, 1.0 * inch, 1.0 * inch, 1.3 * inch])
        tt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
            ('GRID', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(tt)
    else:
        elements.append(Paragraph("No prior systemic therapy — de novo presentation.", styles['BodyText9']))
    elements.append(Spacer(1, 4))

    # ── Section 6: Clinical Information / Medical Necessity ──
    elements.append(section_bar("SECTION 6: CLINICAL INFORMATION / MEDICAL NECESSITY", styles))

    # Build clinical narrative from available data
    first = demo.get("first_name", "")
    last = demo.get("last_name", "")
    age = demo.get("age", demo.get("age_years", demo.get("age_months", "")))
    age_unit = "month-old" if "age_months" in demo else ("week-old" if "age_weeks" in demo else "year-old")
    if "age_weeks" in demo:
        age = demo["age_weeks"]
    chief = clinical.get("chief_complaint", "")
    hpi = clinical.get("history_of_present_illness", "")

    if hpi:
        # Truncate very long HPI for the PA form — keep it to ~3 paragraphs
        narrative = hpi[:800]
        if len(hpi) > 800:
            narrative += "..."
    elif chief:
        narrative = chief
    else:
        narrative = f"Clinical documentation supports medical necessity for the requested medication."

    elements.append(Paragraph(
        f"{first} {last} is a {age}-{age_unit} {gender.lower()} — {chief}",
        styles['BodyText9']
    ))
    elements.append(Spacer(1, 3))
    elements.append(Paragraph(narrative, styles['BodyText9']))

    # Disease activity summary
    disease = data.get("disease_activity", {})
    if disease:
        activity_parts = []
        for key in ["ann_arbor_stage", "stage", "sma_type", "iss_stage", "ecog_performance_status",
                     "disease_status", "lines_of_therapy_completed"]:
            val = disease.get(key)
            if val is not None:
                label = key.replace("_", " ").title()
                activity_parts.append(f"{label}: {val}")
        if activity_parts:
            elements.append(Spacer(1, 3))
            elements.append(Paragraph(
                f"<b>Disease Activity:</b> {' | '.join(activity_parts)}",
                styles['BodyText9']
            ))

    elements.append(Spacer(1, 6))

    # ── Section 7: Prescriber Attestation ──
    elements.append(section_bar("SECTION 7: PRESCRIBER ATTESTATION", styles))
    elements.append(Paragraph(
        "I certify that the information provided on this form is accurate and complete to the best of my knowledge. "
        "I attest that the requested medication/service is medically necessary for this patient. I understand that "
        "payment of claims will be from Federal and/or State funds, and that any false claims, statements, or "
        "documents may be prosecuted under applicable Federal and State laws.",
        styles['BodyText9']
    ))
    elements.append(Spacer(1, 14))

    # Signature block
    sig_data = [
        [Paragraph('<b>Prescriber Signature:</b>', styles['FieldLabel']),
         Paragraph('____________________________', styles['FieldValue']),
         Paragraph('<b>Date Signed:</b>', styles['FieldLabel']),
         Paragraph(fmt_date(request_date), styles['FieldValue'])],
        [Paragraph('<b>Print Name:</b>', styles['FieldLabel']),
         Paragraph(presc.get("name", "").upper().replace("DR. ", "DR. "), styles['FieldValue']),
         Paragraph('<b>NPI:</b>', styles['FieldLabel']),
         Paragraph(presc.get("npi", ""), styles['FieldValue'])],
    ]
    sig_t = Table(sig_data, colWidths=[1.5 * inch, 2.5 * inch, 1.2 * inch, 1.3 * inch])
    sig_t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(sig_t)
    elements.append(Spacer(1, 10))

    # Footer
    elements.extend(footer_block(styles, [
        f"SUBMIT TO: BCBS FEP Prior Authorization Department | Fax: 1-800-XXX-XXXX | Portal: provider.bcbs.com",
        "Standard Review: 5 business days | Expedited Review: 72 hours | Effective: 01/2026 | Form Version 10.1"
    ]))

    doc.build(elements)


def generate_laboratory_results(data, output_path, styles):
    """Generate a Laboratory Results report with panels and flag highlighting."""
    doc = SimpleDocTemplate(
        str(output_path), pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch
    )
    elements = []
    demo = data.get("demographics", {})
    presc = data.get("prescriber", {})
    labs = data.get("laboratory_results", {})
    accession = gen_accession()

    # Facility header
    p_addr = presc.get("address", {})
    facility_name = presc.get("practice_name", "Clinical Laboratory Services")
    facility_addr = f"{p_addr.get('street', '')} | {p_addr.get('city', '')}, {p_addr.get('state', '')} {p_addr.get('zip', '')}"

    elements.append(Paragraph(f"CLINICAL LABORATORY SERVICES", styles['DocTitle']))
    elements.append(Paragraph(facility_addr, styles['DocSubtitle']))
    clia_id = f"45D{random.randint(1000000,9999999)}"
    cap_id = f"{random.randint(1000000,9999999)}-01"
    elements.append(Paragraph(f"CLIA ID: {clia_id} | CAP ID: {cap_id}", styles['DocSubtitle']))
    elements.append(Spacer(1, 6))

    # Patient / Specimen / Ordering block
    collect_date = labs.get("collection_date", "")
    collect_time = f"{random.randint(6,10):02d}:{random.randint(0,59):02d}"

    info_data = [[
        Paragraph(
            f'<b>PATIENT</b><br/>'
            f'{demo.get("last_name", "").upper()}, {demo.get("first_name", "").upper()}<br/>'
            f'DOB: {demo.get("date_of_birth", "")}  Sex: {demo.get("gender", "")[0] if demo.get("gender") else ""}<br/>'
            f'MRN: {data.get("patient_id", "").upper()}',
            styles['FieldValue']
        ),
        Paragraph(
            f'<b>SPECIMEN</b><br/>'
            f'Accession: {accession}<br/>'
            f'Collected: {collect_date} {collect_time}<br/>'
            f'Received: {collect_date} {collect_time.replace(collect_time[:2], str(int(collect_time[:2])+1).zfill(2))}',
            styles['FieldValue']
        ),
        Paragraph(
            f'<b>ORDERING PHYSICIAN</b><br/>'
            f'{presc.get("name", "")}<br/>'
            f'{facility_name}<br/>'
            f'Report Status: FINAL',
            styles['FieldValue']
        ),
    ]]
    info_t = Table(info_data, colWidths=[2.2 * inch, 2.2 * inch, 2.1 * inch])
    info_t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_t)
    elements.append(Spacer(1, 8))

    # Panels
    panels = labs.get("panels", {})
    for panel_key, panel_data in panels.items():
        panel_name = panel_data.get("panel_name", panel_key.replace("_", " ").upper())
        elements.append(Paragraph(f'<b>{panel_name.upper()}</b>', styles['SectionTitle']))
        results = panel_data.get("results", [])
        if results:
            elements.append(build_lab_table(results, styles))
        elements.append(Spacer(1, 6))

    # Interpretation
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CC9933"), spaceAfter=4))
    elements.append(Paragraph("<b>INTERPRETATION</b>", styles['BodyTextBold']))

    # Generate context-appropriate interpretation
    patient_id = data.get("patient_id", "")
    interp = _build_lab_interpretation(data)
    elements.append(Paragraph(interp, styles['InterpretationText']))

    elements.append(Spacer(1, 10))
    elements.extend(footer_block(styles, [
        f"<b>Medical Director:</b> Laboratory Medical Director, MD, PhD, FCAP | Accession: {accession}",
        f"Report generated: {fmt_date(collect_date)} | Page 1 of 1",
        "H = High | L = Low | HH = Critical High | LL = Critical Low",
        "This report is confidential and intended only for the ordering provider."
    ]))

    doc.build(elements)


def _build_lab_interpretation(data):
    """Build a context-appropriate lab interpretation string."""
    patient_id = data.get("patient_id", "")
    diags = data.get("diagnoses", [])
    primary_dx = diags[0].get("description", "") if diags else ""

    if "myeloma" in primary_dx.lower():
        return (
            "Results demonstrate active multiple myeloma with elevated M-protein and abnormal free light chain ratio. "
            "Pre-CAR-T viral screening completed. Results support disease progression requiring intervention."
        )
    elif "lymphoma" in primary_dx.lower() or "dlbcl" in primary_dx.lower():
        return (
            "Results show mild cytopenias consistent with marrow involvement or prior chemotherapy effect. "
            "Elevated LDH suggests active disease. Pre-CAR-T viral screening negative. "
            "Adequate organ function for consideration of cellular therapy."
        )
    elif "breast" in primary_dx.lower():
        return (
            "Results demonstrate adequate hematologic and organ function for initiation of CDK4/6 inhibitor therapy. "
            "Elevated alkaline phosphatase may reflect osseous metastatic involvement."
        )
    elif "sma" in primary_dx.lower() or "spinal muscular" in primary_dx.lower():
        return (
            "Baseline safety labs within normal limits for age. No contraindications to intrathecal nusinersen "
            "administration. Platelet count and coagulation parameters adequate for lumbar puncture."
        )
    elif "mantle" in primary_dx.lower():
        return (
            "Results show elevated LDH suggesting active lymphoma. Mild anemia consistent with marrow involvement. "
            "Pre-CAR-T viral screening negative. Adequate organ function for CAR-T cell therapy consideration."
        )
    return "Results reviewed. Clinical correlation recommended."


def generate_clinical_summary(data, output_path, styles):
    """Generate a Clinical Summary / Letter of Medical Necessity."""
    doc = SimpleDocTemplate(
        str(output_path), pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch
    )
    elements = []
    demo = data.get("demographics", {})
    ins = safe_get(data, "insurance", "primary", default={})
    presc = data.get("prescriber", {})
    med = data.get("medication_request", {})
    clinical = data.get("clinical_history", {})
    treatments = data.get("prior_treatments", [])
    disease = data.get("disease_activity", {})
    pa = data.get("pa_criteria_assessment", {})
    request_date = safe_get(data, "extraction_metadata", "extraction_date", default="2026-02-01")

    p_addr = presc.get("address", {})

    # Letterhead
    elements.append(Paragraph(presc.get("practice_name", "").upper(), styles['Letterhead']))
    specialty_str = presc.get("specialty", "")
    if presc.get("subspecialty"):
        specialty_str += f" — {presc['subspecialty']}"
    elements.append(Paragraph(specialty_str, styles['DocSubtitle']))
    elements.append(Paragraph(
        f"{p_addr.get('street', '')}, {p_addr.get('city', '')} {p_addr.get('state', '')} {p_addr.get('zip', '')}",
        styles['DocSubtitle']
    ))
    elements.append(Paragraph(
        f"Phone: {presc.get('phone', '')} | Fax: {presc.get('fax', '')}",
        styles['DocSubtitle']
    ))
    elements.append(Paragraph(f"NPI: {presc.get('npi', '')}", styles['DocSubtitle']))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=BCBS_BLUE, spaceAfter=8))

    # Date
    elements.append(Paragraph(fmt_date_long(request_date), styles['BodyText9']))
    elements.append(Spacer(1, 6))

    # Addressee
    elements.append(Paragraph("Blue Cross Blue Shield", styles['BodyText9']))
    elements.append(Paragraph("Federal Employee Program", styles['BodyText9']))
    elements.append(Paragraph("Prior Authorization Department", styles['BodyText9']))
    elements.append(Paragraph("Medical Review Unit", styles['BodyText9']))
    elements.append(Spacer(1, 6))

    # RE block
    elements.append(Paragraph("<b>RE: Letter of Medical Necessity</b>", styles['BodyTextBold']))
    re_pairs = [
        ("Patient Name:", f"{demo.get('first_name', '')} {demo.get('last_name', '')}"),
        ("Date of Birth:", demo.get("date_of_birth", "")),
        ("Member ID:", ins.get("member_id", "")),
        ("Group Number:", ins.get("group_number", "")),
        ("Medication Requested:", f"{med.get('medication_name', '')} ({med.get('brand_name', '')})"),
        ("Diagnosis:", f"{data.get('diagnoses', [{}])[0].get('description', '')} "
                       f"({data.get('diagnoses', [{}])[0].get('icd10_code', '')})"),
    ]
    elements.append(build_kv_table(re_pairs, col_widths=[1.6 * inch, 5.0 * inch]))
    elements.append(Spacer(1, 6))

    # Salutation
    elements.append(Paragraph("To Whom It May Concern:", styles['BodyText9']))
    elements.append(Spacer(1, 4))

    first = demo.get("first_name", "")
    last = demo.get("last_name", "")
    med_name = med.get("medication_name", "")
    brand = med.get("brand_name", "")
    primary_dx = data.get("diagnoses", [{}])[0].get("description", "")
    primary_icd = data.get("diagnoses", [{}])[0].get("icd10_code", "")

    elements.append(Paragraph(
        f"I am writing on behalf of my patient, {first} {last}, to document the medical necessity of "
        f"{med_name} ({brand}) for the treatment of {primary_dx}. This letter provides clinical "
        f"documentation supporting the need for this medication and demonstrates that my patient meets "
        f"the coverage criteria for this therapy.",
        styles['BodyText9']
    ))
    elements.append(Spacer(1, 6))

    # Clinical History
    elements.append(Paragraph("<b>CLINICAL HISTORY AND DIAGNOSIS</b>", styles['BodyTextBold']))
    hpi = clinical.get("history_of_present_illness", "")
    if hpi:
        elements.append(Paragraph(hpi, styles['BodyText9']))
    elements.append(Spacer(1, 6))

    # Disease Activity
    if disease:
        elements.append(Paragraph("<b>CURRENT DISEASE ACTIVITY</b>", styles['BodyTextBold']))
        activity_text = f"Most recent assessment ({disease.get('assessment_date', '')}):"
        elements.append(Paragraph(activity_text, styles['BodyText9']))
        for key, val in disease.items():
            if key in ("assessment_date", "source_documents", "source_document"):
                continue
            if val is not None and val != "":
                label = key.replace("_", " ").title()
                elements.append(Paragraph(f"  • {label}: {val}", styles['BodyText9']))
        elements.append(Spacer(1, 6))

    # Prior Treatment History
    if treatments:
        elements.append(Paragraph("<b>PRIOR TREATMENT HISTORY</b>", styles['BodyTextBold']))
        elements.append(Paragraph(
            "The patient has tried and/or completed the following therapies:",
            styles['BodyText9']
        ))
        for tx in treatments:
            name = tx.get("medication_name", "")
            start = tx.get("start_date", tx.get("administration_date", ""))
            end = tx.get("end_date", "")
            outcome = tx.get("outcome_description", tx.get("outcome", ""))
            date_range = f"({start} to {end})" if end else f"({start})"
            elements.append(Paragraph(
                f"  • <b>{name}</b> {date_range}",
                styles['BodyText9']
            ))
            if outcome:
                elements.append(Paragraph(f"    Outcome: {outcome}", styles['BodyText9']))
        elements.append(Spacer(1, 6))

    # Medical Necessity Summary
    elements.append(Paragraph("<b>MEDICAL NECESSITY SUMMARY</b>", styles['BodyTextBold']))

    criteria_summary_parts = []
    for crit_key, crit_val in pa.items():
        if isinstance(crit_val, dict) and crit_val.get("met") is True:
            evidence = crit_val.get("evidence", "")
            if evidence:
                criteria_summary_parts.append(evidence)

    summary_text = (
        f"Based on the clinical evidence presented, {med_name} ({brand}) is medically necessary for "
        f"{first} {last}. The patient has a confirmed diagnosis of {primary_dx} (ICD-10: {primary_icd}). "
    )
    if criteria_summary_parts:
        summary_text += "Key criteria met: " + "; ".join(criteria_summary_parts[:4]) + ". "

    summary_text += (
        "I respectfully request approval of this prior authorization."
    )
    elements.append(Paragraph(summary_text, styles['BodyText9']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "Please contact my office if you require any additional clinical information.",
        styles['BodyText9']
    ))
    elements.append(Spacer(1, 10))

    # Signature block
    elements.append(Paragraph("Sincerely,", styles['BodyText9']))
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("________________________________________", styles['BodyText9']))
    elements.append(Paragraph(
        f"<b>{presc.get('name', '')}, {presc.get('credentials', '')}</b>",
        styles['BodyTextBold']
    ))
    elements.append(Paragraph(specialty_str, styles['BodyText9']))
    elements.append(Paragraph(f"NPI: {presc.get('npi', '')}", styles['BodyText9']))
    elements.append(Paragraph(f"Date: {fmt_date(request_date)}", styles['BodyText9']))

    doc.build(elements)


def generate_pet_ct_report(data, output_path, styles):
    """Generate a PET/CT Imaging Report."""
    doc = SimpleDocTemplate(
        str(output_path), pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch
    )
    elements = []
    demo = data.get("demographics", {})
    presc = data.get("prescriber", {})
    pet_ct = safe_get(data, "procedures", "pet_ct", default={})
    disease = data.get("disease_activity", {})

    p_addr = presc.get("address", {})

    # Department header
    elements.append(Paragraph("DEPARTMENT OF NUCLEAR MEDICINE &amp; MOLECULAR IMAGING", styles['DocTitle']))
    elements.append(Paragraph(presc.get("practice_name", ""), styles['DocSubtitle']))
    elements.append(Paragraph(
        f"{p_addr.get('street', '')} | {p_addr.get('city', '')}, {p_addr.get('state', '')} {p_addr.get('zip', '')}",
        styles['DocSubtitle']
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=BCBS_BLUE, spaceAfter=8))

    # Report title
    elements.append(Paragraph("<b>PET/CT IMAGING REPORT</b>", ParagraphStyle(
        'rptTitle', fontSize=13, fontName='Helvetica-Bold', alignment=TA_CENTER,
        textColor=BCBS_BLUE, spaceAfter=8
    )))

    # Patient info
    info_pairs = [
        ("Patient:", f"{demo.get('first_name', '')} {demo.get('last_name', '')}"),
        ("DOB:", demo.get("date_of_birth", "")),
        ("MRN:", data.get("patient_id", "").upper()),
        ("Exam Date:", pet_ct.get("procedure_date", "")),
        ("Ordering Physician:", presc.get("name", "")),
        ("Procedure:", pet_ct.get("procedure_name", "PET/CT")),
        ("Indication:", pet_ct.get("indication", disease.get("disease_status", "").replace("_", " ").title())),
    ]
    elements.append(build_kv_table(info_pairs))
    elements.append(Spacer(1, 8))

    # Technique
    elements.append(Paragraph("<b>TECHNIQUE</b>", styles['SectionTitle']))
    elements.append(Paragraph(
        "F-18 FDG PET/CT performed from skull base to mid-thigh following standard preparation "
        "(fasting >6 hours, blood glucose verified <200 mg/dL). Approximately 10-12 mCi F-18 FDG "
        "administered intravenously with 60-minute uptake time. Low-dose CT acquired for attenuation "
        "correction and anatomic localization. Images reviewed on dedicated PET/CT workstation.",
        styles['BodyText9']
    ))
    elements.append(Spacer(1, 6))

    # Findings
    elements.append(Paragraph("<b>FINDINGS</b>", styles['SectionTitle']))
    findings = pet_ct.get("findings", "No significant abnormality.")
    elements.append(Paragraph(findings, styles['BodyText9']))
    elements.append(Spacer(1, 8))

    # Impression box
    elements.append(Paragraph("<b>IMPRESSION</b>", styles['SectionTitle']))
    impression_data = [[Paragraph(
        f"<b>{findings}</b>",
        ParagraphStyle('imp', fontSize=9, fontName='Helvetica-Bold', leading=12)
    )]]
    imp_t = Table(impression_data, colWidths=[6.3 * inch])
    imp_t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, BCBS_BLUE),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F0F4FA")),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(imp_t)
    elements.append(Spacer(1, 14))

    # Electronic signature
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.gray, spaceAfter=4))
    elements.append(Paragraph(
        f"<b>Electronically signed by:</b> Nuclear Medicine Physician, MD | "
        f"{presc.get('practice_name', '')}",
        styles['SmallCenter']
    ))
    elements.append(Paragraph(
        f"Report finalized: {fmt_date(pet_ct.get('procedure_date', ''))} | "
        f"This report is confidential and intended only for the ordering provider.",
        styles['SmallCenter']
    ))

    doc.build(elements)


def generate_bone_marrow_biopsy(data, output_path, styles):
    """Generate a Bone Marrow Aspirate and Biopsy Report."""
    doc = SimpleDocTemplate(
        str(output_path), pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch
    )
    elements = []
    demo = data.get("demographics", {})
    presc = data.get("prescriber", {})
    bm = safe_get(data, "procedures", "bone_marrow_biopsy", default={})
    p_addr = presc.get("address", {})

    # Header
    elements.append(Paragraph("DEPARTMENT OF HEMATOPATHOLOGY", styles['DocTitle']))
    elements.append(Paragraph(presc.get("practice_name", ""), styles['DocSubtitle']))
    elements.append(Paragraph(
        f"{p_addr.get('street', '')} | {p_addr.get('city', '')}, {p_addr.get('state', '')} {p_addr.get('zip', '')}",
        styles['DocSubtitle']
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=BCBS_BLUE, spaceAfter=8))

    elements.append(Paragraph("<b>BONE MARROW ASPIRATE AND BIOPSY REPORT</b>", ParagraphStyle(
        'rptTitle', fontSize=13, fontName='Helvetica-Bold', alignment=TA_CENTER,
        textColor=BCBS_BLUE, spaceAfter=8
    )))

    # Patient info
    accession = gen_accession()
    info_pairs = [
        ("Patient:", f"{demo.get('first_name', '')} {demo.get('last_name', '')}"),
        ("DOB:", demo.get("date_of_birth", "")),
        ("MRN:", data.get("patient_id", "").upper()),
        ("Accession:", accession),
        ("Procedure Date:", bm.get("procedure_date", "")),
        ("Ordering Physician:", presc.get("name", "")),
        ("Procedure:", bm.get("procedure_name", "Bone Marrow Aspirate and Biopsy")),
    ]
    elements.append(build_kv_table(info_pairs))
    elements.append(Spacer(1, 8))

    # Specimen
    elements.append(Paragraph("<b>SPECIMEN</b>", styles['SectionTitle']))
    elements.append(Paragraph(
        "Posterior superior iliac crest, bilateral. Aspirate and trephine core biopsy obtained. "
        "Adequate specimen for evaluation.",
        styles['BodyText9']
    ))
    elements.append(Spacer(1, 6))

    # Findings
    elements.append(Paragraph("<b>MICROSCOPIC FINDINGS</b>", styles['SectionTitle']))
    findings = bm.get("findings", "")
    elements.append(Paragraph(findings, styles['BodyText9']))
    elements.append(Spacer(1, 6))

    # BCMA expression if present
    bcma = bm.get("bcma_expression")
    if bcma:
        elements.append(Paragraph("<b>IMMUNOPHENOTYPING / FLOW CYTOMETRY</b>", styles['SectionTitle']))
        elements.append(Paragraph(
            f"BCMA (B-cell maturation antigen) expression: <b>{bcma}</b> of plasma cells by flow cytometry. "
            "CD138+/CD38+/CD56+/- immunophenotype consistent with neoplastic plasma cells.",
            styles['BodyText9']
        ))
        elements.append(Spacer(1, 6))

    # Impression
    elements.append(Paragraph("<b>IMPRESSION</b>", styles['SectionTitle']))
    impression_data = [[Paragraph(
        f"<b>{findings}</b>",
        ParagraphStyle('imp', fontSize=9, fontName='Helvetica-Bold', leading=12)
    )]]
    imp_t = Table(impression_data, colWidths=[6.1 * inch])
    imp_t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, BCBS_BLUE),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F0F4FA")),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(imp_t)
    elements.append(Spacer(1, 14))

    # Signature
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.gray, spaceAfter=4))
    elements.append(Paragraph(
        f"<b>Electronically signed by:</b> Hematopathologist, MD | {presc.get('practice_name', '')}",
        styles['SmallCenter']
    ))
    elements.append(Paragraph(
        f"Report finalized: {fmt_date(bm.get('procedure_date', ''))} | Accession: {accession}",
        styles['SmallCenter']
    ))

    doc.build(elements)


def generate_pathology_report(data, output_path, styles):
    """Generate a Pathology Report (breast cancer biomarkers)."""
    doc = SimpleDocTemplate(
        str(output_path), pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch
    )
    elements = []
    demo = data.get("demographics", {})
    presc = data.get("prescriber", {})
    biomarkers = data.get("tumor_biomarkers", {})
    p_addr = presc.get("address", {})
    accession = gen_accession()

    # Header
    elements.append(Paragraph("DEPARTMENT OF PATHOLOGY", styles['DocTitle']))
    elements.append(Paragraph(presc.get("practice_name", ""), styles['DocSubtitle']))
    elements.append(Paragraph(
        f"{p_addr.get('street', '')} | {p_addr.get('city', '')}, {p_addr.get('state', '')} {p_addr.get('zip', '')}",
        styles['DocSubtitle']
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=BCBS_BLUE, spaceAfter=8))

    elements.append(Paragraph("<b>SURGICAL PATHOLOGY REPORT</b>", ParagraphStyle(
        'rptTitle', fontSize=13, fontName='Helvetica-Bold', alignment=TA_CENTER,
        textColor=BCBS_BLUE, spaceAfter=8
    )))

    # Patient info
    info_pairs = [
        ("Patient:", f"{demo.get('first_name', '')} {demo.get('last_name', '')}"),
        ("DOB:", demo.get("date_of_birth", "")),
        ("MRN:", data.get("patient_id", "").upper()),
        ("Accession:", accession),
        ("Biopsy Date:", biomarkers.get("biopsy_date", "")),
        ("Biopsy Site:", biomarkers.get("biopsy_site", "")),
        ("Ordering Physician:", presc.get("name", "")),
    ]
    elements.append(build_kv_table(info_pairs))
    elements.append(Spacer(1, 8))

    # Gross/Microscopic
    elements.append(Paragraph("<b>HISTOPATHOLOGY</b>", styles['SectionTitle']))
    elements.append(Paragraph(
        f"Histologic Type: {biomarkers.get('histology', 'N/A')}",
        styles['BodyText9']
    ))
    elements.append(Spacer(1, 6))

    # Biomarker Results table
    elements.append(Paragraph("<b>BIOMARKER STATUS</b>", styles['SectionTitle']))

    bio_header = [
        Paragraph('<b>Marker</b>', styles['FieldLabel']),
        Paragraph('<b>Result</b>', styles['FieldLabel']),
        Paragraph('<b>Details</b>', styles['FieldLabel']),
    ]
    bio_data = [bio_header]

    er = biomarkers.get("estrogen_receptor", {})
    if er:
        bio_data.append([
            Paragraph("Estrogen Receptor (ER)", styles['FieldValue']),
            Paragraph(f"<b>{er.get('status', '')}</b>", styles['FieldValue']),
            Paragraph(f"{er.get('percent_staining', '')}% staining, Allred {er.get('allred_score', '')}/8", styles['FieldValue']),
        ])

    pr = biomarkers.get("progesterone_receptor", {})
    if pr:
        bio_data.append([
            Paragraph("Progesterone Receptor (PR)", styles['FieldValue']),
            Paragraph(f"<b>{pr.get('status', '')}</b>", styles['FieldValue']),
            Paragraph(f"{pr.get('percent_staining', '')}% staining, Allred {pr.get('allred_score', '')}/8", styles['FieldValue']),
        ])

    her2 = biomarkers.get("her2_status", {})
    if her2:
        her2_detail = f"IHC {her2.get('ihc_score', '')}"
        if her2.get("fish_result"):
            her2_detail += f", FISH: {her2['fish_result']}"
        bio_data.append([
            Paragraph("HER2/neu", styles['FieldValue']),
            Paragraph(f"<b>{her2.get('overall_status', '')}</b>", styles['FieldValue']),
            Paragraph(her2_detail, styles['FieldValue']),
        ])

    ki67 = biomarkers.get("ki67")
    if ki67:
        bio_data.append([
            Paragraph("Ki-67 Proliferation Index", styles['FieldValue']),
            Paragraph(f"<b>{ki67}</b>", styles['FieldValue']),
            Paragraph("", styles['FieldValue']),
        ])

    pik3ca = biomarkers.get("pik3ca_mutation", {})
    if pik3ca and pik3ca.get("tested"):
        bio_data.append([
            Paragraph("PIK3CA Mutation", styles['FieldValue']),
            Paragraph(f"<b>{pik3ca.get('status', '')}</b>", styles['FieldValue']),
            Paragraph(f"Method: {pik3ca.get('test_method', '')}", styles['FieldValue']),
        ])

    bt = Table(bio_data, colWidths=[2.0 * inch, 1.3 * inch, 3.2 * inch])
    bt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(bt)
    elements.append(Spacer(1, 8))

    # Summary
    summary = biomarkers.get("biomarker_summary", "")
    if summary:
        elements.append(Paragraph("<b>BIOMARKER SUMMARY</b>", styles['SectionTitle']))
        imp_data = [[Paragraph(
            f"<b>{summary}</b>",
            ParagraphStyle('imp', fontSize=9, fontName='Helvetica-Bold', leading=12)
        )]]
        imp_t = Table(imp_data, colWidths=[6.1 * inch])
        imp_t.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, BCBS_BLUE),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F0F4FA")),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(imp_t)

    elements.append(Spacer(1, 14))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.gray, spaceAfter=4))
    elements.append(Paragraph(
        f"<b>Electronically signed by:</b> Pathologist, MD | {presc.get('practice_name', '')}",
        styles['SmallCenter']
    ))
    elements.append(Paragraph(
        f"Report finalized: {fmt_date(biomarkers.get('biopsy_date', ''))} | Accession: {accession}",
        styles['SmallCenter']
    ))

    doc.build(elements)


def generate_imaging_report(data, output_path, styles):
    """Generate a general Imaging Report (CT, bone scan, MRI)."""
    doc = SimpleDocTemplate(
        str(output_path), pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch
    )
    elements = []
    demo = data.get("demographics", {})
    presc = data.get("prescriber", {})
    disease = data.get("disease_activity", {})
    diags = data.get("diagnoses", [])
    p_addr = presc.get("address", {})

    # Header
    elements.append(Paragraph("DEPARTMENT OF DIAGNOSTIC RADIOLOGY", styles['DocTitle']))
    elements.append(Paragraph(presc.get("practice_name", ""), styles['DocSubtitle']))
    elements.append(Paragraph(
        f"{p_addr.get('street', '')} | {p_addr.get('city', '')}, {p_addr.get('state', '')} {p_addr.get('zip', '')}",
        styles['DocSubtitle']
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=BCBS_BLUE, spaceAfter=8))

    elements.append(Paragraph("<b>IMAGING REPORT</b>", ParagraphStyle(
        'rptTitle', fontSize=13, fontName='Helvetica-Bold', alignment=TA_CENTER,
        textColor=BCBS_BLUE, spaceAfter=8
    )))

    # Determine imaging modality from context
    metastatic_sites = disease.get("metastatic_sites", [])
    has_bone = any("bone" in s.lower() for s in metastatic_sites)
    has_liver = any("liver" in s.lower() for s in metastatic_sites)

    if has_bone:
        modality = "CT Chest/Abdomen/Pelvis with Contrast + Bone Scan"
    elif has_liver:
        modality = "CT Chest/Abdomen/Pelvis with Contrast"
    else:
        modality = "CT with Contrast"

    exam_date = disease.get("assessment_date", safe_get(data, "extraction_metadata", "extraction_date"))

    info_pairs = [
        ("Patient:", f"{demo.get('first_name', '')} {demo.get('last_name', '')}"),
        ("DOB:", demo.get("date_of_birth", "")),
        ("MRN:", data.get("patient_id", "").upper()),
        ("Exam Date:", exam_date),
        ("Modality:", modality),
        ("Ordering Physician:", presc.get("name", "")),
        ("Indication:", disease.get("disease_status", "").replace("_", " ").title() + " — staging/restaging"),
    ]
    elements.append(build_kv_table(info_pairs))
    elements.append(Spacer(1, 8))

    # Technique
    elements.append(Paragraph("<b>TECHNIQUE</b>", styles['SectionTitle']))
    elements.append(Paragraph(
        "Multidetector CT of the chest, abdomen, and pelvis acquired following administration of IV "
        "iodinated contrast. Bone windows and soft tissue windows reviewed. Comparison to prior imaging when available.",
        styles['BodyText9']
    ))
    elements.append(Spacer(1, 6))

    # Findings — build from disease activity and diagnoses
    elements.append(Paragraph("<b>FINDINGS</b>", styles['SectionTitle']))

    if metastatic_sites:
        for site in metastatic_sites:
            elements.append(Paragraph(f"  • <b>Metastatic disease:</b> {site}", styles['BodyText9']))

    # Construct additional findings from context
    primary_dx = diags[0].get("description", "") if diags else ""
    if "breast" in primary_dx.lower():
        elements.append(Paragraph(
            "  • No evidence of visceral metastases to lung, liver, or brain." if not has_liver
            else "  • Hepatic lesions identified as described above.",
            styles['BodyText9']
        ))
        elements.append(Paragraph(
            "  • No pathologic lymphadenopathy in axillary, mediastinal, or retroperitoneal regions.",
            styles['BodyText9']
        ))

    # Add secondary diagnoses as findings
    for d in diags[1:]:
        elements.append(Paragraph(
            f"  • {d.get('description', '')} (ICD-10: {d.get('icd10_code', '')})",
            styles['BodyText9']
        ))

    elements.append(Spacer(1, 8))

    # Impression
    elements.append(Paragraph("<b>IMPRESSION</b>", styles['SectionTitle']))
    stage = disease.get("stage", "")
    imp_text = f"Imaging findings consistent with {primary_dx}"
    if metastatic_sites:
        imp_text += f", {stage}" if stage else ""
        imp_text += f". Metastatic involvement: {'; '.join(metastatic_sites)}."
    else:
        imp_text += "."

    imp_data = [[Paragraph(
        f"<b>{imp_text}</b>",
        ParagraphStyle('imp', fontSize=9, fontName='Helvetica-Bold', leading=12)
    )]]
    imp_t = Table(imp_data, colWidths=[6.1 * inch])
    imp_t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, BCBS_BLUE),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F0F4FA")),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(imp_t)

    elements.append(Spacer(1, 14))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.gray, spaceAfter=4))
    elements.append(Paragraph(
        f"<b>Electronically signed by:</b> Radiologist, MD | {presc.get('practice_name', '')}",
        styles['SmallCenter']
    ))
    elements.append(Paragraph(
        f"Report finalized: {fmt_date(exam_date)} | This report is confidential.",
        styles['SmallCenter']
    ))

    doc.build(elements)


def generate_genetic_testing_report(data, output_path, styles):
    """Generate a Genetic Testing Report (SMA patients)."""
    doc = SimpleDocTemplate(
        str(output_path), pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch
    )
    elements = []
    demo = data.get("demographics", {})
    presc = data.get("prescriber", {})
    genetic = data.get("genetic_testing", {})

    # Could be either flat or nested structure
    if "initial_testing" in genetic:
        test_info = genetic["initial_testing"]
    elif "confirmatory_testing" in genetic:
        test_info = genetic["confirmatory_testing"]
    else:
        test_info = genetic

    results = test_info.get("results", {})

    # Header
    lab_name = test_info.get("laboratory", "Molecular Genetics Laboratory")
    elements.append(Paragraph(lab_name.upper(), styles['DocTitle']))
    elements.append(Paragraph("Molecular Diagnostics Division", styles['DocSubtitle']))
    elements.append(Paragraph(
        "CLIA: 05D2070100 | CAP: 9382104-01 | State Licensed",
        styles['DocSubtitle']
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=BCBS_BLUE, spaceAfter=8))

    elements.append(Paragraph("<b>GENETIC TESTING REPORT</b>", ParagraphStyle(
        'rptTitle', fontSize=13, fontName='Helvetica-Bold', alignment=TA_CENTER,
        textColor=BCBS_BLUE, spaceAfter=8
    )))

    # Patient info
    info_pairs = [
        ("Patient:", f"{demo.get('first_name', '')} {demo.get('last_name', '')}"),
        ("DOB:", demo.get("date_of_birth", "")),
        ("MRN:", data.get("patient_id", "").upper()),
        ("Test Date:", test_info.get("test_date", "")),
        ("Test Name:", test_info.get("test_name", "")),
        ("Methodology:", test_info.get("methodology", "")),
        ("Ordering Physician:", presc.get("name", "")),
    ]
    elements.append(build_kv_table(info_pairs))
    elements.append(Spacer(1, 8))

    # Results
    elements.append(Paragraph("<b>RESULTS</b>", styles['SectionTitle']))

    res_header = [
        Paragraph('<b>Gene/Marker</b>', styles['FieldLabel']),
        Paragraph('<b>Result</b>', styles['FieldLabel']),
    ]
    res_data = [res_header]

    smn1_copies = results.get("smn1_exon_7_copies")
    if smn1_copies is not None:
        res_data.append([
            Paragraph("SMN1 Exon 7 Copy Number", styles['FieldValue']),
            Paragraph(f"<b>{smn1_copies}</b> copies", styles['FieldValue']),
        ])

    smn1_mut = results.get("smn1_mutation_type")
    if smn1_mut:
        res_data.append([
            Paragraph("SMN1 Mutation Type", styles['FieldValue']),
            Paragraph(f"<b>{smn1_mut}</b>", styles['FieldValue']),
        ])

    smn2_copies = results.get("smn2_copy_number")
    if smn2_copies is not None:
        res_data.append([
            Paragraph("SMN2 Copy Number", styles['FieldValue']),
            Paragraph(f"<b>{smn2_copies}</b> copies", styles['FieldValue']),
        ])

    if len(res_data) > 1:
        rt = Table(res_data, colWidths=[3.0 * inch, 3.5 * inch])
        rt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
            ('GRID', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(rt)
    elements.append(Spacer(1, 8))

    # Interpretation
    interpretation = results.get("interpretation", genetic.get("confirmation", ""))
    if interpretation:
        elements.append(Paragraph("<b>INTERPRETATION</b>", styles['SectionTitle']))
        imp_data = [[Paragraph(
            f"<b>{interpretation}</b>",
            ParagraphStyle('imp', fontSize=9, fontName='Helvetica-Bold', leading=12)
        )]]
        imp_t = Table(imp_data, colWidths=[6.1 * inch])
        imp_t.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, BCBS_BLUE),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F0F4FA")),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(imp_t)

    elements.append(Spacer(1, 14))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.gray, spaceAfter=4))
    elements.append(Paragraph(
        f"<b>Laboratory Director:</b> Molecular Genetics Director, MD, PhD, FACMG",
        styles['SmallCenter']
    ))
    elements.append(Paragraph(
        f"Report finalized: {fmt_date(test_info.get('test_date', ''))} | "
        "This report is confidential and intended only for the ordering provider.",
        styles['SmallCenter']
    ))

    doc.build(elements)


def generate_neurology_assessment(data, output_path, styles):
    """Generate a Neurology Assessment report (SMA patients)."""
    doc = SimpleDocTemplate(
        str(output_path), pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch
    )
    elements = []
    demo = data.get("demographics", {})
    presc = data.get("prescriber", {})
    disease = data.get("disease_activity", {})
    clinical = data.get("clinical_history", {})
    p_addr = presc.get("address", {})

    # Letterhead
    elements.append(Paragraph(presc.get("practice_name", "").upper(), styles['Letterhead']))
    elements.append(Paragraph("Department of Pediatric Neurology", styles['DocSubtitle']))
    elements.append(Paragraph(
        f"{p_addr.get('street', '')} | {p_addr.get('city', '')}, {p_addr.get('state', '')} {p_addr.get('zip', '')}",
        styles['DocSubtitle']
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=BCBS_BLUE, spaceAfter=8))

    elements.append(Paragraph("<b>NEUROLOGY ASSESSMENT</b>", ParagraphStyle(
        'rptTitle', fontSize=13, fontName='Helvetica-Bold', alignment=TA_CENTER,
        textColor=BCBS_BLUE, spaceAfter=8
    )))

    # Patient info
    age = demo.get("age_years", demo.get("age", demo.get("age_months", demo.get("age_weeks", ""))))
    age_label = "Age"
    if "age_months" in demo:
        age = f"{demo['age_months']} months"
    elif "age_weeks" in demo:
        age = f"{demo['age_weeks']} weeks ({demo.get('age_days', '')} days)"
    elif "age_years" in demo:
        age = f"{demo['age_years']} years"

    info_pairs = [
        ("Patient:", f"{demo.get('first_name', '')} {demo.get('last_name', '')}"),
        ("DOB:", demo.get("date_of_birth", "")),
        ("Age:", str(age)),
        ("MRN:", data.get("patient_id", "").upper()),
        ("Assessment Date:", disease.get("assessment_date", "")),
        ("Evaluating Physician:", f"{presc.get('name', '')}, {presc.get('credentials', '')}"),
    ]
    elements.append(build_kv_table(info_pairs))
    elements.append(Spacer(1, 8))

    # Chief Complaint
    elements.append(Paragraph("<b>CHIEF COMPLAINT</b>", styles['SectionTitle']))
    elements.append(Paragraph(clinical.get("chief_complaint", ""), styles['BodyText9']))
    elements.append(Spacer(1, 6))

    # History
    elements.append(Paragraph("<b>HISTORY OF PRESENT ILLNESS</b>", styles['SectionTitle']))
    elements.append(Paragraph(clinical.get("history_of_present_illness", ""), styles['BodyText9']))
    elements.append(Spacer(1, 6))

    # Motor Function Assessment
    elements.append(Paragraph("<b>MOTOR FUNCTION ASSESSMENT</b>", styles['SectionTitle']))

    motor_pairs = []
    if disease.get("sma_type"):
        motor_pairs.append(("SMA Type:", disease["sma_type"]))
    if disease.get("motor_milestone_status"):
        motor_pairs.append(("Motor Milestones:", disease["motor_milestone_status"]))
    if disease.get("current_motor_function"):
        motor_pairs.append(("Current Motor Function:", disease["current_motor_function"]))
    if disease.get("hfmse_score") is not None:
        hfmse_text = f"{disease['hfmse_score']}"
        if disease.get("hfmse_prior"):
            hfmse_text += f" (prior: {disease['hfmse_prior']}, decline: {disease.get('hfmse_decline', '')} points)"
        motor_pairs.append(("HFMSE Score:", hfmse_text))
    if disease.get("chop_intend_score") is not None:
        motor_pairs.append(("CHOP INTEND Score:", f"{disease['chop_intend_score']} ({disease.get('chop_intend_interpretation', '')})"))
    if disease.get("feeding_status"):
        motor_pairs.append(("Feeding Status:", disease["feeding_status"]))
    if disease.get("respiratory_status"):
        motor_pairs.append(("Respiratory Status:", disease["respiratory_status"]))
    if disease.get("ventilator_dependent") is not None:
        motor_pairs.append(("Ventilator Dependent:", "Yes" if disease["ventilator_dependent"] else "No"))

    if motor_pairs:
        elements.append(build_kv_table(motor_pairs, col_widths=[2.0 * inch, 4.5 * inch]))
    elements.append(Spacer(1, 6))

    # Assessment
    elements.append(Paragraph("<b>ASSESSMENT AND PLAN</b>", styles['SectionTitle']))
    rationale = clinical.get("rationale_for_spinraza_after_gene_therapy", "")
    if rationale:
        elements.append(Paragraph(f"<b>Rationale for Spinraza:</b> {rationale}", styles['BodyText9']))
    elements.append(Paragraph(
        f"Recommend initiation of {safe_get(data, 'medication_request', 'brand_name')} "
        f"({safe_get(data, 'medication_request', 'medication_name')}) therapy based on clinical assessment.",
        styles['BodyText9']
    ))
    elements.append(Spacer(1, 14))

    # Signature
    elements.append(Paragraph("________________________________________", styles['BodyText9']))
    elements.append(Paragraph(
        f"<b>{presc.get('name', '')}, {presc.get('credentials', '')}</b>",
        styles['BodyTextBold']
    ))
    elements.append(Paragraph(presc.get("specialty", ""), styles['BodyText9']))
    elements.append(Paragraph(f"NPI: {presc.get('npi', '')}", styles['BodyText9']))
    elements.append(Paragraph(f"Date: {fmt_date(disease.get('assessment_date', ''))}", styles['BodyText9']))

    doc.build(elements)


def generate_gene_therapy_record(data, output_path, styles):
    """Generate a Gene Therapy Treatment Record (Aiden - Zolgensma)."""
    doc = SimpleDocTemplate(
        str(output_path), pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch
    )
    elements = []
    demo = data.get("demographics", {})
    presc = data.get("prescriber", {})
    gt = data.get("prior_gene_therapy", {})
    p_addr = presc.get("address", {})

    # Header
    elements.append(Paragraph(presc.get("practice_name", "").upper(), styles['Letterhead']))
    elements.append(Paragraph("Department of Pediatric Neurology — Gene Therapy Program", styles['DocSubtitle']))
    elements.append(Paragraph(
        f"{p_addr.get('street', '')} | {p_addr.get('city', '')}, {p_addr.get('state', '')} {p_addr.get('zip', '')}",
        styles['DocSubtitle']
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=BCBS_BLUE, spaceAfter=8))

    elements.append(Paragraph("<b>GENE THERAPY TREATMENT RECORD</b>", ParagraphStyle(
        'rptTitle', fontSize=13, fontName='Helvetica-Bold', alignment=TA_CENTER,
        textColor=BCBS_BLUE, spaceAfter=8
    )))

    # Treatment details
    info_pairs = [
        ("Patient:", f"{demo.get('first_name', '')} {demo.get('last_name', '')}"),
        ("DOB:", demo.get("date_of_birth", "")),
        ("MRN:", data.get("patient_id", "").upper()),
        ("Therapy:", f"{gt.get('therapy_name', '')} ({gt.get('brand_name', '')})"),
        ("Administration Date:", gt.get("administration_date", "")),
        ("Age at Administration:", gt.get("age_at_administration", "")),
        ("Dose:", gt.get("dose", "")),
        ("Administering Facility:", gt.get("administering_facility", "")),
    ]
    elements.append(build_kv_table(info_pairs))
    elements.append(Spacer(1, 8))

    # Outcome
    elements.append(Paragraph("<b>TREATMENT OUTCOME</b>", styles['SectionTitle']))
    elements.append(Paragraph(gt.get("outcome", ""), styles['BodyText9']))
    elements.append(Spacer(1, 6))

    # Anti-AAV9
    aav9 = gt.get("anti_aav9_antibodies", "")
    if aav9:
        elements.append(Paragraph("<b>ANTI-AAV9 ANTIBODY STATUS</b>", styles['SectionTitle']))
        imp_data = [[Paragraph(
            f"<b>{aav9}</b>",
            ParagraphStyle('imp', fontSize=9, fontName='Helvetica-Bold', leading=12)
        )]]
        imp_t = Table(imp_data, colWidths=[6.1 * inch])
        imp_t.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#CC0000")),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FFF0F0")),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(imp_t)

    elements.append(Spacer(1, 14))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.gray, spaceAfter=4))
    elements.append(Paragraph(
        f"<b>Electronically signed by:</b> {presc.get('name', '')}, {presc.get('credentials', '')} | "
        f"{presc.get('practice_name', '')}",
        styles['SmallCenter']
    ))

    doc.build(elements)


def generate_newborn_screening_report(data, output_path, styles):
    """Generate a Newborn Screening Report (Sofia)."""
    doc = SimpleDocTemplate(
        str(output_path), pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch
    )
    elements = []
    demo = data.get("demographics", {})
    genetic = data.get("genetic_testing", {})
    nbs = genetic.get("newborn_screening", {})

    # Header
    elements.append(Paragraph("ARIZONA NEWBORN SCREENING PROGRAM", styles['DocTitle']))
    elements.append(Paragraph("Arizona Department of Health Services — State Public Health Laboratory", styles['DocSubtitle']))
    elements.append(Paragraph("250 North 17th Avenue | Phoenix, AZ 85007", styles['DocSubtitle']))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=BCBS_BLUE, spaceAfter=8))

    elements.append(Paragraph("<b>NEWBORN SCREENING REPORT</b>", ParagraphStyle(
        'rptTitle', fontSize=13, fontName='Helvetica-Bold', alignment=TA_CENTER,
        textColor=BCBS_BLUE, spaceAfter=8
    )))

    # Patient info
    info_pairs = [
        ("Newborn:", f"{demo.get('first_name', '')} {demo.get('last_name', '')}"),
        ("DOB:", demo.get("date_of_birth", "")),
        ("Sex:", demo.get("gender", "")),
        ("MRN:", data.get("patient_id", "").upper()),
        ("Collection Date:", nbs.get("test_date", "")),
        ("Screening Program:", nbs.get("screening_program", "")),
    ]
    elements.append(build_kv_table(info_pairs))
    elements.append(Spacer(1, 8))

    # Results
    elements.append(Paragraph("<b>SCREENING RESULTS</b>", styles['SectionTitle']))

    parent = demo.get("parent_guardian", {})

    res_header = [
        Paragraph('<b>Condition</b>', styles['FieldLabel']),
        Paragraph('<b>Result</b>', styles['FieldLabel']),
        Paragraph('<b>Action Required</b>', styles['FieldLabel']),
    ]
    res_data = [res_header]
    res_data.append([
        Paragraph("Spinal Muscular Atrophy (SMA)", styles['FieldValue']),
        Paragraph(f'<b><font color="#CC0000">POSITIVE — SMN1 deletion detected</font></b>', styles['FieldValue']),
        Paragraph("URGENT: Confirmatory genetic testing and pediatric neurology referral required", styles['FieldValue']),
    ])
    # Add a few normal results for realism
    for condition in ["Cystic Fibrosis", "Sickle Cell Disease", "PKU", "Congenital Hypothyroidism"]:
        res_data.append([
            Paragraph(condition, styles['FieldValue']),
            Paragraph("Normal", styles['FieldValue']),
            Paragraph("None", styles['FieldValue']),
        ])

    rt = Table(res_data, colWidths=[2.0 * inch, 2.2 * inch, 2.3 * inch])
    rt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, MEDIUM_GRAY),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#FFF0F0")),
    ]))
    elements.append(rt)
    elements.append(Spacer(1, 8))

    # Critical alert box
    alert_data = [[Paragraph(
        '<b>CRITICAL RESULT — IMMEDIATE FOLLOW-UP REQUIRED</b><br/><br/>'
        'SMA screening POSITIVE: SMN1 gene deletion detected. This result requires immediate '
        'confirmatory genetic testing (SMN1/SMN2 copy number analysis) and urgent referral to '
        'pediatric neurology. Early treatment in presymptomatic SMA is associated with significantly '
        'better motor outcomes.',
        ParagraphStyle('alert', fontSize=9, fontName='Helvetica', leading=12, textColor=colors.HexColor("#660000"))
    )]]
    at = Table(alert_data, colWidths=[6.1 * inch])
    at.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 2, colors.HexColor("#CC0000")),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FFF0F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(at)

    elements.append(Spacer(1, 14))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.gray, spaceAfter=4))
    elements.append(Paragraph(
        "<b>Laboratory Director:</b> NBS Laboratory Director, PhD | Arizona Department of Health Services",
        styles['SmallCenter']
    ))
    elements.append(Paragraph(
        f"Report generated: {fmt_date(nbs.get('test_date', ''))} | Confidential medical information.",
        styles['SmallCenter']
    ))

    doc.build(elements)


def generate_echocardiogram_report(data, output_path, styles):
    """Generate an Echocardiogram Report (Robert)."""
    doc = SimpleDocTemplate(
        str(output_path), pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch
    )
    elements = []
    demo = data.get("demographics", {})
    presc = data.get("prescriber", {})
    echo = safe_get(data, "procedures", "echocardiogram", default={})
    organ = safe_get(data, "organ_function_assessment", "cardiac", default={})
    p_addr = presc.get("address", {})

    # Header
    elements.append(Paragraph("DEPARTMENT OF CARDIOVASCULAR IMAGING", styles['DocTitle']))
    elements.append(Paragraph(presc.get("practice_name", ""), styles['DocSubtitle']))
    elements.append(Paragraph(
        f"{p_addr.get('street', '')} | {p_addr.get('city', '')}, {p_addr.get('state', '')} {p_addr.get('zip', '')}",
        styles['DocSubtitle']
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=BCBS_BLUE, spaceAfter=8))

    elements.append(Paragraph("<b>TRANSTHORACIC ECHOCARDIOGRAM REPORT</b>", ParagraphStyle(
        'rptTitle', fontSize=13, fontName='Helvetica-Bold', alignment=TA_CENTER,
        textColor=BCBS_BLUE, spaceAfter=8
    )))

    # Patient info
    info_pairs = [
        ("Patient:", f"{demo.get('first_name', '')} {demo.get('last_name', '')}"),
        ("DOB:", demo.get("date_of_birth", "")),
        ("MRN:", data.get("patient_id", "").upper()),
        ("Exam Date:", echo.get("procedure_date", organ.get("date", ""))),
        ("Ordering Physician:", presc.get("name", "")),
        ("Indication:", "Pre-CAR-T cardiac assessment; known HFmrEF"),
    ]
    elements.append(build_kv_table(info_pairs))
    elements.append(Spacer(1, 8))

    # Technique
    elements.append(Paragraph("<b>TECHNIQUE</b>", styles['SectionTitle']))
    elements.append(Paragraph(
        "Complete 2D and M-mode transthoracic echocardiogram performed with Doppler and color flow imaging. "
        "Standard parasternal, apical, and subcostal views obtained. Image quality: adequate.",
        styles['BodyText9']
    ))
    elements.append(Spacer(1, 6))

    # Findings table
    elements.append(Paragraph("<b>FINDINGS</b>", styles['SectionTitle']))

    findings = echo.get("findings", "")
    lvef = organ.get("lvef", "")

    echo_pairs = [
        ("Left Ventricular EF:", f"{lvef} (biplane Simpson's method)"),
        ("LV Wall Motion:", "Global mild hypokinesis"),
        ("LV Size:", "Normal"),
        ("LV Wall Thickness:", "Mild concentric hypertrophy"),
        ("Diastolic Function:", "Grade I diastolic dysfunction (impaired relaxation)"),
        ("Right Ventricle:", "Normal size and function"),
        ("Valvular Function:", "No significant valvular disease"),
        ("Pericardium:", "No effusion"),
    ]
    elements.append(build_kv_table(echo_pairs))
    elements.append(Spacer(1, 8))

    # Impression
    elements.append(Paragraph("<b>IMPRESSION</b>", styles['SectionTitle']))
    imp_text = findings if findings else (
        f"LVEF {lvef}. Mild concentric LV hypertrophy. Grade I diastolic dysfunction. "
        "No significant valvular disease."
    )
    imp_data = [[Paragraph(
        f"<b>{imp_text}</b>",
        ParagraphStyle('imp', fontSize=9, fontName='Helvetica-Bold', leading=12)
    )]]
    imp_t = Table(imp_data, colWidths=[6.1 * inch])
    imp_t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, BCBS_BLUE),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F0F4FA")),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(imp_t)

    # Clinical note
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        "<b>Clinical Note:</b> Cardiology clearance provided for CAR-T cell therapy. Anthracycline "
        "remains contraindicated given HFmrEF with LVEF 45%. Recommend continued medical management "
        "of heart failure and close cardiac monitoring during and after cellular therapy.",
        styles['BodyText9']
    ))

    elements.append(Spacer(1, 14))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.gray, spaceAfter=4))
    elements.append(Paragraph(
        f"<b>Electronically signed by:</b> Cardiologist, MD, FACC | {presc.get('practice_name', '')}",
        styles['SmallCenter']
    ))
    elements.append(Paragraph(
        f"Report finalized: {fmt_date(echo.get('procedure_date', ''))} | Confidential.",
        styles['SmallCenter']
    ))

    doc.build(elements)


# ─── Filename → Generator Dispatch ───────────────────────────────────────────

FILENAME_DISPATCH = {
    "Prior_Auth": generate_pa_form,
    "Laboratory": generate_laboratory_results,
    "Clinical_Summary": generate_clinical_summary,
    "PET_CT": generate_pet_ct_report,
    "Bone_Marrow": generate_bone_marrow_biopsy,
    "Pathology": generate_pathology_report,
    "Imaging": generate_imaging_report,
    "Genetic_Testing": generate_genetic_testing_report,
    "Neurology": generate_neurology_assessment,
    "Gene_Therapy": generate_gene_therapy_record,
    "Newborn_Screening": generate_newborn_screening_report,
    "Echocardiogram": generate_echocardiogram_report,
}


def dispatch_generator(filename):
    """Map a PDF filename to its generator function."""
    for key, func in FILENAME_DISPATCH.items():
        if key in filename:
            return func
    return None


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    styles = get_styles()
    total_generated = 0
    total_errors = 0

    print("=" * 70)
    print("  BCBS Patient PDF Generator")
    print("  Generating clinical source documents for 12 patients")
    print("=" * 70)

    for patient_id in BCBS_PATIENTS:
        json_path = DATA_DIR / f"{patient_id}.json"
        if not json_path.exists():
            print(f"\n  [SKIP] {patient_id}: JSON file not found at {json_path}")
            continue

        with open(json_path) as f:
            data = json.load(f)

        pdfs = safe_get(data, "extraction_metadata", "extracted_from", default=[])
        if not pdfs:
            print(f"\n  [SKIP] {patient_id}: No extracted_from PDFs listed")
            continue

        # Create patient directory
        patient_dir = DATA_DIR / patient_id
        patient_dir.mkdir(exist_ok=True)

        print(f"\n  [{patient_id}] Generating {len(pdfs)} PDFs → {patient_dir}/")

        for pdf_name in pdfs:
            output_path = patient_dir / pdf_name
            generator = dispatch_generator(pdf_name)

            if generator is None:
                print(f"    ✗ {pdf_name} — no matching generator")
                total_errors += 1
                continue

            try:
                generator(data, output_path, styles)
                size_kb = output_path.stat().st_size / 1024
                print(f"    ✓ {pdf_name} ({size_kb:.1f} KB)")
                total_generated += 1
            except Exception as e:
                print(f"    ✗ {pdf_name} — ERROR: {e}")
                total_errors += 1

    print(f"\n{'=' * 70}")
    print(f"  COMPLETE: {total_generated} PDFs generated, {total_errors} errors")
    print(f"{'=' * 70}")

    if total_errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
