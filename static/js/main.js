let currentWeekStart = getMonday(new Date());
let reservaciones = [];
let lastSelectedDate = '';

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar y controlar Tema Oscuro/Claro (por defecto Oscuro)
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
        themeBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
        themeBtn.addEventListener('click', () => {
            let theme = document.documentElement.getAttribute('data-theme');
            let newTheme = theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        });
    }

    // Forzar la precarga de voces de síntesis de voz
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
    }
    
    // Configurar fecha mínima como el día de hoy
    const today = new Date();
    const todayStr = formatFechaISO(today);
    document.getElementById('fecha').min = todayStr;
    
    // Configurar fecha por defecto (mañana si hoy ya cerró la sala)
    const defaultDate = obtenerSiguienteFechaDisponible();
    document.getElementById('fecha').value = formatFechaISO(defaultDate);

    inicializarCalendario();
    configurarEventos();
    cargarReservaciones();

    // Actualizar automáticamente cada 10 segundos en segundo plano
    setInterval(cargarReservaciones, 10000);
});

// Obtener el Lunes de la semana de una fecha dada
function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar cuando es Domingo
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function formatFechaISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatFechaVisual(date) {
    const options = { day: 'numeric', month: 'short' };
    return date.toLocaleDateString('es-MX', options);
}

function inicializarCalendario() {
    actualizarEtiquetaSemana();
    renderGrid();
}

function configurarEventos() {
    document.getElementById('btn-prev-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        inicializarCalendario();
        cargarReservaciones();
    });

    document.getElementById('btn-next-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        inicializarCalendario();
        cargarReservaciones();
    });

    document.getElementById('btn-today').addEventListener('click', () => {
        currentWeekStart = getMonday(new Date());
        inicializarCalendario();
        cargarReservaciones();
    });

    // Envío del formulario
    document.getElementById('form-reservar').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const departamento = document.getElementById('departamento').value;
        const fecha = document.getElementById('fecha').value;
        const hora_inicio = document.getElementById('hora_inicio').value;
        const hora_fin = document.getElementById('hora_fin').value;
        const motivo = document.getElementById('motivo').value;

        const payload = {
            departamento,
            fecha,
            hora_inicio,
            hora_fin,
            motivo
        };

        try {
            const response = await fetch('/api/citas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                showToast(data.error || 'Error al solicitar reservación', 'error');
            } else {
                showToast('Solicitud enviada con estatus Preaprobatorio. Espera autorización por correo.', 'success');
                const fechaVoz = formatFechaParaVoz(fecha);
                speakText(`Ha solicitado una reserva para el día ${fechaVoz} a las ${hora_inicio}`);
                document.getElementById('form-reservar').reset();
                await cargarReservaciones();
            }
        } catch (err) {
            showToast('Error de conexión con el servidor.', 'error');
            console.error(err);
        }
    });

    // Cerrar modal de detalles
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('booking-modal').classList.add('hidden');
    });

    // Cerrar modal de nueva reservación (Doble Clic)
    document.getElementById('close-new-booking-modal').addEventListener('click', () => {
        document.getElementById('new-booking-modal').classList.add('hidden');
    });

    // Envío del formulario del Modal
    document.getElementById('form-modal-reservar').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const departamento = document.getElementById('modal-departamento').value;
        const fecha = document.getElementById('modal-fecha').value;
        const hora_inicio = document.getElementById('modal-hora-inicio').value;
        const hora_fin = document.getElementById('modal-hora-fin').value;
        const motivo = document.getElementById('modal-motivo').value;

        const payload = {
            departamento,
            fecha,
            hora_inicio,
            hora_fin,
            motivo
        };

        try {
            const response = await fetch('/api/citas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                showToast(data.error || 'Error al solicitar reservación', 'error');
            } else {
                showToast('Solicitud enviada con estatus Preaprobatorio. Espera autorización por correo.', 'success');
                const fechaVoz = formatFechaParaVoz(fecha);
                speakText(`Ha solicitado una reserva para el día ${fechaVoz} a las ${hora_inicio}`);
                document.getElementById('form-modal-reservar').reset();
                document.getElementById('new-booking-modal').classList.add('hidden');
                await cargarReservaciones();
            }
        } catch (err) {
            showToast('Error de conexión con el servidor.', 'error');
            console.error(err);
        }
    });

    // Cambios dinámicos en el formulario lateral
    document.getElementById('fecha').addEventListener('change', () => {
        actualizarHorasDisponibles();
    });
    document.getElementById('departamento').addEventListener('change', () => {
        actualizarHorasDisponibles();
    });
    document.getElementById('hora_inicio').addEventListener('change', () => {
        actualizarHorasDisponibles();
    });
    document.getElementById('hora_fin').addEventListener('change', actualizarTextoDuracion);

    // Cambios dinámicos en el formulario del modal
    document.getElementById('modal-departamento').addEventListener('change', actualizarHorasDisponiblesModal);
    document.getElementById('modal-hora-inicio').addEventListener('change', actualizarHorasDisponiblesModal);
    document.getElementById('modal-hora-fin').addEventListener('change', actualizarTextoDuracionModal);
}

function actualizarEtiquetaSemana() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 4); // Viernes
    
    const options = { month: 'long', year: 'numeric' };
    const mesAnio = currentWeekStart.toLocaleDateString('es-MX', options);
    
    document.getElementById('current-week-label').textContent = 
        `Semana: ${currentWeekStart.getDate()} al ${weekEnd.getDate()} de ${mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1)}`;
}

const HORA_INICIO_DIA = 8; // 8:00 AM
const HORA_FIN_DIA = 16;  // 4:00 PM

function renderGrid() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // 1. Crear cabecera vacía de esquina para las horas
    const corner = document.createElement('div');
    corner.className = 'grid-header grid-corner';
    corner.textContent = 'Hora / Día';
    grid.appendChild(corner);

    // 2. Crear cabeceras de Lunes a Viernes
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const fechasDias = [];

    for (let i = 0; i < 5; i++) {
        const diaFecha = new Date(currentWeekStart);
        diaFecha.setDate(currentWeekStart.getDate() + i);
        fechasDias.push(diaFecha);

        const header = document.createElement('div');
        header.className = 'grid-header';
        
        // Resaltar si es hoy
        const hoy = new Date();
        const esHoy = hoy.getDate() === diaFecha.getDate() && 
                      hoy.getMonth() === diaFecha.getMonth() && 
                      hoy.getFullYear() === diaFecha.getFullYear();

        if (esHoy) {
            header.classList.add('today-header');
        }

        header.innerHTML = `
            <div class="day-name">${diasSemana[i]}</div>
            <div class="day-date">${formatFechaVisual(diaFecha)}</div>
        `;
        grid.appendChild(header);
    }

    // 3. Crear filas de horas
    for (let hour = HORA_INICIO_DIA; hour < HORA_FIN_DIA; hour++) {
        // Celda de etiqueta de hora
        const labelCell = document.createElement('div');
        labelCell.className = 'grid-time-label';
        const startStr = `${hour.toString().padStart(2, '0')}:00`;
        const endStr = `${(hour + 1).toString().padStart(2, '0')}:00`;
        labelCell.textContent = `${startStr} - ${endStr}`;
        grid.appendChild(labelCell);

        // Celdas para cada día Lunes-Viernes para esta hora
        for (let d = 0; d < 5; d++) {
            const cellDate = fechasDias[d];
            const dateStr = formatFechaISO(cellDate);
            
            const cell = document.createElement('div');
            cell.className = 'grid-cell cell-available';
            cell.dataset.date = dateStr;
            cell.dataset.hourStart = `${hour.toString().padStart(2, '0')}:00`;
            cell.dataset.hourEnd = `${(hour + 1).toString().padStart(2, '0')}:00`;
            
            cell.innerHTML = '<span class="cell-action">+ Reservar</span>';

            cell.addEventListener('click', () => {
                if (cell.classList.contains('cell-available')) {
                    seleccionarHorario(dateStr, cell.dataset.hourStart, cell.dataset.hourEnd);
                } else if (cell.classList.contains('cell-occupied')) {
                    mostrarDetallesCita(cell.dataset.citaId);
                } else if (cell.classList.contains('cell-past')) {
                    showToast('No se pueden realizar reservaciones en fechas o horarios pasados.', 'error');
                }
            });

            cell.addEventListener('dblclick', () => {
                if (cell.classList.contains('cell-available')) {
                    abrirModalCrearCita(dateStr, cell.dataset.hourStart, cell.dataset.hourEnd);
                }
            });

            grid.appendChild(cell);
        }
    }
}

function seleccionarHorario(fecha, horaInicio, horaFin) {
    document.getElementById('fecha').value = fecha;
    
    // Primero actualizar las horas disponibles basadas en la fecha
    actualizarHorasDisponibles();
    
    // Luego setear los valores preseleccionados
    document.getElementById('hora_inicio').value = horaInicio;
    actualizarHorasDisponibles(); // Filtra la hora fin según la nueva hora inicio
    document.getElementById('hora_fin').value = horaFin;
    
    // Enfocar el departamento
    document.getElementById('departamento').focus();
    
    showToast(`Horario seleccionado: ${horaInicio} - ${horaFin} el ${fecha}`, 'info');
}

async function cargarReservaciones() {
    try {
        const response = await fetch('/api/citas');
        if (!response.ok) throw new Error('Error de red');
        reservaciones = await response.json();
        marcarCeldas();
        actualizarHorasDisponibles();
    } catch (err) {
        showToast('Error al actualizar las reservaciones del calendario.', 'error');
        console.error(err);
    }
}

function parseTimeToDecimal(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
}

function marcarCeldas() {
    const celdas = document.querySelectorAll('.grid-cell');
    const today = new Date();
    const currentHourDecimal = today.getHours() + today.getMinutes() / 60;
    
    const todayDateOnly = new Date(today);
    todayDateOnly.setHours(0, 0, 0, 0);
    
    celdas.forEach(cell => {
        const cellDateStr = cell.dataset.date;
        const parts = cellDateStr.split('-').map(Number);
        const cellDate = new Date(parts[0], parts[1] - 1, parts[2]);
        cellDate.setHours(0, 0, 0, 0);

        const cellStart = parseTimeToDecimal(cell.dataset.hourStart);
        const cellEnd = parseTimeToDecimal(cell.dataset.hourEnd);

        const isPastDay = cellDate < todayDateOnly;
        const isToday = cellDate.getTime() === todayDateOnly.getTime();
        const isPastHour = isToday && cellStart < currentHourDecimal;

        // Establecer estado base inicial
        if (isPastDay || isPastHour) {
            cell.className = 'grid-cell cell-past';
            cell.innerHTML = '<span class="cell-past-text">No disponible</span>';
        } else {
            cell.className = 'grid-cell cell-available';
            cell.innerHTML = '<span class="cell-action">+ Reservar</span>';
        }
        delete cell.dataset.citaId;

        // Buscar reservaciones que coincidan con la fecha y se traslapen con esta hora
        const citasDelDia = reservaciones.filter(r => r.fecha === cellDateStr);
        
        citasDelDia.forEach(cita => {
            const citaStart = parseTimeToDecimal(cita.hora_inicio);
            const citaEnd = parseTimeToDecimal(cita.hora_fin);

            // Condición de traslape
            if (citaStart < cellEnd && citaEnd > cellStart) {
                cell.className = `grid-cell cell-occupied status-${cita.estatus.toLowerCase()}`;
                cell.dataset.citaId = cita.id;
                
                let badgeText = cita.estatus === 'Preaprobatorio' ? 'PENDIENTE' : 'OCUPADO';
                
                cell.innerHTML = `
                    <div class="occupied-info">
                        <span class="occupied-dept">${cita.departamento}</span>
                        <span class="occupied-badge">${badgeText}</span>
                    </div>
                `;
            }
        });
    });
}

function mostrarDetallesCita(citaId) {
    const cita = reservaciones.find(r => r.id == citaId);
    if (!cita) return;

    const modal = document.getElementById('booking-modal');
    const details = document.getElementById('modal-details');

    const [year, month, day] = cita.fecha.split('-');
    const fechaFormateada = `${day}/${month}/${year}`;

    let statusBadgeClass = 'status-pending';
    if (cita.estatus === 'Autorizado') statusBadgeClass = 'status-approved';

    details.innerHTML = `
        <div class="modal-detail-item">
            <span class="detail-label">Departamento</span>
            <span class="detail-value font-bold">${cita.departamento}</span>
        </div>
        <div class="modal-detail-item">
            <span class="detail-label">Fecha</span>
            <span class="detail-value">${fechaFormateada}</span>
        </div>
        <div class="modal-detail-item">
            <span class="detail-label">Horario</span>
            <span class="detail-value">${cita.hora_inicio} a ${cita.hora_fin} hrs</span>
        </div>
        <div class="modal-detail-item">
            <span class="detail-label">Motivo / Asunto</span>
            <span class="detail-value">${cita.motivo || '<span class="italic text-muted">No especificado</span>'}</span>
        </div>
        <div class="modal-detail-item">
            <span class="detail-label">Estatus</span>
            <span class="detail-value"><span class="status-badge ${statusBadgeClass}">${cita.estatus}</span></span>
        </div>
    `;

    modal.classList.remove('hidden');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show toast-${type}`;
    setTimeout(() => {
        toast.className = 'toast hidden';
    }, 4500);
}

function actualizarHorasDisponibles() {
    const fechaInput = document.getElementById('fecha');
    const horaInicioSelect = document.getElementById('hora_inicio');
    const horaFinSelect = document.getElementById('hora_fin');
    
    const fechaVal = fechaInput.value;
    if (!fechaVal) return;
    
    const dateChanged = fechaVal !== lastSelectedDate;
    lastSelectedDate = fechaVal;
    
    const today = new Date();
    const todayStr = formatFechaISO(today);
    const isToday = fechaVal === todayStr;
    const currentHourDecimal = today.getHours() + today.getMinutes() / 60;
    
    // Filtrar reservaciones del día seleccionado (excluyendo rechazadas)
    const citasDelDia = reservaciones.filter(r => r.fecha === fechaVal);
    
    const deptoVal = document.getElementById('departamento').value;
    const horasRestantes = calcularHorasRestantesDepartamento(deptoVal, fechaVal);

    // 1. Filtrar las opciones de HORA INICIO
    let primerInicioValido = null;
    Array.from(horaInicioSelect.options).forEach(option => {
        if (option.classList.contains('placeholder-empty')) return;
        
        const optValDecimal = parseTimeToDecimal(option.value);
        let valido = true;
        
        if (horasRestantes <= 0) {
            valido = false;
        }
        
        // Si es hoy, no permitir horas pasadas
        if (valido && isToday && optValDecimal < currentHourDecimal) {
            valido = false;
        }
        
        // No traslaparse con reservaciones existentes (inicio no puede estar dentro de un rango ocupado)
        if (valido) {
            citasDelDia.forEach(cita => {
                const citaStart = parseTimeToDecimal(cita.hora_inicio);
                const citaEnd = parseTimeToDecimal(cita.hora_fin);
                if (optValDecimal >= citaStart && optValDecimal < citaEnd) {
                    valido = false;
                }
            });
        }
        
        if (valido) {
            option.style.display = '';
            option.disabled = false;
            if (!primerInicioValido) primerInicioValido = option.value;
        } else {
            option.style.display = 'none';
            option.disabled = true;
        }
    });

    // Controlar visibilidad de opción de marcador si no hay horas libres
    const emptyStartPlaceholder = horaInicioSelect.querySelector('.placeholder-empty');
    if (emptyStartPlaceholder) {
        if (!primerInicioValido) {
            emptyStartPlaceholder.style.display = '';
            emptyStartPlaceholder.disabled = false;
        } else {
            emptyStartPlaceholder.style.display = 'none';
            emptyStartPlaceholder.disabled = true;
        }
    }
    
    // Si la hora de inicio seleccionada ya no es válida, o acabamos de cambiar la fecha, cambiar al primer inicio disponible
    const currentInicioOption = horaInicioSelect.options[horaInicioSelect.selectedIndex];
    if (dateChanged || !currentInicioOption || currentInicioOption.disabled) {
        if (primerInicioValido) {
            horaInicioSelect.value = primerInicioValido;
        } else {
            horaInicioSelect.value = '';
        }
    }
    
    // 2. Filtrar las opciones de HORA FIN según la hora de inicio seleccionada y el límite del departamento
    const selectedInicioVal = horaInicioSelect.value;
    if (!selectedInicioVal) {
        // Si no hay hora de inicio válida, deshabilitar hora fin
        Array.from(horaFinSelect.options).forEach(option => {
            option.style.display = 'none';
            option.disabled = true;
        });
        horaFinSelect.value = '';
        actualizarTextoDuracion();
        return;
    }
    
    const inicioDecimal = parseTimeToDecimal(selectedInicioVal);
    
    // Encontrar el inicio de la siguiente cita que empiece después de nuestra hora de inicio
    let limiteSiguienteCita = 16.0; // El límite del día es 16:00
    citasDelDia.forEach(cita => {
        const citaStart = parseTimeToDecimal(cita.hora_inicio);
        if (citaStart > inicioDecimal && citaStart < limiteSiguienteCita) {
            limiteSiguienteCita = citaStart;
        }
    });

    // Limitar por el tiempo restante permitido para el departamento hoy (máximo 3 horas diarias)
    limiteSiguienteCita = Math.min(limiteSiguienteCita, inicioDecimal + horasRestantes);
    
    let primerFinValido = null;
    Array.from(horaFinSelect.options).forEach(option => {
        if (option.classList.contains('placeholder-empty')) return;
        
        const optValDecimal = parseTimeToDecimal(option.value);
        
        // Hora fin debe ser mayor a la de inicio Y no puede exceder el inicio de la siguiente cita ocupada ni el límite del dpto
        const valido = optValDecimal > inicioDecimal && optValDecimal <= limiteSiguienteCita;
        
        if (valido) {
            option.style.display = '';
            option.disabled = false;
            if (!primerFinValido) primerFinValido = option.value;
        } else {
            option.style.display = 'none';
            option.disabled = true;
        }
    });

    // Controlar visibilidad de opción de marcador si no hay horas libres de salida
    const emptyFinPlaceholder = horaFinSelect.querySelector('.placeholder-empty');
    if (emptyFinPlaceholder) {
        if (!primerFinValido) {
            emptyFinPlaceholder.style.display = '';
            emptyFinPlaceholder.disabled = false;
        } else {
            emptyFinPlaceholder.style.display = 'none';
            emptyFinPlaceholder.disabled = true;
        }
    }
    
    // Si la hora fin seleccionada ya no es válida, cambiarla a la primera fin disponible
    const currentFinOption = horaFinSelect.options[horaFinSelect.selectedIndex];
    if (!currentFinOption || currentFinOption.disabled) {
        if (primerFinValido) {
            horaFinSelect.value = primerFinValido;
        } else {
            horaFinSelect.value = '';
        }
    }

    actualizarTextoDuracion();
}

function abrirModalCrearCita(fecha, horaInicio, horaFin) {
    document.getElementById('modal-fecha').value = fecha;
    document.getElementById('modal-departamento').value = '';
    
    // Formatear fecha para el texto visual (DD/MM/YYYY)
    const [year, month, day] = fecha.split('-');
    document.getElementById('modal-fecha-texto').textContent = `${day}/${month}/${year}`;
    
    // Pre-poblar y filtrar selectores del modal
    document.getElementById('modal-hora-inicio').value = horaInicio;
    actualizarHorasDisponiblesModal();
    
    document.getElementById('modal-hora-fin').value = horaFin;
    actualizarHorasDisponiblesModal();
    
    // Abrir modal
    document.getElementById('new-booking-modal').classList.remove('hidden');
    document.getElementById('modal-departamento').focus();
}

function calcularHorasRestantesDepartamento(departamento, fecha) {
    if (!departamento || !fecha) return 3.0;
    const citasDelDia = reservaciones.filter(r => r.fecha === fecha && r.departamento === departamento && r.estatus !== 'Rechazado');
    let horasReservadas = 0.0;
    citasDelDia.forEach(cita => {
        const start = parseTimeToDecimal(cita.hora_inicio);
        const end = parseTimeToDecimal(cita.hora_fin);
        horasReservadas += (end - start);
    });
    return Math.max(0, 3.0 - horasReservadas);
}

function actualizarTextoDuracion() {
    const horaInicioSelect = document.getElementById('hora_inicio');
    const horaFinSelect = document.getElementById('hora_fin');
    const duracionDiv = document.getElementById('duracion-seleccionada');
    const deptoSelect = document.getElementById('departamento');
    const fechaInput = document.getElementById('fecha');

    const inicioVal = horaInicioSelect.value;
    const finVal = horaFinSelect.value;
    const deptoVal = deptoSelect.value;
    const fechaVal = fechaInput.value;

    if (!inicioVal || !finVal) {
        duracionDiv.style.display = 'none';
        return;
    }

    const inicio = parseTimeToDecimal(inicioVal);
    const fin = parseTimeToDecimal(finVal);
    const duracion = fin - inicio;

    if (duracion <= 0) {
        duracionDiv.style.display = 'none';
        return;
    }

    let texto = `Duración seleccionada: ${duracion} ${duracion === 1 ? 'hora' : 'horas'}`;
    if (deptoVal && fechaVal) {
        const restantes = calcularHorasRestantesDepartamento(deptoVal, fechaVal);
        const disponiblesDespues = Math.max(0, restantes - duracion);
        texto += ` | Límite restante hoy: ${disponiblesDespues} ${disponiblesDespues === 1 ? 'hora' : 'horas'}`;
    }

    duracionDiv.innerHTML = `<span>${texto}</span>`;
    duracionDiv.style.display = 'flex';
}

function actualizarTextoDuracionModal() {
    const horaInicioSelect = document.getElementById('modal-hora-inicio');
    const horaFinSelect = document.getElementById('modal-hora-fin');
    const duracionDiv = document.getElementById('modal-duracion-seleccionada');
    const deptoSelect = document.getElementById('modal-departamento');
    const fechaVal = document.getElementById('modal-fecha').value;

    const inicioVal = horaInicioSelect.value;
    const finVal = horaFinSelect.value;
    const deptoVal = deptoSelect.value;

    if (!inicioVal || !finVal) {
        duracionDiv.style.display = 'none';
        return;
    }

    const inicio = parseTimeToDecimal(inicioVal);
    const fin = parseTimeToDecimal(finVal);
    const duracion = fin - inicio;

    if (duracion <= 0) {
        duracionDiv.style.display = 'none';
        return;
    }

    let texto = `Duración seleccionada: ${duracion} ${duracion === 1 ? 'hora' : 'horas'}`;
    if (deptoVal && fechaVal) {
        const restantes = calcularHorasRestantesDepartamento(deptoVal, fechaVal);
        const disponiblesDespues = Math.max(0, restantes - duracion);
        texto += ` | Límite restante hoy: ${disponiblesDespues} ${disponiblesDespues === 1 ? 'hora' : 'horas'}`;
    }

    duracionDiv.innerHTML = `<span>${texto}</span>`;
    duracionDiv.style.display = 'flex';
}

function actualizarHorasDisponiblesModal() {
    const fechaVal = document.getElementById('modal-fecha').value;
    const deptoSelect = document.getElementById('modal-departamento');
    const horaInicioSelect = document.getElementById('modal-hora-inicio');
    const horaFinSelect = document.getElementById('modal-hora-fin');
    
    if (!fechaVal) return;
    
    const deptoVal = deptoSelect.value;
    const today = new Date();
    const todayStr = formatFechaISO(today);
    const isToday = fechaVal === todayStr;
    const currentHourDecimal = today.getHours() + today.getMinutes() / 60;
    
    const citasDelDia = reservaciones.filter(r => r.fecha === fechaVal);
    
    const horasRestantes = calcularHorasRestantesDepartamento(deptoVal, fechaVal);
    
    // 1. Filtrar las opciones de HORA INICIO
    let primerInicioValido = null;
    Array.from(horaInicioSelect.options).forEach(option => {
        if (option.classList.contains('placeholder-empty')) return;
        
        const optValDecimal = parseTimeToDecimal(option.value);
        let valido = true;
        
        if (horasRestantes <= 0) {
            valido = false;
        }
        
        // Si es hoy, no permitir horas pasadas
        if (valido && isToday && optValDecimal < currentHourDecimal) {
            valido = false;
        }
        
        // No traslaparse con reservaciones existentes
        if (valido) {
            citasDelDia.forEach(cita => {
                const citaStart = parseTimeToDecimal(cita.hora_inicio);
                const citaEnd = parseTimeToDecimal(cita.hora_fin);
                if (optValDecimal >= citaStart && optValDecimal < citaEnd) {
                    valido = false;
                }
            });
        }
        
        if (valido) {
            option.style.display = '';
            option.disabled = false;
            if (!primerInicioValido) primerInicioValido = option.value;
        } else {
            option.style.display = 'none';
            option.disabled = true;
        }
    });

    const emptyStartPlaceholder = horaInicioSelect.querySelector('.placeholder-empty');
    if (emptyStartPlaceholder) {
        if (!primerInicioValido) {
            emptyStartPlaceholder.style.display = '';
            emptyStartPlaceholder.disabled = false;
        } else {
            emptyStartPlaceholder.style.display = 'none';
            emptyStartPlaceholder.disabled = true;
        }
    }
    
    // Si la hora de inicio actual no es válida, cambiarla
    const currentInicioOption = horaInicioSelect.options[horaInicioSelect.selectedIndex];
    if (!currentInicioOption || currentInicioOption.disabled) {
        if (primerInicioValido) {
            horaInicioSelect.value = primerInicioValido;
        } else {
            horaInicioSelect.value = '';
        }
    }
    
    // 2. Filtrar las opciones de HORA FIN según la hora de inicio seleccionada y el límite del departamento
    const selectedInicioVal = horaInicioSelect.value;
    if (!selectedInicioVal) {
        Array.from(horaFinSelect.options).forEach(option => {
            option.style.display = 'none';
            option.disabled = true;
        });
        horaFinSelect.value = '';
        actualizarTextoDuracionModal();
        return;
    }
    
    const inicioDecimal = parseTimeToDecimal(selectedInicioVal);
    
    // Encontrar el inicio de la siguiente cita
    let limiteSiguienteCita = 16.0;
    citasDelDia.forEach(cita => {
        const citaStart = parseTimeToDecimal(cita.hora_inicio);
        if (citaStart > inicioDecimal && citaStart < limiteSiguienteCita) {
            limiteSiguienteCita = citaStart;
        }
    });
    
    // Aplicar límite diario del departamento
    limiteSiguienteCita = Math.min(limiteSiguienteCita, inicioDecimal + horasRestantes);
    
    let primerFinValido = null;
    Array.from(horaFinSelect.options).forEach(option => {
        if (option.classList.contains('placeholder-empty')) return;
        
        const optValDecimal = parseTimeToDecimal(option.value);
        const valido = optValDecimal > inicioDecimal && optValDecimal <= limiteSiguienteCita;
        
        if (valido) {
            option.style.display = '';
            option.disabled = false;
            if (!primerFinValido) primerFinValido = option.value;
        } else {
            option.style.display = 'none';
            option.disabled = true;
        }
    });

    const emptyFinPlaceholder = horaFinSelect.querySelector('.placeholder-empty');
    if (emptyFinPlaceholder) {
        if (!primerFinValido) {
            emptyFinPlaceholder.style.display = '';
            emptyFinPlaceholder.disabled = false;
        } else {
            emptyFinPlaceholder.style.display = 'none';
            emptyFinPlaceholder.disabled = true;
        }
    }
    
    const currentFinOption = horaFinSelect.options[horaFinSelect.selectedIndex];
    if (!currentFinOption || currentFinOption.disabled) {
        if (primerFinValido) {
            horaFinSelect.value = primerFinValido;
        } else {
            horaFinSelect.value = '';
        }
    }
    
    actualizarTextoDuracionModal();
}

// Obtener la siguiente fecha laboral disponible para reservar (salta fin de semana y horas pasadas de hoy)
function obtenerSiguienteFechaDisponible() {
    const d = new Date();
    const currentHourDecimal = d.getHours() + d.getMinutes() / 60;
    
    // Si ya pasó de las 3:30 PM (15.5) o es sábado/domingo, avanzar al siguiente día laborable
    if (currentHourDecimal >= 15.5 || d.getDay() === 0 || d.getDay() === 6) {
        do {
            d.setDate(d.getDate() + 1);
        } while (d.getDay() === 0 || d.getDay() === 6);
    }
    return d;
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-MX';
        
        const voices = window.speechSynthesis.getVoices();
        const spanishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('es'));
        
        if (spanishVoices.length > 0) {
            // Ordenar: Online (Natural/Neural/Cloud) > Google > Microsoft > Otras locales
            spanishVoices.sort((a, b) => {
                const nameA = a.name.toLowerCase();
                const nameB = b.name.toLowerCase();
                
                const isOnlineA = nameA.includes('online') || nameA.includes('natural') || nameA.includes('neural') || nameA.includes('multilingual');
                const isOnlineB = nameB.includes('online') || nameB.includes('natural') || nameB.includes('neural') || nameB.includes('multilingual');
                if (isOnlineA && !isOnlineB) return -1;
                if (!isOnlineA && isOnlineB) return 1;
                
                const isGoogleA = nameA.includes('google');
                const isGoogleB = nameB.includes('google');
                if (isGoogleA && !isGoogleB) return -1;
                if (!isGoogleA && isGoogleB) return 1;
                
                const isMicrosoftA = nameA.includes('microsoft');
                const isMicrosoftB = nameB.includes('microsoft');
                if (isMicrosoftA && !isMicrosoftB) return -1;
                if (!isMicrosoftA && isMicrosoftB) return 1;
                
                return 0;
            });
            
            utterance.voice = spanishVoices[0];
            utterance.pitch = 1.0; 
            utterance.rate = 0.95; // Un poco más lento para mejorar la naturalidad
        }
        window.speechSynthesis.speak(utterance);
    }
}

function formatFechaParaVoz(fechaStr) {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-');
    const meses = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const mesIndex = parseInt(month, 10) - 1;
    return `${parseInt(day, 10)} de ${meses[mesIndex] || ''}`;
}
