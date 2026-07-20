# Sistema de Reservación de Sala de Juntas

Este es un sistema web moderno, responsivo y visualmente atractivo diseñado para la reservación y control de horarios de la sala de juntas corporativa.

## Características

- **Calendario Semanal Interactivo (Lunes a Viernes de 8:00 AM a 4:00 PM)**.
- **Asignación rápida**: Haz clic en cualquier celda libre para pre-seleccionar la fecha y hora.
- **Estatus Preaprobatorio automático**: Todas las nuevas reservaciones se guardan como pendientes hasta la autorización de un administrador.
- **Panel del Administrador**: Interfaz protegida por contraseña para autorizar o rechazar solicitudes.
- **Notificaciones por correo (SMTP)**: Envío automático de confirmaciones del estatus del apartado al solicitante y avisos al administrador.
- **Validación de colisiones**: Evita el traslape de reservaciones de forma inteligente.

## Stack Tecnológico

- **Backend**: Python (Flask) + Flask-SQLAlchemy (base de datos relacional).
- **Frontend**: HTML5, CSS3 (Vanilla Premium con variables y animaciones) y JavaScript Vanilla (interacción del calendario dinámico sin frameworks pesados).

---

## Ejecución Local

1. **Instalar dependencias**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configurar Variables de Entorno (Opcional, crear archivo `.env`):**
   ```ini
   SECRET_KEY=clave_secreta_aqui
   ADMIN_PASSWORD=admin123
   
   # Configuración de Correo SMTP (Ejemplo Gmail)
   MAIL_SERVER=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USE_TLS=True
   MAIL_USERNAME=tu_correo@gmail.com
   MAIL_PASSWORD=tu_contrasena_de_aplicacion
   MAIL_DEFAULT_SENDER=tu_correo@gmail.com
   ADMIN_EMAIL=admin_sala_juntas@empresa.com
   ```

3. **Iniciar el servidor:**
   ```bash
   python app.py
   ```
   Accede a [http://127.0.0.1:5000](http://127.0.0.1:5000) en tu navegador.

---

## Despliegue en GitHub y Render

### 1. Guardar y Subir a GitHub
1. Inicializa un repositorio de Git local en la carpeta raíz:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Sistema de Reservación de Sala de Juntas"
   ```
2. Crea un repositorio vacío en tu cuenta de GitHub.
3. Vincula y sube el código:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git branch -M main
   git push -u origin main
   ```

### 2. Desplegar en Render
1. Inicia sesión en [Render](https://render.com/).
2. Haz clic en **New +** y selecciona **Web Service**.
3. Conecta tu repositorio de GitHub recién creado.
4. Define la siguiente configuración:
   - **Name**: `reservacion-sala-juntas-rh`
   - **Runtime**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app` (Render utiliza Gunicorn por defecto para producción con Python).
5. (Opcional) En la pestaña **Environment**, agrega las variables que definiste en el `.env`, por ejemplo `ADMIN_PASSWORD` o la configuración SMTP para que se puedan mandar los avisos por correo reales.
6. ¡Haz clic en **Create Web Service** y listo!
