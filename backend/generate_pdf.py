# -*- coding: utf-8 -*-
import sys
import json
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)

# Reconfigure stdin/stdout to use utf-8 to avoid encoding issues on Windows/Linux
try:
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass # Python version < 3.7

# Load dynamic data from standard input
try:
    input_data = sys.stdin.read()
    data = json.loads(input_data)
except Exception as e:
    print(json.dumps({"error": f"Failed to parse input JSON: {str(e)}"}))
    sys.exit(1)

OUTPUT = data.get("output_filename", "Informe_Tecnico.pdf")

DARK_BLUE  = colors.HexColor("#1A2E4A")
MID_BLUE   = colors.HexColor("#2B5286")
ACCENT     = colors.HexColor("#E8A020")
LIGHT_GRAY = colors.HexColor("#F4F6F9")
MED_GRAY   = colors.HexColor("#D0D7E0")
WHITE      = colors.white
RED_RISK   = colors.HexColor("#C0392B")
GREEN_OK   = colors.HexColor("#1E7A4E")
GRAY_TXT   = colors.HexColor("#2D2D2D")
ORANGE     = colors.HexColor("#D35400")

# Fetch vehicle details
veh = data.get("datos_vehiculo", {})
placa = veh.get("placa", "N/A")
marca_modelo = veh.get("marca_modelo", "N/A")
cliente = veh.get("cliente", "N/A")
fecha = veh.get("fecha", "N/A")
motivo = veh.get("motivo", "N/A")
referencia = veh.get("referencia", "N/A")

doc = SimpleDocTemplate(
    OUTPUT, pagesize=letter,
    leftMargin=2*cm, rightMargin=2*cm,
    topMargin=2.5*cm, bottomMargin=2.5*cm,
    title=f"Informe Técnico – {marca_modelo} {placa}",
    author="Automotriz Online SD"
)

styles = getSampleStyleSheet()

def s(name, **kw):
    base = styles[name] if name in styles else styles["Normal"]
    return ParagraphStyle(name + "_cust_" + str(id(kw)), parent=base, **kw)

section_title = s("Heading1",
    fontName="Helvetica-Bold", fontSize=11, textColor=WHITE,
    backColor=MID_BLUE, spaceBefore=10, spaceAfter=6,
    leftIndent=-0.3*cm, rightIndent=-0.3*cm, borderPad=5)

subsection_title = s("Heading2",
    fontName="Helvetica-Bold", fontSize=10, textColor=DARK_BLUE,
    spaceBefore=8, spaceAfter=3)

body = s("Normal",
    fontName="Helvetica", fontSize=9, textColor=GRAY_TXT,
    leading=14, alignment=TA_JUSTIFY, spaceAfter=4)

label_style = s("Normal",
    fontName="Helvetica-Bold", fontSize=9, textColor=DARK_BLUE, spaceAfter=2)

value_style = s("Normal",
    fontName="Helvetica", fontSize=9, textColor=GRAY_TXT, spaceAfter=2)

story = []

# ══════════════════════════════════════════════════════════════
# HEADER
# ══════════════════════════════════════════════════════════════
header_data = [[
    Paragraph("<b>AUTOMOTRIZ ONLINE SD</b>", s("Normal",
        fontName="Helvetica-Bold", fontSize=13, textColor=WHITE, alignment=TA_LEFT)),
    Paragraph("INFORME TÉCNICO DE MANTENIMIENTO", s("Normal",
        fontName="Helvetica-Bold", fontSize=14, textColor=WHITE, alignment=TA_CENTER)),
    Paragraph("Av. 6 Norte #18-22, Granada<br/>Cali, Colombia<br/>301 469 7942", s("Normal",
        fontName="Helvetica", fontSize=8, textColor=WHITE, alignment=TA_CENTER)),
]]
ht = Table(header_data, colWidths=[5*cm, 9*cm, 4*cm])
ht.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,-1),DARK_BLUE),("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
    ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
]))
story.append(ht)
ab = Table([[""]], colWidths=[doc.width], rowHeights=[0.35*cm])
ab.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),ACCENT)]))
story.append(ab)
story.append(Spacer(1,0.4*cm))

# ══════════════════════════════════════════════════════════════
# FICHA
# ══════════════════════════════════════════════════════════════
veh_data = [
    [Paragraph("<b>DATOS DEL VEHÍCULO</b>", s("Normal",
        fontName="Helvetica-Bold", fontSize=10, textColor=WHITE)), "", "", ""],
    [Paragraph("<b>Marca / Modelo</b>", label_style),
     Paragraph(marca_modelo, value_style),
     Paragraph("<b>Placa</b>", label_style),
     Paragraph(placa, value_style)],
    [Paragraph("<b>Cliente</b>", label_style),
     Paragraph(cliente, value_style),
     Paragraph("<b>Fecha</b>", label_style),
     Paragraph(fecha, value_style)],
    [Paragraph("<b>Motivo de ingreso</b>", label_style),
     Paragraph(motivo, value_style),
     Paragraph("<b>Ref.</b>", label_style),
     Paragraph(referencia, value_style)],
]
vt = Table(veh_data, colWidths=[3.5*cm,6.5*cm,3*cm,4.3*cm])
vt.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,0),MID_BLUE),("SPAN",(0,0),(-1,0)),
    ("ALIGN",(0,0),(-1,0),"CENTER"),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE,LIGHT_GRAY]),
    ("GRID",(0,0),(-1,-1),0.5,MED_GRAY),
    ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
    ("LEFTPADDING",(0,0),(-1,-1),7),
]))
story.append(vt)
story.append(Spacer(1,0.5*cm))

# ══════════════════════════════════════════════════════════════
# 1. OBJETO
# ══════════════════════════════════════════════════════════════
story.append(Paragraph("1. OBJETO", section_title))
story.append(Paragraph(data.get("objeto", ""), body))

# ══════════════════════════════════════════════════════════════
# 2. DESCRIPCIÓN DE INGRESO
# ══════════════════════════════════════════════════════════════
story.append(Paragraph("2. DESCRIPCIÓN DE INGRESO", section_title))
story.append(Paragraph(data.get("descripcion_ingreso", ""), body))

# ══════════════════════════════════════════════════════════════
# 3. DIAGNÓSTICO TÉCNICO
# ══════════════════════════════════════════════════════════════
story.append(Paragraph("3. DIAGNÓSTICO TÉCNICO", section_title))
story.append(Paragraph(
    "Tras la inspección de los sistemas del vehículo se identificaron las siguientes condiciones:", body))

def diag_block(num, titulo, hallazgo, causa_items, riesgo_items):
    elems = []
    elems.append(Paragraph(f"3.{num} {titulo}", subsection_title))
    elems.append(HRFlowable(width="100%", thickness=0.5, color=MED_GRAY, spaceAfter=4))
    elems.append(Paragraph(hallazgo, body))

    def ip(items, color):
        return [Paragraph(f"• {i}", s("Normal", fontName="Helvetica", fontSize=9,
            textColor=color, leading=13, spaceAfter=2)) for i in items]

    inner = [[
        [Paragraph("<b>Causa probable</b>", label_style)] + ip(causa_items, colors.HexColor("#1A4A8A")),
        [Paragraph("<b>Riesgo si no se atiende</b>", s("Normal",
            fontName="Helvetica-Bold", fontSize=9, textColor=RED_RISK, spaceAfter=2))] +
        ip(riesgo_items, RED_RISK),
    ]]
    it = Table(inner, colWidths=[8.65*cm, 8.65*cm])
    it.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("BACKGROUND",(0,0),(0,-1),colors.HexColor("#EBF1FB")),
        ("BACKGROUND",(1,0),(1,-1),colors.HexColor("#FDF0EF")),
        ("BOX",(0,0),(-1,-1),0.5,MED_GRAY),
        ("INNERGRID",(0,0),(-1,-1),0.5,MED_GRAY),
        ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
        ("LEFTPADDING",(0,0),(-1,-1),9),
    ]))
    elems.append(it)
    elems.append(Spacer(1,0.3*cm))
    return KeepTogether(elems)

# Dynamically populate diagnostics
for idx, diag in enumerate(data.get("diagnosticos", [])):
    story.append(diag_block(
        idx + 1,
        diag.get("titulo", "Revisión"),
        diag.get("hallazgo", ""),
        diag.get("causas", []),
        diag.get("riesgos", [])
    ))

# ══════════════════════════════════════════════════════════════
# 4. ALCANCE
# ══════════════════════════════════════════════════════════════
story.append(Paragraph("4. ALCANCE DEL MANTENIMIENTO E INTERVENCIÓN", section_title))

alcance_data = [
    [Paragraph("<b>#</b>", s("Normal", fontName="Helvetica-Bold", fontSize=9, textColor=WHITE)),
     Paragraph("<b>Tipo</b>", s("Normal", fontName="Helvetica-Bold", fontSize=9, textColor=WHITE)),
     Paragraph("<b>Descripción</b>", s("Normal", fontName="Helvetica-Bold", fontSize=9, textColor=WHITE))],
]

for idx, item in enumerate(data.get("alcance", [])):
    tipo = item.get("tipo", "Preventivo")
    color = GREEN_OK if tipo.lower() == "preventivo" else RED_RISK
    alcance_data.append([
        Paragraph(str(idx + 1), body),
        Paragraph(tipo, s("Normal", fontName="Helvetica-Bold", fontSize=9, textColor=color)),
        Paragraph(item.get("descripcion", ""), body)
    ])

# Handle empty scope safely
if len(alcance_data) == 1:
    alcance_data.append([
        Paragraph("-", body),
        Paragraph("N/A", body),
        Paragraph("No se registraron trabajos específicos en el alcance.", body)
    ])

at = Table(alcance_data, colWidths=[1*cm, 3*cm, 13.3*cm])
at.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,0), MID_BLUE),
    ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
    ("GRID",          (0,0), (-1,-1), 0.5, MED_GRAY),
    ("TOPPADDING",    (0,0), (-1,-1), 5),
    ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ("LEFTPADDING",   (0,0), (-1,-1), 7),
    ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ("ALIGN",         (0,0), (0,-1), "CENTER"),
]))
story.append(at)
story.append(Spacer(1, 0.5*cm))

# ══════════════════════════════════════════════════════════════
# 5. CONCLUSIÓN
# ══════════════════════════════════════════════════════════════
story.append(Paragraph("5. CONCLUSIÓN TÉCNICA", section_title))
story.append(Paragraph(data.get("conclusion", ""), body))
story.append(Spacer(1, 0.2*cm))

# Recommendation / Alert Box
recom_text = data.get("recomendacion_alerta", "")
if recom_text:
    alerta = Table([[
        Paragraph(
            f"<b>⚠ RECOMENDACIÓN:</b> {recom_text}",
            s("Normal", fontName="Helvetica", fontSize=9, textColor=RED_RISK,
              leading=14, alignment=TA_JUSTIFY))
    ]], colWidths=[doc.width])
    alerta.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), colors.HexColor("#FDF0EF")),
        ("BOX",           (0,0), (-1,-1), 1.5, RED_RISK),
        ("TOPPADDING",    (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("LEFTPADDING",   (0,0), (-1,-1), 12),
        ("RIGHTPADDING",  (0,0), (-1,-1), 12),
    ]))
    story.append(alerta)
    story.append(Spacer(1, 0.4*cm))

# Visible-condition disclaimer
disclaimer = Table([[
    Paragraph(
        "<b>⚠ Nota importante:</b> lo reportado en este informe corresponde únicamente a lo "
        "observado en el estado visible del vehículo al momento de la revisión. Pueden existir "
        "desgastes, fallas o daños ocultos no detectables sin desarme completo, que se "
        "identificarán solo al momento de intervenir el vehículo o posterior.",
        s("Normal", fontName="Helvetica", fontSize=8.5, textColor=colors.HexColor("#475569"),
          leading=13, alignment=TA_JUSTIFY))
]], colWidths=[doc.width])
disclaimer.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
    ("LINEBEFORE",    (0,0), (0,-1), 2, colors.HexColor("#64748B")),
    ("BOX",           (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
    ("TOPPADDING",    (0,0), (-1,-1), 8),
    ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ("LEFTPADDING",   (0,0), (-1,-1), 12),
    ("RIGHTPADDING",  (0,0), (-1,-1), 12),
]))
story.append(disclaimer)
story.append(Spacer(1, 0.3*cm))

# ══════════════════════════════════════════════════════════════
# 6. SOLICITUD
# ══════════════════════════════════════════════════════════════
story.append(Paragraph("6. SOLICITUD DE AUTORIZACIÓN", section_title))
story.append(Paragraph(
    "Con base en el diagnóstico técnico realizado, se solicita la autorización para ejecutar "
    "los trabajos de mantenimiento preventivo y correctivo descritos en el presente informe, "
    "con el fin de garantizar el correcto funcionamiento, la seguridad operativa y la "
    "continuidad del vehículo.",
    body))

# FOOTER
story.append(Spacer(1, 0.4*cm))
story.append(HRFlowable(width="100%", thickness=0.5, color=MID_BLUE))
story.append(Paragraph(
    "Automotriz Online SD · Av. 6 Norte #18-22, Barrio Granada, Cali, Colombia · Tel. 301 469 7942",
    s("Normal", fontName="Helvetica", fontSize=7.5,
      textColor=colors.HexColor("#666666"), alignment=TA_CENTER, spaceBefore=4)))

try:
    doc.build(story)
    # Output JSON string with filename to let the backend know the success state
    print(json.dumps({"success": True, "output": OUTPUT}))
except Exception as e:
    print(json.dumps({"error": f"Failed to build PDF: {str(e)}"}))
    sys.exit(1)
