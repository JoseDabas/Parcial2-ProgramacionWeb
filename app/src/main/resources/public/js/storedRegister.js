// 1. Función para obtener todos los registros de la IndexedDB
function getAllRecords() {
    return new Promise((resolve, reject) => {
        let transaction = db.transaction(['encuestas'], 'readonly');
        let objectStore = transaction.objectStore('encuestas');
        let request = objectStore.getAll();
        request.onsuccess = function () {
            console.log("Registros obtenidos:", request.result);
            resolve(request.result);
        };
        request.onerror = function () {
            console.error("Error al obtener registros:", request.error);
            reject(request.error);
        };
    });
}

// 2. Función para mostrar los registros en una tabla HTML
async function displayRecords() {
    try {
        db = await window.initializeDB();
        let records = await getAllRecords();
        let table = document.getElementById('recordsTable');
        let tbody = table.getElementsByTagName('tbody')[0];
        tbody.innerHTML = ''; // Limpiar la tabla antes de agregar nuevos registros
        
        records.forEach(record => {
            let row = tbody.insertRow();
            row.insertCell().innerText = record.nombre || '';
            row.insertCell().innerText = record.sector || '';
            row.insertCell().innerText = record.nivelEscolar || '';
            
            let actionsCell = row.insertCell();
            
            // Crear botón de editar con clases de Bootstrap y Font Awesome
            let editButton = document.createElement('button');
            editButton.className = 'btn btn-sm btn-primary mr-2';
            editButton.innerHTML = '<i class="fas fa-edit mr-1"></i>Editar';
            editButton.onclick = function() {
                editRecord(record.id);
            };
            actionsCell.appendChild(editButton);
            
            // Crear botón de borrar con clases de Bootstrap y Font Awesome
            let deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-sm btn-danger';
            deleteButton.innerHTML = '<i class="fas fa-trash-alt mr-1"></i>Borrar';
            deleteButton.onclick = function() {
                deleteRecord(record.id);
            };
            actionsCell.appendChild(deleteButton);
        });
        
        // Configurar los event listeners para los botones
        setupEventListeners();
    } catch (error) {
        console.error("Error en displayRecords:", error);
    }
}

// Función para configurar los event listeners
function setupEventListeners() {
    // Event listener para guardar cambios en el registro
    document.getElementById('saveButton').addEventListener('click', function() {
        let id = Number(document.getElementById('editId').value);
        let nombre = document.getElementById('editNombre').value;
        let sector = document.getElementById('editSector').value;
        let nivelEscolar = document.getElementById('editNivelEscolar').value;
        let usuario = document.getElementById('editUsuario').value;

        let transaction = db.transaction(['encuestas'], 'readwrite');
        let objectStore = transaction.objectStore('encuestas');
        let request = objectStore.get(id);
        request.onsuccess = function () {
            let record = request.result;
            if (record) {
                record.nombre = nombre;
                record.sector = sector;
                record.nivelEscolar = nivelEscolar;
                record.usuario = usuario;

                let updateRequest = objectStore.put(record);
                updateRequest.onsuccess = function () {
                    console.log('Registro actualizado con éxito');
                    location.reload();
                };
                updateRequest.onerror = function () {
                    console.log('Error al actualizar el registro');
                };

                $('#editModal').modal('hide');
            } else {
                console.log('No se encontró ningún registro con el id: ', id);
            }
        };
    });

    // Event listener para confirmar borrado
    document.getElementById('confirmDeleteButton').addEventListener('click', function() {
        let id = Number(this.dataset.recordId);
        if (!isNaN(id)) {
            let transaction = db.transaction(['encuestas'], 'readwrite');
            let objectStore = transaction.objectStore('encuestas');
            let request = objectStore.delete(id);
            request.onsuccess = function () {
                console.log('Registro borrado con éxito');
                location.reload();
            };
            request.onerror = function () {
                console.log('Error al borrar el registro');
            };
            $('#deleteModal').modal('hide');
        } else {
            console.log('El id del registro a borrar no es un número válido');
        }
    });

    // Event listener para el botón de sincronización
    let syncButton = document.getElementById('syncButton');
    if (syncButton) {
        syncButton.onclick = function () {
            syncWithServer();
        };
    }
}

// 3. Funciones para manejar las acciones de editar y borrar
function editRecord(id) {
    let transaction = db.transaction(['encuestas'], 'readonly');
    let objectStore = transaction.objectStore('encuestas');
    let request = objectStore.get(id);
    request.onsuccess = function () {
        let record = request.result;
        if (record) {
            document.getElementById('editId').value = record.id;
            document.getElementById('editNombre').value = record.nombre || '';
            document.getElementById('editSector').value = record.sector || '';
            document.getElementById('editNivelEscolar').value = record.nivelEscolar || '';
            document.getElementById('editUsuario').value = record.usuario || '';
            $('#editModal').modal('show');
        } else {
            console.log('No se encontró ningún registro con el id: ', id);
        }
    };
}

function deleteRecord(id) {
    if (isNaN(id)) {
        console.log('El id del registro a borrar no es un número válido');
        return;
    }
    let confirmDeleteButton = document.getElementById('confirmDeleteButton');
    if (confirmDeleteButton) {
        confirmDeleteButton.dataset.recordId = id;
        $('#deleteModal').modal('show');
    } else {
        console.log('No se encontró el botón de confirmación de borrado');
    }
}

// 4. Funciones para sincronizar con el servidor
var webSocket;

async function syncWithServer() {
    try {
        let records = await getAllRecords();
        console.log("Registros a sincronizar:", records);
        
        if (records && records.length > 0) {
            // Determinar si estamos en localhost
            const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
            
            if (isLocalhost) {
                // En desarrollo local, usar WebSocket
                console.log("Usando sincronización WebSocket en desarrollo local");
                verificarConexion(records);
            } else {
                // En producción, usar HTTP
                console.log("Usando sincronización HTTP en producción");
                sincronizarViaHTTP(records);
            }
        } else {
            console.log("No hay registros para sincronizar");
            alert("No hay registros para sincronizar");
        }
    } catch (error) {
        console.error("Error al sincronizar:", error);
        alert("Error al sincronizar: " + error.message);
    }
}

// Nueva función para sincronizar vía HTTP
function sincronizarViaHTTP(records) {
    // Mostrar mensaje de carga
    alert("Iniciando sincronización de " + records.length + " registro(s)...");
    
    fetch('/encuesta/sincronizar-http', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(records)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error en la respuesta: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        console.log("Respuesta del servidor:", data);
        if (data.success) {
            deleteAllRecords();
            alert("Sincronización completada con éxito");
        } else {
            alert("Error en la sincronización: " + data.message);
        }
    })
    .catch(error => {
        console.error('Error en sincronización HTTP:', error);
        alert("Error en la sincronización. Detalles: " + error.message);
    });
}

function conectar(records) {
    //Cambiado a wss
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUrl = protocol + location.hostname + (location.port ? ':' + location.port : '') + "/encuesta/sincronizar";
    
    console.log("Protocolo detectado:", protocol);
    console.log("Hostname:", location.hostname);
    console.log("Puerto:", location.port);
    console.log("Intentando conectar a WebSocket:", wsUrl);
    
    try {
        webSocket = new WebSocket(wsUrl);
        
        webSocket.onopen = function() {
            console.log("Conexión WebSocket establecida exitosamente");
            alert("Conectado al servidor, iniciando sincronización...");
            webSocket.send(JSON.stringify(records));
            deleteAllRecords();
        };
        
        webSocket.onerror = function(error) {
            console.error('WebSocket Error:', error);
            console.log('Intentando sincronización HTTP como alternativa...');
            sincronizarViaHTTP(records);
        };
        
        webSocket.onclose = function(event) {
            console.log("Conexión WebSocket cerrada. Código:", event.code, "Razón:", event.reason, "Limpia:", event.wasClean);
        };
    } catch (e) {
        console.error("Error al crear objeto WebSocket:", e);
        alert("Error al crear la conexión WebSocket. Usando HTTP como alternativa.");
        sincronizarViaHTTP(records);
    }
}

function deleteAllRecords() {
    let transaction = db.transaction(['encuestas'], 'readwrite');
    let objectStore = transaction.objectStore('encuestas');
    let request = objectStore.clear();
    request.onsuccess = function () {
        console.log('Todos los registros han sido borrados de la IndexedDB');
        location.reload();
    };
    request.onerror = function () {
        console.log('Error al borrar los registros de la IndexedDB');
    };
}

function verificarConexion(records){
    if(!webSocket || webSocket.readyState == 3){
        conectar(records);
    }
}

// Exponer la función displayRecords en el objeto window
window.displayRecords = displayRecords;
