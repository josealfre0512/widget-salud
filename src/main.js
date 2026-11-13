
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const inputField = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const modeSelector = document.getElementById('mode-selector'); // Referencia al selector de modo

// Nuevas referencias al DOM
const btnConfig = document.getElementById('btn-config');
const configPanel = document.getElementById('config-panel');
const inputCalorias = document.getElementById('input-calorias');
const inputHoras = document.getElementById('input-horas');
const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');

const inputComida = document.getElementById('input-comida');
const btnComida = document.getElementById('btn-comida');

// Guardar comida al hacer clic
btnComida.addEventListener('click', async () => {
  const calorias = parseInt(inputComida.value);
  if (calorias > 0) {
    try {
      const respuesta = await invoke('registrar_comida', { calorias: calorias });
      
      // Mostrar en el chat
      const agentMsg = document.createElement('div');
      agentMsg.className = 'message agent';
      agentMsg.textContent = '🍎 ' + respuesta;
      chatBox.appendChild(agentMsg);
      chatBox.scrollTop = chatBox.scrollHeight;
      
      inputComida.value = ''; // Limpiar
    } catch (e) {
      console.error(e);
    }
  }
});

// 1. Abrir/Cerrar el panel
btnConfig.addEventListener('click', async () => {
  configPanel.classList.toggle('hidden');
  
  // Si el panel se acaba de abrir, le pedimos a Rust tus datos guardados
  if (!configPanel.classList.contains('hidden')) {
    try {
      const perfil = await invoke('obtener_perfil');
      inputCalorias.value = perfil.calorias_diarias;
      inputHoras.value = perfil.horas_maximas;
    } catch (e) {
      console.error("Error cargando el perfil:", e);
    }
  }
});

// 2. Guardar los datos cuando presionas el botón
btnGuardarPerfil.addEventListener('click', async () => {
  const nuevasCalorias = parseInt(inputCalorias.value) || 2200; // 2200 por defecto si está vacío
  const nuevasHoras = parseInt(inputHoras.value) || 4;

  try {
    // Enviamos el objeto exactamente como Rust lo espera
    await invoke('guardar_perfil', { 
      perfil: { calorias_diarias: nuevasCalorias, horas_maximas: nuevasHoras } 
    });
    
    // Ocultamos el panel
    configPanel.classList.add('hidden');
    
    // Le avisamos al usuario por el chat que todo salió bien
    const agentMsg = document.createElement('div');
    agentMsg.className = 'message agent';
    agentMsg.textContent = '⚙️ Agente: Perfil actualizado. Parámetros de salud reconfigurados en mi memoria local.';
    chatBox.appendChild(agentMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
    
  } catch (error) {
    console.error('Error guardando:', error);
  }
});

inputField.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter' && inputField.value.trim() !== '') {
    const text = inputField.value.trim();
    const currentMode = modeSelector ? modeSelector.value : 'salud'; // Captura el modo elegido ("salud" o "estres")
    
    // 1. Mostrar tu mensaje en el chat
    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    userMsg.textContent = text;
    chatBox.appendChild(userMsg);
    
    // 2. Limpiar barra de texto y hacer scroll hacia abajo
    inputField.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
      // 3. Enviar a Rust el texto Y el modo seleccionado
      const respuestaRust = await invoke('procesar_mensaje', { 
        mensaje: text, 
        modo: currentMode 
      });
      
      // 4. Mostrar respuesta del agente
      const agentMsg = document.createElement('div');
      agentMsg.className = 'message agent';
      agentMsg.textContent = respuestaRust;
      chatBox.appendChild(agentMsg);
      
      chatBox.scrollTop = chatBox.scrollHeight;
      
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = document.createElement('div');
      errorMsg.className = 'message agent';
      errorMsg.style.backgroundColor = "rgba(200, 50, 50, 0.2)";
      errorMsg.style.borderColor = "rgba(200, 50, 50, 0.5)";
      errorMsg.textContent = "Error de conexión con IA: " + error;
      chatBox.appendChild(errorMsg);
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }
});

// Escuchar los eventos del cronómetro enviadas desde el backend de Rust
// Escuchar la alerta médica de Rust (Fase 2: Apoyo Visual)
listen('alerta-descanso', (event) => {
  const agentMsg = document.createElement('div');
  agentMsg.className = 'message agent';
  
  // 1. Añadimos el texto clínico que manda Rust
  const textoMedico = document.createElement('p');
  textoMedico.textContent = event.payload;
  textoMedico.style.margin = "0 0 10px 0";
  agentMsg.appendChild(textoMedico);

  // 2. Creamos la tarjeta visual para la animación
  const tarjetaVisual = document.createElement('div');
  tarjetaVisual.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
  tarjetaVisual.style.padding = "10px";
  tarjetaVisual.style.borderRadius = "8px";
  tarjetaVisual.style.textAlign = "center";
  tarjetaVisual.style.border = "1px solid rgba(160, 216, 160, 0.3)";

  // 3. Cargamos la animación local
  const animacion = document.createElement('img');
  animacion.src = "estiramiento.webp"; 
  animacion.alt = "Animación de estiramiento";
  animacion.style.width = "100%";
  animacion.style.maxWidth = "160px";
  animacion.style.borderRadius = "4px";

  // 4. Etiqueta de validación
  const etiqueta = document.createElement('small');
  etiqueta.textContent = "Extensión Cervical (Basado en directrices AHA)";
  etiqueta.style.display = "block";
  etiqueta.style.color = "#a0d8a0";
  etiqueta.style.marginTop = "8px";
  etiqueta.style.fontWeight = "bold";

  // Ensamblamos todo en el chat
  tarjetaVisual.appendChild(animacion);
  tarjetaVisual.appendChild(etiqueta);
  agentMsg.appendChild(tarjetaVisual);
  
  chatBox.appendChild(agentMsg);
  chatBox.scrollTop = chatBox.scrollHeight;
});