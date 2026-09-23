// Base URL para la API REST (a traves del proxy reverso Nginx o directo)
const API_BASE_URL = '/api';

// Estado global y cache en memoria
let marcacionesCache = [];
let empleadosCache = [];

// Elementos del DOM - Estadisticas
const statTotal = document.getElementById('statTotal');
const statPuntual = document.getElementById('statPuntual');
const statAtraso = document.getElementById('statAtraso');
const statIncompleto = document.getElementById('statIncompleto');
const tableCountInfo = document.getElementById('tableCountInfo');

// Elementos del DOM - Filtros y Tabla
const filterForm = document.getElementById('filterForm');
const filterEmpleado = document.getElementById('filterEmpleado');
const filterFecha = document.getElementById('filterFecha');
const btnClearFilters = document.getElementById('btnClearFilters');
const tableBody = document.getElementById('marcacionesTableBody');

// Elementos del DOM - Modal Marcacion
const modal = document.getElementById('marcacionModal');
const modalTitle = document.getElementById('modalTitle');
const modalForm = document.getElementById('marcacionForm');
const btnNuevaMarcacion = document.getElementById('btnNuevaMarcacion');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');

// Campos del formulario Marcacion
const inputId = document.getElementById('marcacionId');
const inputCodigo = document.getElementById('codigo_empleado');
const inputNombre = document.getElementById('nombre_empleado');
const empleadoSearchInput = document.getElementById('empleadoSearchInput');
const btnClearCombo = document.getElementById('btnClearCombo');
const empleadoDropdown = document.getElementById('empleadoDropdown');
const empleadoOptionsList = document.getElementById('empleadoOptionsList');
const selectedEmployeePreview = document.getElementById('selectedEmployeePreview');
const previewEmpCode = document.getElementById('previewEmpCode');
const previewEmpName = document.getElementById('previewEmpName');
const linkCrearEmpleadoRapido = document.getElementById('linkCrearEmpleadoRapido');

const inputFecha = document.getElementById('fecha');
const inputHoraProgIngreso = document.getElementById('hora_ingreso_programada');
const inputHoraRealIngreso = document.getElementById('hora_ingreso_real');
const inputHoraProgSalida = document.getElementById('hora_salida_programada');
const inputHoraRealSalida = document.getElementById('hora_salida_real');
const inputObservacion = document.getElementById('observacion');

// Elementos del DOM - Modal Empleados
const empleadosModal = document.getElementById('empleadosModal');
const btnGestionarEmpleados = document.getElementById('btnGestionarEmpleados');
const btnCloseEmpleadosModal = document.getElementById('btnCloseEmpleadosModal');
const btnCerrarEmpleadosModal = document.getElementById('btnCerrarEmpleadosModal');
const nuevoEmpleadoForm = document.getElementById('nuevoEmpleadoForm');
const newEmpCodigo = document.getElementById('newEmpCodigo');
const newEmpNombre = document.getElementById('newEmpNombre');
const newEmpCargo = document.getElementById('newEmpCargo');
const newEmpDepartamento = document.getElementById('newEmpDepartamento');
const empleadosTableBody = document.getElementById('empleadosTableBody');
const empleadosTotalCount = document.getElementById('empleadosTotalCount');

// Indicador de estado del servidor
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');

// Inicializacion
document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    checkServerHealth();
    loadEmpleados();
    loadMarcaciones();
    setDefaultDate();
});

// Registrar Listeners
function initEvents() {
    // Filtros
    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loadMarcaciones();
    });

    btnClearFilters.addEventListener('click', () => {
        filterEmpleado.value = '';
        filterFecha.value = '';
        loadMarcaciones();
    });

    // Modal Marcacion
    btnNuevaMarcacion.addEventListener('click', openCreateModal);
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);
    modalForm.addEventListener('submit', handleFormSubmit);

    // Buscador interactivo de empleados (Combo)
    empleadoSearchInput.addEventListener('focus', () => renderComboOptions(empleadoSearchInput.value));
    empleadoSearchInput.addEventListener('input', (e) => {
        // Si el usuario escribe manualmente, resetear seleccion oculta
        inputCodigo.value = '';
        inputNombre.value = '';
        selectedEmployeePreview.style.display = 'none';
        btnClearCombo.style.display = e.target.value ? 'block' : 'none';
        renderComboOptions(e.target.value);
    });

    btnClearCombo.addEventListener('click', clearComboSelection);

    // Cerrar dropdown si se hace click fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.combo-container')) {
            empleadoDropdown.classList.remove('active');
        }
    });

    // Enlace rapido a nuevo empleado desde el modal de marcacion
    linkCrearEmpleadoRapido.addEventListener('click', () => {
        openEmpleadosModal();
    });

    // Modal Empleados
    btnGestionarEmpleados.addEventListener('click', openEmpleadosModal);
    btnCloseEmpleadosModal.addEventListener('click', closeEmpleadosModal);
    btnCerrarEmpleadosModal.addEventListener('click', closeEmpleadosModal);
    nuevoEmpleadoForm.addEventListener('submit', handleNuevoEmpleadoSubmit);

    // Cerrar modales con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeEmpleadosModal();
        }
    });
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    if (inputFecha) inputFecha.value = today;
}

// VERIFICACION DE ESTADO DEL SERVIDOR (HEALTHCHECK)
async function checkServerHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        if (response.ok && data.status === 'UP') {
            statusIndicator.className = 'status-indicator online';
            statusText.textContent = 'API Conectada';
        } else {
            statusIndicator.className = 'status-indicator offline';
            statusText.textContent = 'BD No Conectada';
        }
    } catch (err) {
        statusIndicator.className = 'status-indicator offline';
        statusText.textContent = 'Servidor Inaccesible';
    }
}

//#region Logica de Empleados

async function loadEmpleados() {
    try {
        const response = await fetch(`${API_BASE_URL}/empleados`);
        if (!response.ok) throw new Error('Error al consultar empleados');
        empleadosCache = await response.json();
        renderEmpleadosTable(empleadosCache);
        if (empleadosTotalCount) {
            empleadosTotalCount.textContent = `${empleadosCache.length} empleado(s) registrado(s)`;
        }
    } catch (error) {
        console.error('Error cargando empleados:', error);
    }
}

async function fetchSiguienteCodigoEmpleado() {
    try {
        const res = await fetch(`${API_BASE_URL}/empleados/siguiente-codigo`);
        if (res.ok) {
            const data = await res.json();
            if (newEmpCodigo) newEmpCodigo.value = data.siguiente_codigo;
        }
    } catch (error) {
        console.error('Error al obtener siguiente codigo:', error);
    }
}

function renderEmpleadosTable(empleados) {
    if (!empleadosTableBody) return;
    if (!empleados || empleados.length === 0) {
        empleadosTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center loading-row">No hay empleados registrados.</td>
            </tr>
        `;
        return;
    }

    empleadosTableBody.innerHTML = empleados.map(emp => `
        <tr>
            <td><span class="badge-code">${escapeHtml(emp.codigo_empleado)}</span></td>
            <td><strong>${escapeHtml(emp.nombre_completo)}</strong></td>
            <td>${emp.cargo ? escapeHtml(emp.cargo) : '<span style="color:#64748b;">-</span>'}</td>
            <td>${emp.departamento ? escapeHtml(emp.departamento) : '<span style="color:#64748b;">-</span>'}</td>
            <td><span class="badge-status status-puntual">ACTIVO</span></td>
        </tr>
    `).join('');
}

function openEmpleadosModal() {
    fetchSiguienteCodigoEmpleado();
    loadEmpleados();
    empleadosModal.classList.add('active');
}

function closeEmpleadosModal() {
    empleadosModal.classList.remove('active');
    nuevoEmpleadoForm.reset();
}

async function handleNuevoEmpleadoSubmit(e) {
    e.preventDefault();
    const payload = {
        nombre_completo: newEmpNombre.value.trim(),
        cargo: newEmpCargo.value.trim(),
        departamento: newEmpDepartamento.value.trim()
    };

    try {
        const res = await fetch(`${API_BASE_URL}/empleados`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (!res.ok) {
            throw new Error(result.error || 'Error al registrar empleado');
        }

        showToast(`Empleado ${result.codigo_empleado} (${result.nombre_completo}) registrado correctamente`, 'success');
        nuevoEmpleadoForm.reset();
        await loadEmpleados();
        await fetchSiguienteCodigoEmpleado();

        // Si el modal de marcacion esta abierto, auto-seleccionar este nuevo empleado
        if (modal.classList.contains('active')) {
            selectEmpleado(result.codigo_empleado, result.nombre_completo);
        }
    } catch (error) {
        console.error('Error al guardar empleado:', error);
        showToast(error.message, 'error');
    }
}

//#endregion Logica de Empleados

//#region Combo Buscador de Empleados

function renderComboOptions(queryText = '') {
    const q = (queryText || '').toLowerCase().trim();
    const matches = empleadosCache.filter(emp => {
        if (!q) return true;
        return emp.codigo_empleado.toLowerCase().includes(q) || 
               emp.nombre_completo.toLowerCase().includes(q) ||
               (emp.cargo && emp.cargo.toLowerCase().includes(q));
    });

    if (matches.length === 0) {
        empleadoOptionsList.innerHTML = `
            <div class="combo-no-results">
                No se encontro ningun empleado con "${escapeHtml(queryText)}".
                <div style="margin-top:6px;">
                    <a href="javascript:void(0)" onclick="openEmpleadosModal()" class="link-small">+ Crear "${escapeHtml(queryText)}"</a>
                </div>
            </div>
        `;
    } else {
        empleadoOptionsList.innerHTML = matches.map(emp => `
            <div class="combo-item" data-code="${escapeHtml(emp.codigo_empleado)}" data-name="${escapeHtml(emp.nombre_completo)}">
                <div class="combo-item-info">
                    <span class="combo-item-name">${escapeHtml(emp.nombre_completo)}</span>
                    <span class="combo-item-details">${escapeHtml(emp.cargo || 'Sin cargo')} &bull; ${escapeHtml(emp.departamento || 'General')}</span>
                </div>
                <span class="badge-code">${escapeHtml(emp.codigo_empleado)}</span>
            </div>
        `).join('');

        // Agregar listeners de seleccion
        empleadoOptionsList.querySelectorAll('.combo-item').forEach(item => {
            item.addEventListener('click', () => {
                selectEmpleado(item.getAttribute('data-code'), item.getAttribute('data-name'));
            });
        });
    }

    empleadoDropdown.classList.add('active');
}

function selectEmpleado(codigo, nombre) {
    inputCodigo.value = codigo;
    inputNombre.value = nombre;
    empleadoSearchInput.value = `${codigo} - ${nombre}`;

    previewEmpCode.textContent = codigo;
    previewEmpName.textContent = nombre;
    selectedEmployeePreview.style.display = 'inline-flex';
    btnClearCombo.style.display = 'block';

    empleadoDropdown.classList.remove('active');
}

function clearComboSelection() {
    inputCodigo.value = '';
    inputNombre.value = '';
    empleadoSearchInput.value = '';
    selectedEmployeePreview.style.display = 'none';
    btnClearCombo.style.display = 'none';
    renderComboOptions('');
    empleadoSearchInput.focus();
}

//#endregion Combo Buscador de Empleados

//#region Logica de Marcaciones

// CARGAR MARCACIONES (GET)
async function loadMarcaciones() {
    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center loading-row">Cargando marcaciones...</td>
        </tr>
    `;

    try {
        const params = new URLSearchParams();
        const empVal = filterEmpleado.value.trim();
        const dateVal = filterFecha.value;

        if (empVal) params.append('empleado', empVal);
        if (dateVal) params.append('fecha', dateVal);

        const url = params.toString() ? `${API_BASE_URL}/marcaciones?${params.toString()}` : `${API_BASE_URL}/marcaciones`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Respuesta no valida del servidor: ${response.status}`);
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
                <td colspan="8" class="text-center error-row">
                    No se pudo conectar con el servidor API (${error.message}).
                </td>
            </tr>
        `;
        showToast('Error de conexion con la API REST', 'error');
        checkServerHealth();
    }
}

// RENDERIZAR TABLA DE MARCACIONES CON CODIGO EMPLEADO EN LUGAR DE ID
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
                <td>
                    <span class="badge-code">${escapeHtml(m.codigo_empleado)}</span>
                </td>
                <td>
                    <span class="table-emp-name">${escapeHtml(m.nombre_empleado)}</span>
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
                        <button class="btn btn-sm btn-edit" onclick="openEditModal(${m.id})">Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMarcacion(${m.id})">Eliminar</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// METRICAS
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

// ABRIR MODAL CREAR
function openCreateModal() {
    modalForm.reset();
    inputId.value = '';
    clearComboSelection();
    modalTitle.textContent = 'Registrar Nueva Marcacion';
    setDefaultDate();
    inputHoraProgIngreso.value = '08:00';
    inputHoraRealIngreso.value = '08:00';
    inputHoraProgSalida.value = '16:00';
    inputHoraRealSalida.value = '16:00';
    modal.classList.add('active');
}

// ABRIR MODAL EDITAR
function openEditModal(id) {
    const item = marcacionesCache.find(m => m.id === id);
    if (!item) return;

    inputId.value = item.id;
    selectEmpleado(item.codigo_empleado, item.nombre_empleado);
    inputFecha.value = item.fecha ? item.fecha.split('T')[0] : '';
    inputHoraProgIngreso.value = item.hora_ingreso_programada.substring(0, 5);
    inputHoraRealIngreso.value = item.hora_ingreso_real.substring(0, 5);
    inputHoraProgSalida.value = item.hora_salida_programada.substring(0, 5);
    inputHoraRealSalida.value = item.hora_salida_real.substring(0, 5);
    inputObservacion.value = item.observacion || '';

    modalTitle.textContent = `Editar Marcacion (Empleado: ${item.codigo_empleado})`;
    modal.classList.add('active');
}

// CERRAR MODAL
function closeModal() {
    modal.classList.remove('active');
    modalForm.reset();
    empleadoDropdown.classList.remove('active');
}

// SUBMIT MARCACION
async function handleFormSubmit(e) {
    e.preventDefault();

    const id = inputId.value;
    const isEdit = !!id;

    // Si el usuario escribio directamente en el combo sin hacer clic en una opcion
    let codigo = inputCodigo.value.trim();
    let nombre = inputNombre.value.trim();

    if (!codigo || !nombre) {
        const rawText = empleadoSearchInput.value.trim();
        // Verificar si coincide con algun empleado existente
        const matched = empleadosCache.find(emp => 
            emp.codigo_empleado.toLowerCase() === rawText.toLowerCase() ||
            emp.nombre_completo.toLowerCase() === rawText.toLowerCase()
        );

        if (matched) {
            codigo = matched.codigo_empleado;
            nombre = matched.nombre_completo;
        } else if (rawText) {
            // Asumir que ingreso un nombre y asignar o buscar
            showToast('Por favor seleccione un empleado valido de la lista o registre uno nuevo', 'error');
            return;
        } else {
            showToast('Debe seleccionar un empleado para la marcacion', 'error');
            return;
        }
    }

    const payload = {
        codigo_empleado: codigo,
        nombre_empleado: nombre,
        fecha: inputFecha.value,
        hora_ingreso_programada: inputHoraProgIngreso.value,
        hora_ingreso_real: inputHoraRealIngreso.value,
        hora_salida_programada: inputHoraProgSalida.value,
        hora_salida_real: inputHoraRealSalida.value,
        observacion: inputObservacion.value.trim()
    };

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

        showToast(isEdit ? 'Marcacion actualizada exitosamente' : 'Marcacion registrada con exito', 'success');
        closeModal();
        loadMarcaciones();
    } catch (error) {
        console.error('Error al guardar marcacion:', error);
        showToast(error.message, 'error');
    }
}

// ELIMINAR MARCACION
async function deleteMarcacion(id) {
    const item = marcacionesCache.find(m => m.id === id);
    const empCode = item ? item.codigo_empleado : id;
    if (!confirm(`Confirma que desea eliminar la marcacion de ${empCode}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/marcaciones/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'No se pudo eliminar la marcacion');
        }

        showToast(`Marcacion eliminada correctamente`, 'success');
        loadMarcaciones();
    } catch (error) {
        console.error('Error al eliminar:', error);
        showToast(error.message, 'error');
    }
}

//#endregion Logica de Marcaciones

// UTILIDADES
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

// NOTIFICACIONES TOAST
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
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
