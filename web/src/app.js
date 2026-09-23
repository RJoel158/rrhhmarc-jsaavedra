// URL base de la API REST
// Al servirse a través de Nginx, /api se redirige internamente al contenedor api:3000
const API_BASE_URL = '/api';

// Elementos DOM
const tableBody = document.getElementById('marcacionesTableBody');
const tableCountInfo = document.getElementById('tableCountInfo');
const filterForm = document.getElementById('filterForm');
const filterEmpleado = document.getElementById('filterEmpleado');
const filterFecha = document.getElementById('filterFecha');
const btnClearFilters = document.getElementById('btnClearFilters');

// Métricas DOM
const statTotal = document.getElementById('statTotal');
const statPuntual = document.getElementById('statPuntual');
const statAtraso = document.getElementById('statAtraso');
const statIncompleto = document.getElementById('statIncompleto');
const serverStatusBadge = document.getElementById('serverStatusBadge');

// Modal DOM
const modal = document.getElementById('marcacionModal');
const modalTitle = document.getElementById('modalTitle');
const modalForm = document.getElementById('marcacionForm');
const btnOpenModal = document.getElementById('btnOpenModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');

// Form Inputs
const inputId = document.getElementById('marcacionId');
const inputCodigo = document.getElementById('codigo_empleado');
const inputNombre = document.getElementById('nombre_empleado');
const inputFecha = document.getElementById('fecha');
const inputHoraProgIngreso = document.getElementById('hora_ingreso_programada');
const inputHoraRealIngreso = document.getElementById('hora_ingreso_real');
const inputHoraProgSalida = document.getElementById('hora_salida_programada');
const inputHoraRealSalida = document.getElementById('hora_salida_real');
const inputObservacion = document.getElementById('observacion');

// Cache local de marcaciones
let marcacionesCache = [];

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    checkServerHealth();
    loadMarcaciones();
    setupEventListeners();
    setDefaultDate();
});

// Comprobar estado de salud del backend
async function checkServerHealth() {
    try {
        const res = await fetch(`${API_BASE_URL}/health`);
        if (res.ok) {
            serverStatusBadge.textContent = '🟢 API Conectada';
            serverStatusBadge.style.color = '#34d399';
            serverStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        } else {
            throw new Error('Server unhealthy');
        }
    } catch (err) {
        serverStatusBadge.textContent = '🔴 API Desconectada';
        serverStatusBadge.style.color = '#f87171';
        serverStatusBadge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    }
}

// Configurar fecha de hoy por defecto en el selector
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    inputFecha.value = today;
}

// Escuchadores de eventos
function setupEventListeners() {
    btnOpenModal.addEventListener('click', openCreateModal);
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    modalForm.addEventListener('submit', handleFormSubmit);

    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loadMarcaciones();
    });

    btnClearFilters.addEventListener('click', () => {
        filterEmpleado.value = '';
        filterFecha.value = '';
        loadMarcaciones();
    });
}

// Cargar marcaciones desde la API con filtros opcionales
async function loadMarcaciones() {
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center loading-row">Cargando marcaciones desde API REST...</td></tr>`;

    try {
        const params = new URLSearchParams();
        const empleado = filterEmpleado.value.trim();
        const fecha = filterFecha.value;

        if (empleado) params.append('empleado', empleado);
        if (fecha) params.append('fecha', fecha);

        const url = `${API_BASE_URL}/marcaciones${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        marcacionesCache = data;
        renderTable(data);
        updateStats(data);
        checkServerHealth();
    } catch (error) {
        console.error('Error al cargar marcaciones:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center" style="color: #f87171; padding: 24px;">
                    ❌ No se pudo conectar con el API REST (${error.message}).<br>
                    Verifique que el contenedor <code>api</code> esté ejecutándose en Docker.
                </td>
            </tr>
        `;
        showToast('Error al conectar con la API REST', 'error');
        checkServerHealth();
    }
}

// Renderizar tabla de marcaciones
function renderTable(marcaciones) {
    if (!marcaciones || marcaciones.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center loading-row">
                    No se encontraron marcaciones registradas para el criterio seleccionado.
                </td>
            </tr>
        `;
        tableCountInfo.textContent = 'Mostrando 0 registros';
        return;
    }

    tableCountInfo.textContent = `Mostrando ${marcaciones.length} registro(s)`;

    tableBody.innerHTML = marcaciones.map(m => {
        const fechaFormatted = m.fecha ? m.fecha.split('T')[0] : '-';
        const horaProgIng = formatTime(m.hora_ingreso_programada);
        const horaRealIng = formatTime(m.hora_ingreso_real);
        const horaProgSal = formatTime(m.hora_salida_programada);
        const horaRealSal = formatTime(m.hora_salida_real);
        const estadoClass = getEstadoClass(m.estado);

        return `
            <tr>
                <td><strong>#${m.id}</strong></td>
                <td>
                    <div><strong>${escapeHtml(m.nombre_empleado)}</strong></div>
                    <small style="color: #94a3b8;">${escapeHtml(m.codigo_empleado)}</small>
                </td>
                <td>${fechaFormatted}</td>
                <td>
                    <div class="time-box">
                        <span class="time-real">${horaRealIng}</span>
                        <span class="time-prog">Prog: ${horaProgIng}</span>
                    </div>
                </td>
                <td>
                    <div class="time-box">
                        <span class="time-real">${horaRealSal}</span>
                        <span class="time-prog">Prog: ${horaProgSal}</span>
                    </div>
                </td>
                <td>
                    <span class="badge-status ${estadoClass}">${escapeHtml(m.estado)}</span>
                </td>
                <td style="max-width: 220px; font-size: 0.8rem; color: #cbd5e1;">
                    ${m.observacion ? escapeHtml(m.observacion) : '<em style="color:#64748b;">Sin comentarios</em>'}
                </td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-sm btn-edit" onclick="openEditModal(${m.id})">✏️ Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMarcacion(${m.id})">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Actualizar contadores métricos superiores
function updateStats(marcaciones) {
    let total = marcaciones.length;
    let puntual = 0;
    let atraso = 0;
    let incompleto = 0;

    marcaciones.forEach(m => {
        const est = (m.estado || '').toUpperCase();
        if (est === 'PUNTUAL') puntual++;
        else if (est === 'ATRASO') atraso++;
        else incompleto++;
    });

    statTotal.textContent = total;
    statPuntual.textContent = puntual;
    statAtraso.textContent = atraso;
    statIncompleto.textContent = incompleto;
}

// Abrir modal en modo creación
function openCreateModal() {
    modalForm.reset();
    inputId.value = '';
    modalTitle.textContent = 'Registrar Nueva Marcación';
    setDefaultDate();
    inputHoraProgIngreso.value = '08:00';
    inputHoraRealIngreso.value = '08:00';
    inputHoraProgSalida.value = '16:00';
    inputHoraRealSalida.value = '16:00';
    modal.classList.add('active');
}

// Abrir modal en modo edición
function openEditModal(id) {
    const item = marcacionesCache.find(m => m.id === id);
    if (!item) return;

    inputId.value = item.id;
    inputCodigo.value = item.codigo_empleado;
    inputNombre.value = item.nombre_empleado;
    inputFecha.value = item.fecha ? item.fecha.split('T')[0] : '';
    inputHoraProgIngreso.value = item.hora_ingreso_programada.substring(0, 5);
    inputHoraRealIngreso.value = item.hora_ingreso_real.substring(0, 5);
    inputHoraProgSalida.value = item.hora_salida_programada.substring(0, 5);
    inputHoraRealSalida.value = item.hora_salida_real.substring(0, 5);
    inputObservacion.value = item.observacion || '';

    modalTitle.textContent = `Editar Marcación #${item.id}`;
    modal.classList.add('active');
}

// Cerrar modal
function closeModal() {
    modal.classList.remove('active');
    modalForm.reset();
}

// Enviar formulario (Crear o Actualizar)
async function handleFormSubmit(e) {
    e.preventDefault();

    const id = inputId.value;
    const isEdit = !!id;

    const payload = {
        codigo_empleado: inputCodigo.value.trim(),
        nombre_empleado: inputNombre.value.trim(),
        fecha: inputFecha.value,
        hora_ingreso_programada: inputHoraProgIngreso.value,
        hora_ingreso_real: inputHoraRealIngreso.value,
        hora_salida_programada: inputHoraProgSalida.value,
        hora_salida_real: inputHoraRealSalida.value,
        observacion: inputObservacion.value.trim()
    };

    // Validación en cliente: salida >= ingreso
    const [inH, inM] = payload.hora_ingreso_real.split(':').map(Number);
    const [outH, outM] = payload.hora_salida_real.split(':').map(Number);
    if ((outH * 60 + outM) < (inH * 60 + inM)) {
        showToast('La hora de salida no puede ser anterior a la hora de ingreso', 'error');
        return;
    }

    try {
        const url = isEdit ? `${API_BASE_URL}/marcaciones/${id}` : `${API_BASE_URL}/marcaciones`;
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Error al procesar la solicitud');
        }

        showToast(isEdit ? 'Marcación actualizada exitosamente' : 'Marcación registrada con éxito', 'success');
        closeModal();
        loadMarcaciones();
    } catch (error) {
        console.error('Error al guardar marcación:', error);
        showToast(error.message, 'error');
    }
}

// Eliminar marcación
async function deleteMarcacion(id) {
    if (!confirm(`¿Está seguro de que desea eliminar la marcación #${id}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/marcaciones/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'No se pudo eliminar la marcación');
        }

        showToast(`Marcación #${id} eliminada correctamente`, 'success');
        loadMarcaciones();
    } catch (error) {
        console.error('Error al eliminar:', error);
        showToast(error.message, 'error');
    }
}

// Helpers de formato y seguridad
function formatTime(timeStr) {
    if (!timeStr) return '--:--';
    return timeStr.substring(0, 5);
}

function getEstadoClass(estado) {
    const est = (estado || '').toUpperCase();
    if (est === 'PUNTUAL') return 'status-puntual';
    if (est === 'ATRASO') return 'status-atraso';
    return 'status-incompleto';
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Sistema de Notificaciones Toast
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
