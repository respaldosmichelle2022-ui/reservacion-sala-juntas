import os
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from database import db, Cita, CorreoDepartamento, Configuracion
from config import Config
from datetime import datetime, time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import threading

app = Flask(__name__)
app.config.from_object(Config)

# Inicializar Base de Datos
db.init_app(app)

DEPARTAMENTOS_PERMITIDOS = [
    'MARKETING',
    'ALMACEN',
    'TALLER Y CONTRALORIA',
    'RECURSOS HUMANOS',
    'TI',
    'ABASTECIMIENTO Y DESEMPEÑO COMERCIAL'
]

# Crear las tablas y poblar valores por defecto al iniciar la app
with app.app_context():
    db.create_all()
    
    # Destinatarios admin por defecto
    if not Configuracion.query.get('admin_destinatarios'):
        config_admin = Configuracion(
            clave='admin_destinatarios', 
            valor='auxiliarrh@michelle.com.mx,contraloriamichelle@gmail.com'
        )
        db.session.add(config_admin)
        
    # Correos de departamentos por defecto
    for dept in DEPARTAMENTOS_PERMITIDOS:
        if not CorreoDepartamento.query.get(dept):
            correo_defecto = f"{dept.lower().replace(' ', '_').replace('ñ', 'n')[:15]}@empresa.com"
            db.session.add(CorreoDepartamento(departamento=dept, correo=correo_defecto))
            
    # Asegurar que el logo existe en static/img/
    import shutil
    static_img_dir = os.path.join(app.root_path, 'static', 'img')
    os.makedirs(static_img_dir, exist_ok=True)
    dest_logo = os.path.join(static_img_dir, 'logo-michelle.png')
    src_logo = os.path.join(app.root_path, 'logo-michelle.png')
    if os.path.exists(src_logo) and not os.path.exists(dest_logo):
        shutil.copy(src_logo, dest_logo)

    db.session.commit()

# Función para enviar correo en segundo plano
def send_email_async(subject, recipient, body_html):
    def send():
        brevo_api_key = os.environ.get('BREVO_API_KEY')
        if brevo_api_key:
            try:
                import urllib.request
                import json
                
                url = "https://api.brevo.com/v3/smtp/email"
                headers = {
                    "api-key": brevo_api_key,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
                
                # Obtener el correo emisor verificado en Brevo (por defecto, tu correo registrado)
                sender_email = os.environ.get('MAIL_USERNAME', 'respaldosmichelle2022@gmail.com')
                if not sender_email or '@' not in sender_email:
                    sender_email = 'respaldosmichelle2022@gmail.com'
                
                payload = {
                    "sender": {
                        "name": "Sala de Juntas Michelle",
                        "email": sender_email
                    },
                    "to": [
                        {
                            "email": recipient
                        }
                    ],
                    "subject": subject,
                    "htmlContent": body_html
                }
                
                req = urllib.request.Request(
                    url, 
                    data=json.dumps(payload).encode('utf-8'), 
                    headers=headers, 
                    method='POST'
                )
                with urllib.request.urlopen(req, timeout=15) as response:
                    res_data = response.read().decode('utf-8')
                    print(f"Correo enviado via Brevo exitosamente a {recipient}. Respuesta: {res_data}", flush=True)
                return
            except Exception as e:
                # Si ocurre un HTTPError, intentar leer el cuerpo de la respuesta para saber el error exacto de Brevo
                error_body = ""
                if hasattr(e, 'read'):
                    try:
                        error_body = f" - Detalle: {e.read().decode('utf-8')}"
                    except Exception:
                        pass
                print(f"Error al enviar correo por Brevo: {e}{error_body}", flush=True)
                return

        # Fallback a SMTP
        if not app.config['MAIL_SERVER'] or not app.config['MAIL_USERNAME'] or not app.config['MAIL_PASSWORD']:
            print("SMTP no configurado en variables de entorno. Notificación impresa en consola:", flush=True)
            print(f"PARA: {recipient}\nASUNTO: {subject}\nCONTENIDO: {body_html}\n" + "-"*40, flush=True)
            return
        
        try:
            import socket
            import ssl
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = app.config['MAIL_DEFAULT_SENDER'] or app.config['MAIL_USERNAME']
            msg['To'] = recipient

            part = MIMEText(body_html, 'html')
            msg.attach(part)

            server_port = app.config['MAIL_PORT']
            mail_server = app.config['MAIL_SERVER']
            
            # Forzar resolución IPv4 para evitar problemas con redes IPv6-only/bloqueos en Render
            try:
                addr_info = socket.getaddrinfo(mail_server, server_port, socket.AF_INET, socket.SOCK_STREAM)
                if addr_info:
                    mail_server = addr_info[0][4][0]
                    print(f"Servidor SMTP resuelto a IPv4: {mail_server}", flush=True)
            except Exception as dns_err:
                print(f"Advertencia al resolver DNS de correo: {dns_err}", flush=True)

            if app.config['MAIL_USE_TLS']:
                server = smtplib.SMTP(mail_server, server_port, timeout=15)
                context = ssl.create_default_context()
                if mail_server[0].isdigit() or ':' in mail_server:
                    context.check_hostname = False
                server.starttls(context=context)
            else:
                context = ssl.create_default_context()
                if mail_server[0].isdigit() or ':' in mail_server:
                    context.check_hostname = False
                server = smtplib.SMTP_SSL(mail_server, server_port, context=context, timeout=15)
            
            server.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
            server.sendmail(msg['From'], recipient, msg.as_string())
            server.quit()
            print(f"Correo enviado exitosamente a {recipient}", flush=True)
        except Exception as e:
            print(f"Error al enviar correo: {e}", flush=True)

    threading.Thread(target=send).start()

# Helper para construir plantillas de correos
def get_email_template(title, message, details_html):
    return f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; background-color: #f9f9f9; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border-top: 5px solid #0056b3;">
                <h2 style="color: #0056b3; margin-top: 0;">{title}</h2>
                <p>{message}</p>
                <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    {details_html}
                </div>
                <p style="font-size: 12px; color: #777; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
                    Este es un mensaje automático del Sistema de Reservación de Sala de Juntas.
                </p>
            </div>
        </body>
    </html>
    """

# Rutas de Vistas
@app.route('/')
def index():
    return render_template('index.html', departamentos=DEPARTAMENTOS_PERMITIDOS)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        password = request.form.get('password')
        # Soporta contraseñas múltiples separadas por comas (ej. "Yamir8122,claveRH")
        admin_pass_env = os.environ.get('ADMIN_PASSWORD', 'admin123')
        allowed_passwords = [p.strip() for p in admin_pass_env.split(',') if p.strip()]
        
        if password in allowed_passwords:
            session['admin_logged_in'] = True
            return redirect(url_for('admin'))
        else:
            return render_template('login.html', error="Contraseña incorrecta")
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('admin_logged_in', None)
    return redirect(url_for('index'))

@app.route('/admin')
def admin():
    if not session.get('admin_logged_in'):
        return redirect(url_for('login'))
    return render_template('admin.html')

# Endpoints de la API
@app.route('/api/citas', methods=['GET'])
def get_citas():
    citas = Cita.query.filter(Cita.estatus != 'Rechazado').all()
    return jsonify([cita.to_dict() for cita in citas])

@app.route('/api/citas/pendientes', methods=['GET'])
def get_citas_pendientes():
    if not session.get('admin_logged_in'):
        return jsonify({'error': 'No autorizado'}), 401
    citas = Cita.query.filter_by(estatus='Preaprobatorio').order_by(Cita.fecha, Cita.hora_inicio).all()
    return jsonify([cita.to_dict() for cita in citas])

@app.route('/api/citas/historial', methods=['GET'])
def get_citas_historial():
    if not session.get('admin_logged_in'):
        return jsonify({'error': 'No autorizado'}), 401
    citas = Cita.query.order_by(Cita.fecha.desc(), Cita.hora_inicio.desc()).all()
    return jsonify([cita.to_dict() for cita in citas])

@app.route('/api/config/correos', methods=['GET'])
def get_config_correos():
    if not session.get('admin_logged_in'):
        return jsonify({'error': 'No autorizado'}), 401
    
    config_admin = Configuracion.query.get('admin_destinatarios')
    depts = CorreoDepartamento.query.all()
    
    return jsonify({
        'admin_destinatarios': config_admin.valor if config_admin else '',
        'departamentos': {d.departamento: d.correo for d in depts}
    })

@app.route('/api/config/correos', methods=['POST'])
def update_config_correos():
    if not session.get('admin_logged_in'):
        return jsonify({'error': 'No autorizado'}), 401
    
    data = request.json or {}
    admin_val = data.get('admin_destinatarios', '').strip()
    depts_data = data.get('departamentos', {})
    
    # Actualizar destinatarios admin
    config_admin = Configuracion.query.get('admin_destinatarios')
    if not config_admin:
        config_admin = Configuracion(clave='admin_destinatarios')
        db.session.add(config_admin)
    config_admin.valor = admin_val
    
    # Actualizar correos de cada departamento
    for dept_name, correo_val in depts_data.items():
         if dept_name in DEPARTAMENTOS_PERMITIDOS:
             correo_dept = CorreoDepartamento.query.get(dept_name)
             if not correo_dept:
                 correo_dept = CorreoDepartamento(departamento=dept_name)
                 db.session.add(correo_dept)
             correo_dept.correo = correo_val.strip()
             
    db.session.commit()
    return jsonify({'success': True, 'message': 'Configuración de correos guardada correctamente'})

@app.route('/api/citas', methods=['POST'])
def create_cita():
    data = request.json or {}
    departamento = data.get('departamento')
    fecha_str = data.get('fecha')
    hora_inicio_str = data.get('hora_inicio')
    hora_fin_str = data.get('hora_fin')
    motivo = data.get('motivo', '')
    
    # Obtener el correo del departamento predefinido en base de datos
    correo_dept_obj = CorreoDepartamento.query.get(departamento)
    correo_contacto = correo_dept_obj.correo if correo_dept_obj else ''

    # Validaciones básicas
    if not departamento or not fecha_str or not hora_inicio_str or not hora_fin_str:
        return jsonify({'error': 'Todos los campos son obligatorios'}), 400

    if departamento not in DEPARTAMENTOS_PERMITIDOS:
        return jsonify({'error': 'Departamento no válido'}), 400

    try:
        fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()
        # Convertir horas a objetos time
        hora_inicio = datetime.strptime(hora_inicio_str, '%H:%M').time()
        hora_fin = datetime.strptime(hora_fin_str, '%H:%M').time()
    except ValueError:
        return jsonify({'error': 'Formato de fecha u hora inválido'}), 400

    # 0. Validar que la fecha no sea pasada
    if fecha < datetime.now().date():
        return jsonify({'error': 'No se pueden realizar reservaciones en fechas pasadas.'}), 400

    # 1. Validar Día de la semana (Lunes a Viernes)
    # weekday() devuelve 0 para Lunes y 6 para Domingo
    if fecha.weekday() >= 5:
        return jsonify({'error': 'Las reservaciones solo se permiten de lunes a viernes.'}), 400

    # 2. Validar Rango de Horas (8:00 AM a 4:00 PM)
    limite_inicio = time(8, 0)
    limite_fin = time(16, 0)

    if hora_inicio < limite_inicio or hora_fin > limite_fin:
        return jsonify({'error': 'El horario permitido es de 08:00 AM a 04:00 PM.'}), 400

    if hora_inicio >= hora_fin:
        return jsonify({'error': 'La hora de inicio debe ser anterior a la de fin.'}), 400

    # 2.5 Validar que el horario sea en múltiplos de 30 minutos
    if hora_inicio.minute % 30 != 0 or hora_fin.minute % 30 != 0:
        return jsonify({'error': 'Los horarios deben ser en intervalos de 30 minutos (ej: 08:00, 08:30).'}), 400

    # 3. Validar traslape/colisiones de horario
    # Buscamos citas no rechazadas en el mismo día que se traslapen
    citas_conflicto = Cita.query.filter(
        Cita.fecha == fecha,
        Cita.estatus != 'Rechazado',
        Cita.hora_inicio < hora_fin,
        Cita.hora_fin > hora_inicio
    ).first()

    if citas_conflicto:
        return jsonify({
            'error': f'El horario solicitado entra en conflicto con una reservación de {citas_conflicto.departamento} ({citas_conflicto.hora_inicio.strftime("%H:%M")} - {citas_conflicto.hora_fin.strftime("%H:%M")})'
        }), 400

    # Crear la cita
    nueva_cita = Cita(
        departamento=departamento,
        fecha=fecha,
        hora_inicio=hora_inicio,
        hora_fin=hora_fin,
        motivo=motivo,
        correo_contacto=correo_contacto,
        estatus='Preaprobatorio'
    )

    db.session.add(nueva_cita)
    db.session.commit()

    # Enviar Notificaciones
    detalles = f"""
    <strong>Departamento:</strong> {departamento}<br>
    <strong>Fecha:</strong> {fecha.strftime('%d/%m/%Y')}<br>
    <strong>Horario:</strong> {hora_inicio_str} a {hora_fin_str}<br>
    <strong>Motivo/Asunto:</strong> {motivo or 'N/A'}
    """
    


    # 2. A los destinatarios administradores configurados
    config_admin = Configuracion.query.get('admin_destinatarios')
    admin_emails_str = config_admin.valor if config_admin else ''
    if admin_emails_str:
        destinatarios = [email.strip() for email in admin_emails_str.split(',') if email.strip()]
        for dest in destinatarios:
            subject = f"Nueva solicitud de reservación - {departamento}"
            message = f"El departamento de {departamento} ha solicitado la sala de juntas. Por favor ingresa al panel de administración para autorizar o rechazar."
            html_content = get_email_template("Nueva Solicitud Pendiente", message, detalles)
            send_email_async(subject, dest, html_content)

    return jsonify(nueva_cita.to_dict()), 201

@app.route('/api/citas/<int:cita_id>/autorizar', methods=['POST'])
def autorizar_cita(cita_id):
    if not session.get('admin_logged_in'):
        return jsonify({'error': 'No autorizado'}), 401

    cita = Cita.query.get_or_404(cita_id)
    if cita.estatus != 'Preaprobatorio':
        return jsonify({'error': 'Esta cita ya ha sido procesada anteriormente'}), 400

    cita.estatus = 'Autorizado'
    db.session.commit()

    # Enviar Notificación por correo al solicitante (usando el correo actual en tiempo real)
    correo_dept_obj = CorreoDepartamento.query.get(cita.departamento)
    correo_destinatario = correo_dept_obj.correo if correo_dept_obj else cita.correo_contacto

    if correo_destinatario:
        detalles = f"""
        <strong>Departamento:</strong> {cita.departamento}<br>
        <strong>Fecha:</strong> {cita.fecha.strftime('%d/%m/%Y')}<br>
        <strong>Horario:</strong> {cita.hora_inicio.strftime('%H:%M')} a {cita.hora_fin.strftime('%H:%M')}<br>
        <strong>Estatus:</strong> <span style="color: #28a745; font-weight: bold;">AUTORIZADO</span>
        """
        subject = "Reservación de Sala de Juntas AUTORIZADA"
        message = "¡Buenas noticias! Tu solicitud para reservar la Sala de Juntas ha sido <strong>Autorizada</strong> por el Administrador."
        html_content = get_email_template("Reservación Autorizada", message, detalles)
        send_email_async(subject, correo_destinatario, html_content)

    return jsonify(cita.to_dict())

@app.route('/api/citas/<int:cita_id>/rechazar', methods=['POST'])
def rechazar_cita(cita_id):
    if not session.get('admin_logged_in'):
        return jsonify({'error': 'No autorizado'}), 401

    cita = Cita.query.get_or_404(cita_id)
    if cita.estatus != 'Preaprobatorio':
        return jsonify({'error': 'Esta cita ya ha sido procesada anteriormente'}), 400

    cita.estatus = 'Rechazado'
    db.session.commit()

    # Enviar Notificación por correo al solicitante (usando el correo actual en tiempo real)
    correo_dept_obj = CorreoDepartamento.query.get(cita.departamento)
    correo_destinatario = correo_dept_obj.correo if correo_dept_obj else cita.correo_contacto

    if correo_destinatario:
        detalles = f"""
        <strong>Departamento:</strong> {cita.departamento}<br>
        <strong>Fecha:</strong> {cita.fecha.strftime('%d/%m/%Y')}<br>
        <strong>Horario:</strong> {cita.hora_inicio.strftime('%H:%M')} a {cita.hora_fin.strftime('%H:%M')}<br>
        <strong>Estatus:</strong> <span style="color: #dc3545; font-weight: bold;">RECHAZADO</span>
        """
        subject = "Reservación de Sala de Juntas Rechazada"
        message = "Lamentamos informarte que tu solicitud para reservar la Sala de Juntas ha sido <strong>Rechazada</strong> por el Administrador. El espacio vuelve a estar libre para otras reservaciones."
        html_content = get_email_template("Reservación Rechazada", message, detalles)
        send_email_async(subject, correo_destinatario, html_content)

    return jsonify(cita.to_dict())

@app.route('/api/citas/<int:cita_id>/eliminar', methods=['POST'])
def eliminar_cita(cita_id):
    if not session.get('admin_logged_in'):
        return jsonify({'error': 'No autorizado'}), 401

    cita = Cita.query.get_or_404(cita_id)
    db.session.delete(cita)
    db.session.commit()

    return jsonify({'success': True, 'message': 'Reservación eliminada correctamente'})

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=8080)
