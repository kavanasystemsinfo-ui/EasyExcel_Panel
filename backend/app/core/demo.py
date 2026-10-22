"""Workbook demo publico: se siembra bajo demanda y es de solo lectura."""

import hashlib
import random
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
from typing import Any

from openpyxl import Workbook

from app.core.config import BACKEND_DIR, settings
from app.core.storage import WorkbookStorage

DEMO_FILENAME = "easyexcel_demo.xlsx"
DEMO_ALIAS = "demo"
DEMO_ID = hashlib.sha256(b"easyexcel:demo:v7").hexdigest()[:32]


def _generate_ceramica_demo() -> bytes:
    """Genera el Excel demo de planta cerámica programáticamente (ADR-0008)."""
    random.seed(20261020)

    CATEGORIAS = [
        "Encargado de turno",
        "Operario de prensa",
        "Operario de esmaltado",
        "Técnico de calidad",
        "Mantenimiento",
        "Mozo de almacén",
    ]
    TIPOS_CONTRATO = ["Indefinido", "Temporal", "Fijo Discontinuo", "Practicas"]
    JORNADAS = ["Completa", "Parcial", "Turno Día", "Turno Noche"]
    ZONAS = ["Prensa", "Esmaltado", "Horno", "Almacén", "Calidad", "Oficina"]

    OBS_OPTIONS = [
        "Disponible fines semana",
        "Experiencia en horno",
        "Formación de esmaltado",
        "",
        "Turno rotativo",
    ]

    # Empleados (50)
    empleados: list[list[Any]] = []
    for i in range(1, 51):
        emp_id = f"EMP{i:03d}"
        nombre = (
            random.choice(
                [
                    "Mario",
                    "Juan",
                    "Pedro",
                    "Luis",
                    "David",
                    "Carlos",
                    "Miguel",
                    "Antonio",
                    "José",
                    "Francisco",
                ]
            )
            + " "
            + random.choice(["Garcia", "Lopez", "Fernandez", "Rodriguez", "Gonzalez"])
        )
        numero_dni = random.randint(10000000, 99999999)
        letra_dni = "TRWAGMYFPDXBNJZSQVHLCKE"[random.randint(0, 22)]
        dni = f"{numero_dni}{letra_dni}"
        telefono = f"96{random.randint(1000000, 9999999)}"
        email = f"{nombre.lower().replace(' ', '.')}@ceramicaturia.es"
        categoria = random.choice(CATEGORIAS)
        tipo_contrato = random.choice(TIPOS_CONTRATO)
        jornada = random.choice(JORNADAS)
        fecha_alta = date(2024, 1, 15) + timedelta(days=random.randint(0, 730))
        fecha_baja = None
        centro_coste = random.choice(["CC01", "CC02", "CC03", "CC04", "CC05"])
        zona_asignada = random.choice(ZONAS)
        turno_habitual = random.choice(["Mañana", "Tarde", "Noche", "Rotativo"])
        horas_semanales = random.randint(20, 40)
        salario_base = round(random.uniform(1800, 3500), 2)
        plus_turnicidad = 0
        plus_nocturnidad = 0
        plus_penosidad = 0
        estado = random.choice(["Activo", "Activo", "Activo", "Baja", "IT"])
        observaciones = random.choice(OBS_OPTIONS)
        foto_url = f"https://ceramicaturia.es/fotos/empleados/{emp_id}.jpg"
        empleados.append(
            [
                emp_id,
                nombre,
                dni,
                telefono,
                email,
                categoria,
                tipo_contrato,
                jornada,
                fecha_alta,
                fecha_baja,
                centro_coste,
                zona_asignada,
                turno_habitual,
                horas_semanales,
                salario_base,
                plus_turnicidad,
                plus_nocturnidad,
                plus_penosidad,
                estado,
                observaciones,
                foto_url,
            ]
        )

    # Centros (6)
    centros = []
    nombres_centros = [
        "Planta Norte",
        "Planta Sur",
        "Esmaltado Central",
        "Almacén de Terminado",
        "Oficina Central",
        "Laboratorio de Calidad",
    ]
    for i in range(1, 7):
        centro_id = f"CC{i:02d}"
        nombre = nombres_centros[i - 1]
        zona = random.choice(ZONAS)
        telefono = f"96{random.randint(1000000, 9999999)}"
        responsable = (
            random.choice(
                [
                    "Mario García",
                    "Juan Lopez",
                    "Pedro Fernandez",
                    "Luis Rodriguez",
                    "David Gonzalez",
                    "Carlos Martín",
                ]
            )
            + " (Cerámica Turia)"
        )
        inicio_servicio = date(2020, 1, 1) + timedelta(days=random.randint(0, 2000))
        superficie_m2 = random.randint(500, 5000)
        plantilla_asignada = random.randint(5, 50)
        centros.append(
            [
                centro_id,
                nombre,
                "Cerámica Turia S.A.",
                f"Calle Cerámica {i}, Polígono Industrial",
                zona,
                telefono,
                responsable,
                inicio_servicio,
                superficie_m2,
                plantilla_asignada,
                "Activo",
            ]
        )

    # Asignaciones (50 - one per employee)
    asignaciones = []
    for emp in empleados:
        emp_id = emp[0]
        cc = emp[10]
        cc_obj = centros[int(cc[2:]) - 1] if cc[2:] else centros[0]
        asignaciones.append(
            [
                emp_id,
                cc_obj[0],
                cc_obj[1],
                date(2024, 1, 1) + timedelta(days=random.randint(0, 365)),
                random.choice(["Activo", "Inactivo"]),
                random.randint(1, 50),
            ]
        )

    # Contratos (50)
    contratos = []
    for emp in empleados:
        emp_id = emp[0]
        tipo = emp[6]
        fecha_ini = date(2024, 1, 15) + timedelta(days=random.randint(0, 365))
        fecha_fin = None
        if tipo == "Temporal":
            fecha_fin = date(2025, 1, 1) + timedelta(days=random.randint(0, 365))
        elif tipo == "Fijo Discontinuo":
            fecha_fin = None
        else:
            fecha_fin = None
        contratos.append(
            [
                emp_id,
                tipo,
                "Cerámica Turia S.A.",
                fecha_ini,
                fecha_fin,
                random.choice(["Indefinido", "Definido"]),
            ]
        )

    # Vacaciones (10 employees)
    vacaciones = []
    for i in range(0, 50, 5):
        emp = empleados[i]
        emp_id = emp[0]
        fecha_inicio = date(2026, 6, 1) + timedelta(days=random.randint(0, 180))
        fecha_fin = fecha_inicio + timedelta(days=random.randint(10, 21))
        estado = "Vacaciones"
        observacion = "Días naturales"
        vacaciones.append([emp_id, fecha_inicio, fecha_fin, estado, observacion])

    # Proveedores (10)
    proveedores = []
    for i in range(1, 11):
        cif = f"B{random.randint(10000000, 99999999)}"
        servicio = random.choice(
            ["Arcilla y caolín", "Esmaltes y engobes", "Refractarios", "Paletizado", "Energía"]
        )
        nombre_contacto = random.choice(["Mario", "Juan", "Pedro"])
        apellido_contacto = random.choice(["Garcia", "Lopez", "Fernandez"])
        contacto = f"Contacto {nombre_contacto} {apellido_contacto}"
        telefono_prov = f"96{random.randint(1000000, 9999999)}"
        proveedores.append(
            [
                f"PROV{i:02d}",
                f"Suministros Cerámicos {i}",
                cif,
                servicio,
                contacto,
                telefono_prov,
                f"contacto@comp{i}.com",
                f"Calle Proveedor {i}, Valencia",
                "Si",
                date(2026, 1, 1) + timedelta(days=random.randint(0, 30)),
                random.randint(500, 5000) * 10,
                random.randint(3, 5),
            ]
        )

    # Auditorias (30)
    auditorias = []
    hallazgos = [
        "Pieza sin etiquetar en paleta de expedición",
        "Temperatura de horno fuera de curva",
        "Falta de EPIs en el almacén",
        "Programa de mantenimiento sin firma",
        "Contenedor de residuos sin etiquetar",
        "Lote sin documentación de conformidad",
        "Maquinaria sin etiqueta de revisión",
        "Polvo de esmalte en zona de traslado",
    ]
    acciones = [
        "Curva térmica revisada y etiquetado repuesto",
        "Reposición de EPIs y formación al equipo del turno",
        "Firma y archivo del programa de mantenimiento",
        "Contenedor etiquetado y formación de segregación",
        "Revisión semanal añadida al plan del centro",
        "Revisión preventiva adelantada y etiquetado",
    ]
    for i in range(30):
        auditorias.append(
            [
                f"AUD{i:03d}",
                f"MAQ{random.randint(1, 50):03d}",
                date(2026, 1, 10) + timedelta(days=random.randint(0, 200)),
                random.choice(["Preventiva", "Correctiva", "ITV"]),
                random.choice(["Conforme", "Con hallazgos", "No conforme"]),
                random.choice(
                    [
                        "Elena Sanchis",
                        "Marco Ferrandis",
                        "Laura Bouchar",
                        "Sergio Picó",
                        "Nerea Tortajada",
                    ]
                ),
                random.randint(5, 35) * 10,
                random.choice(hallazgos),
                random.choice(acciones),
                "Cerrada" if random.random() > 0.3 else "Abierta",
            ]
        )

    # Maquinaria (30)
    maquinaria = []
    tipos = [
        ("Prensa de embutición", "Premsa", "EP-2400", 86000),
        ("Prensa de alta tabla", "TecnoPrensa", "AT-1600", 74000),
        ("Horno de rodillo", "HornoTech", "HR-160", 132000),
        ("Horno de bizcocho", "HornoTech", "HB-90", 98000),
        ("Línea de esmaltado", "Esmaltek", "LE-4", 56000),
        ("Secadora de bandejas", "CeramSec", "SB-12", 21000),
        ("Envolvedora automática", "Paletia", "EA-360", 17500),
        ("Carretilla elevadora", "Elevcar", "EC-25", 24000),
        ("Compresor de tornillo", "AireTech", "CT-45", 12800),
        ("Molino de bola", "CeramGrind", "MG-8", 31000),
    ]
    centros_ids = ["CC01", "CC02", "CC03", "CC04", "CC05"]
    for i in range(30):
        tipo, marca, modelo, coste = random.choice(tipos)
        compra = date(2018, 1, 1) + timedelta(days=random.randint(0, 3000))
        garantia = date(2020, 1, 1) + timedelta(days=random.randint(0, 1460))
        estado = random.choices(["Operativa", "En mantenimiento", "Baja"], weights=[80, 13, 7])[0]
        proxima = (
            None if estado == "Baja" else date(2026, 10, 20) + timedelta(days=random.randint(5, 90))
        )
        m_id = f"MAQ{i + 1:03d}"
        proveedor_mant = f"PROV{random.randint(1, 10):02d}"
        maquinaria.append(
            [
                m_id,
                tipo,
                marca,
                modelo,
                f"{marca[:2].upper()}{random.randint(100000, 999999)}",
                random.choice(centros_ids),
                compra,
                garantia,
                coste,
                estado,
                proxima,
                proveedor_mant,
            ]
        )

    # Revisiones (20)
    revisiones = []
    for i in range(20):
        m_idx = i % 30
        maquinaria_item = maquinaria[m_idx]
        if maquinaria_item[9] == "Baja" and i < 15:
            continue
        n = i + 1
        fecha = date(2026, 1, 5) + timedelta(days=random.randint(0, 290))
        tipo = random.choice(["Preventiva", "Correctiva", "ITV"])
        if i % 3 == 0:
            resultado = "Conforme"
        elif i % 3 == 1:
            resultado = "Con hallazgos"
        else:
            resultado = "No conforme"
        tecnico = (
            random.choice(["Mario", "Juan", "Pedro", "Luis", "David"])
            + " "
            + random.choice(["García", "López", "Fernández", "Rodríguez", "González"])
        )
        costo = random.randint(5, 35) * 10 if tipo != "Preventiva" else 0
        obs_map = {
            "Conforme": "Equipo operativo, sin observaciones",
            "Con hallazgos": "Se sustituyen filtros y se revisa instalación eléctrica",
            "No conforme": "Equipo parado hasta sustitución de componente principal",
        }
        observaciones = obs_map[resultado]
        revisiones.append(
            [
                f"REV{n:03d}",
                maquinaria_item[0],
                fecha,
                tipo,
                resultado,
                tecnico,
                costo,
                observaciones,
            ]
        )

    # Create workbook
    wb = Workbook()

    # 1. Empleados
    ws_emp = wb.active
    ws_emp.title = "Empleados"
    ws_emp.append(
        [
            "ID",
            "Nombre Completo",
            "DNI/NIE",
            "Telefono",
            "Email",
            "Categoria",
            "Tipo Contrato",
            "Jornada",
            "Fecha Alta",
            "Fecha Baja",
            "Centro Coste",
            "Zona Asignada",
            "Turno Habitual",
            "Horas Semanales",
            "Salario Base",
            "Plus Turnicidad",
            "Plus Nocturnidad",
            "Plus Penosidad",
            "Estado",
            "Observaciones",
            "Foto URL",
        ]
    )
    for emp in empleados:
        ws_emp.append(emp)

    # 2. Centros
    ws_cent = wb.create_sheet("Centros")
    ws_cent.append(
        [
            "ID Centro",
            "Nombre",
            "Cliente",
            "Direccion",
            "Zona",
            "Telefono",
            "Responsable",
            "Inicio Servicio",
            "Superficie m2",
            "Plantilla Asignada",
            "Estado",
        ]
    )
    for c in centros:
        ws_cent.append(c)

    # 3. Asignaciones
    ws_asi = wb.create_sheet("Asignaciones")
    ws_asi.append(
        [
            "ID Empleado",
            "ID Centro",
            "Nombre Centro",
            "Fecha Asignacion",
            "Estado",
            "Horas Semanales",
        ]
    )
    for a in asignaciones:
        ws_asi.append(a)

    # 4. Contratos
    ws_contr = wb.create_sheet("Contratos")
    ws_contr.append(
        ["ID Empleado", "Tipo Contrato", "Empresa", "Fecha Inicio", "Fecha Fin", "Estado"]
    )
    for c in contratos:
        ws_contr.append(c)

    # 5. Vacaciones
    ws_vac = wb.create_sheet("Vacaciones")
    ws_vac.append(["ID Empleado", "Fecha Inicio", "Fecha Fin", "Estado", "Observaciones"])
    for v in vacaciones:
        ws_vac.append(v)

    # 6. Proveedores
    ws_prov = wb.create_sheet("Proveedores")
    ws_prov.append(
        [
            "ID",
            "Nombre",
            "CIF",
            "Servicio",
            "Contacto",
            "Telefono",
            "Email",
            "Direccion",
            "Activo",
            "Ultimo Pedido",
            "Puntuacion",
        ]
    )
    for p in proveedores:
        ws_prov.append(p)

    # 7. Auditorias
    ws_aud = wb.create_sheet("Auditorias")
    ws_aud.append(
        [
            "ID",
            "Maquinaria",
            "Fecha",
            "Tipo",
            "Resultado",
            "Tecnico",
            "Coste",
            "Hallazgo",
            "Accion",
            "Estado",
        ]
    )
    for a in auditorias:
        ws_aud.append(a)

    # 8. Maquinaria
    ws_maq = wb.create_sheet("Maquinaria")
    ws_maq.append(
        [
            "ID",
            "Tipo",
            "Marca",
            "Modelo",
            "Serie",
            "Centro",
            "Fecha Compra",
            "Garantia Hasta",
            "Coste",
            "Estado",
            "Proxima Revision",
            "Proveedor Mantenimiento",
        ]
    )
    for m in maquinaria:
        ws_maq.append(m)

    # 9. Revisiones
    ws_rev = wb.create_sheet("Revisiones")
    ws_rev.append(
        ["ID", "Maquinaria", "Fecha", "Tipo", "Resultado", "Tecnico", "Coste", "Observaciones"]
    )
    for r in revisiones:
        ws_rev.append(r)

    # 10. Info
    ws_info = wb.create_sheet("Info")
    ws_info.append(["Proyecto", "EasyExcel Demo Cerámica"])
    ws_info.append(["Fecha Generacion", date.today().isoformat()])
    ws_info.append(["Total Empleados", len(empleados)])
    ws_info.append(["Total Centros", len(centros)])
    ws_info.append(["Total Maquinaria", len(maquinaria)])

    # Save to bytes
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _source() -> Path:
    # FORZAR generación programática: devolver path que no existe
    # para que ensure_demo() genere el Excel en memoria
    return BACKEND_DIR / "data" / "DO_NOT_USE_THIS_FILE.xlsx"


def ensure_demo() -> dict | None:
    """Crea el workbook demo si no existe y devuelve su manifest.

    Si falta data/easyexcel_demo.xlsx lo genera programáticamente.
    Idempotente: con el manifest presente solo lee el JSON.
    """
    source = _source()
    # Si no existe el archivo, generarlo en memoria
    if not source.is_file():
        source_bytes = _generate_ceramica_demo()
    else:
        source_bytes = source.read_bytes()

    storage = WorkbookStorage(settings.upload_dir)
    manifest = storage.get(DEMO_ID)
    if manifest is not None:
        return manifest
    storage.save_book_as(DEMO_ID, source_bytes)
    try:
        from app.domain import excel_parser

        sheets: list[dict] = excel_parser.extract_metadata(storage.book_path(DEMO_ID))
    except Exception:
        storage.delete(DEMO_ID)
        raise
    return storage.finalize(DEMO_ID, DEMO_FILENAME, sheets)
