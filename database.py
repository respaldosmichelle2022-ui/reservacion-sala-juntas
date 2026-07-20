from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Cita(db.Model):
    __tablename__ = 'citas'

    id = db.Column(db.Integer, primary_key=True)
    departamento = db.Column(db.String(100), nullable=False)
    fecha = db.Column(db.Date, nullable=False)
    hora_inicio = db.Column(db.Time, nullable=False)
    hora_fin = db.Column(db.Time, nullable=False)
    motivo = db.Column(db.String(255), nullable=True)
    estatus = db.Column(db.String(50), nullable=False, default='Preaprobatorio')  # Preaprobatorio, Autorizado, Rechazado
    correo_contacto = db.Column(db.String(120), nullable=True)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'departamento': self.departamento,
            'fecha': self.fecha.strftime('%Y-%m-%d'),
            'hora_inicio': self.hora_inicio.strftime('%H:%M'),
            'hora_fin': self.hora_fin.strftime('%H:%M'),
            'motivo': self.motivo,
            'estatus': self.estatus,
            'correo_contacto': self.correo_contacto,
            'creado_en': self.creado_en.strftime('%Y-%m-%d %H:%M:%S')
        }

class CorreoDepartamento(db.Model):
    __tablename__ = 'correos_departamentos'
    departamento = db.Column(db.String(100), primary_key=True)
    correo = db.Column(db.String(120), nullable=False)

    def to_dict(self):
        return {
            'departamento': self.departamento,
            'correo': self.correo
        }

class Configuracion(db.Model):
    __tablename__ = 'configuracion'
    clave = db.Column(db.String(50), primary_key=True)
    valor = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            'clave': self.clave,
            'valor': self.valor
        }
