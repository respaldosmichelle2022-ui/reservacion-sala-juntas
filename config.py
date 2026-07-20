import os
from dotenv import load_dotenv

# Cargar variables de entorno desde un archivo .env si existe
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev_key_sala_juntas_12356')
    
    # Manejar la URL de la base de datos de Render (PostgreSQL suele venir como postgres:// y SQLAlchemy requiere postgresql://)
    database_url = os.environ.get('DATABASE_URL', 'sqlite:///sala_juntas.db')
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_DATABASE_URI = database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Configuración de Correo (SMTP)
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'True') == 'True'
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', '')  # Tu correo
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')  # Contraseña de aplicación
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', '')  # Remitente por defecto
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '') # Correo del administrador que autoriza
